import type { MapboxProfile } from './MapboxProfile';

export interface MapboxRequest {
    apiKey: string;
    lat: number;
    lon: number;
    minutes: number;
    profile: MapboxProfile;
}
