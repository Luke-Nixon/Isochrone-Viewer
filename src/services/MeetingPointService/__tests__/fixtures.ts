import type { Band, Person, PersonBands } from '../types';

/**
 * Build a synthetic square-shaped band polygon centered at (lat, lng).
 * Side length in degrees is ~ radiusKm / 111 (rough, fine for tests at UK latitudes).
 * Bands are nested (larger minutes = larger square).
 */
export function squareBand(lat: number, lng: number, radiusKm: number, minutes: number): Band {
    const d = radiusKm / 111; // rough degrees per km
    return {
        minutes,
        polygon: {
            type: 'Feature',
            properties: { contour: minutes },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [lng - d, lat - d],
                    [lng + d, lat - d],
                    [lng + d, lat + d],
                    [lng - d, lat + d],
                    [lng - d, lat - d],
                ]],
            },
        },
    };
}

/**
 * Bands for a person at (lat, lng) assuming kmPerMinute travel speed.
 * Produces bands at minutesList, each a square of side 2 * (min * kmPerMin).
 */
export function bandsAt(
    personId: string,
    lat: number,
    lng: number,
    minutesList: number[],
    kmPerMinute = 1,
): PersonBands {
    return {
        personId,
        bands: minutesList.map(m => squareBand(lat, lng, m * kmPerMinute, m)),
    };
}

export function makePerson(
    id: string,
    label: string,
    lat: number,
    lng: number,
    color: string = '#7c9fff',
    weight: number = 1.0,
): Person {
    return {
        id,
        label,
        address: { lat, lng, displayName: label },
        mode: 'auto',
        weight,
        color,
    };
}
