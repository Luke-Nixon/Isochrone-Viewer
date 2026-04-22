import type { GeocodingResult } from '../../GeocodingService';
import { ValhallaResponseSchema, ValhallaApiError } from './types';
import type { ValhallaCosting, ValhallaResponse } from './types';

export interface GetValhallaIsochroneParams {
    location: GeocodingResult;
    minutes: number;
    costing: ValhallaCosting;
    baseUrl: string;
}

export async function getValhallaIsochrone(params: GetValhallaIsochroneParams): Promise<ValhallaResponse> {
    return getValhallaIsochrones({
        location: params.location,
        minutes: [params.minutes],
        costing: params.costing,
        baseUrl: params.baseUrl,
    });
}

export interface GetValhallaIsochronesParams {
    location: GeocodingResult;
    minutes: number[];
    costing: ValhallaCosting;
    baseUrl: string;
}

export async function getValhallaIsochrones(params: GetValhallaIsochronesParams): Promise<ValhallaResponse> {
    const { location, minutes, costing, baseUrl } = params;

    const body = {
        locations: [{ lon: location.lng, lat: location.lat }],
        costing,
        contours: minutes.map(time => ({ time })),
        polygons: true,
        // Server-side polygon simplification — Douglas-Peucker tolerance in meters.
        // Cuts vertex count substantially for large isochrones (a 100-min drive
        // from a London postcode produces tens of thousands of points otherwise),
        // which shrinks the response payload + serialization time. Helps with
        // gateway timeouts on the public OSM instance. 50m is well below our
        // 5-min band quantization so algorithm accuracy is unaffected.
        generalize: 50,
        // Drop tiny disconnected polygon fragments (noise) — a smaller, cleaner shape.
        denoise: 0.5,
    };

    const response = await fetch(`${baseUrl}/isochrone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new ValhallaApiError(response.status, response.statusText);
    }

    return ValhallaResponseSchema.parse(await response.json());
}
