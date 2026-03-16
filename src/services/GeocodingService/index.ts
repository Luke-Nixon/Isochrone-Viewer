import { z } from 'zod';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

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
