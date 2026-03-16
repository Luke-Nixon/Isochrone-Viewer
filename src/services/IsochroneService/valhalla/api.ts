import type { GeocodingResult } from '../../GeocodingService';
import { ValhallaResponseSchema } from './types';
import type { ValhallaCosting, ValhallaResponse } from './types';

export interface GetValhallaIsochroneParams {
    location: GeocodingResult;
    minutes: number;
    costing: ValhallaCosting;
    baseUrl: string;
}

export async function getValhallaIsochrone(params: GetValhallaIsochroneParams): Promise<ValhallaResponse> {
    const { location, minutes, costing, baseUrl } = params;

    const body = {
        locations: [{ lon: location.lng, lat: location.lat }],
        costing,
        contours: [{ time: minutes }],
        polygons: true,
    };

    const response = await fetch(`${baseUrl}/isochrone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Valhalla API error: ${response.status} ${response.statusText}`);
    }

    return ValhallaResponseSchema.parse(await response.json());
}
