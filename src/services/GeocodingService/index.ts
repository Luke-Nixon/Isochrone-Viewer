import { z } from 'zod';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

const NominatimResultSchema = z.array(
    z.object({
        lat: z.string(),
        lon: z.string(),
        display_name: z.string(),
    })
);

export interface GeocodingResult {
    lat: number;
    lng: number;
    displayName: string;
}

export class GeocodingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GeocodingError';
    }
}

async function fetchNominatim(query: string, limit: number): Promise<GeocodingResult[]> {
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: String(limit),
        countrycodes: 'gb',
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: {
            'Accept-Language': 'en',
            'User-Agent': 'IsochroneViewer/1.0 (https://github.com/Luke-Nixon/Isochrone-Viewer)',
        },
    });

    if (!response.ok) {
        throw new GeocodingError(`Geocoding request failed (${response.status})`);
    }

    const data = NominatimResultSchema.parse(await response.json());

    return data.map((item) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
    }));
}

export async function searchAddresses(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return fetchNominatim(trimmed, 5);
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
    const trimmed = address.trim();
    if (!trimmed) throw new GeocodingError('Address cannot be empty');

    const results = await fetchNominatim(trimmed, 1);

    if (results.length === 0) {
        throw new GeocodingError('Address not found — try adding a postcode or city');
    }

    return results[0];
}

const NominatimReverseSchema = z.object({
    display_name: z.string().optional(),
    address: z.object({
        road: z.string().optional(),
        postcode: z.string().optional(),
        city: z.string().optional(),
        town: z.string().optional(),
        village: z.string().optional(),
        suburb: z.string().optional(),
        county: z.string().optional(),
    }).optional(),
}).passthrough();

export interface ReverseGeocodingResult {
    displayName: string;
    postcode?: string;
    locality?: string;
    road?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult> {
    const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        zoom: '16', // street-level detail
        addressdetails: '1',
    });

    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
        headers: {
            'Accept-Language': 'en',
            'User-Agent': 'IsochroneViewer/1.0 (https://github.com/Luke-Nixon/Isochrone-Viewer)',
        },
    });

    if (!response.ok) {
        throw new GeocodingError(`Reverse geocoding failed (${response.status})`);
    }

    const data = NominatimReverseSchema.parse(await response.json());
    const addr = data.address;

    return {
        displayName: data.display_name ?? '',
        postcode: addr?.postcode,
        locality: addr?.city ?? addr?.town ?? addr?.village ?? addr?.suburb ?? addr?.county,
        road: addr?.road,
    };
}
