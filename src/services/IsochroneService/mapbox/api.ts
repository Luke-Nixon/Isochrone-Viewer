import { MapboxProfile } from './types';

const MAPBOX_ISOCHRONE_BASE_URL = 'https://api.mapbox.com/isochrone/v1/mapbox';

interface FetchMapboxIsochroneParams {
    lat: number;
    lon: number;
    apiKey: string;
    minutes: number;
    profile: MapboxProfile;
}

export async function fetchMapboxIsochrone(params: FetchMapboxIsochroneParams): Promise<unknown> {
    const { lat, lon, apiKey, minutes, profile } = params;

    const url = `${MAPBOX_ISOCHRONE_BASE_URL}/${profile}/${lon},${lat}?contours_minutes=${minutes}&access_token=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
