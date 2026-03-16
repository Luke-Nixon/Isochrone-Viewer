import { MapboxProvider } from './types';
import type { MapboxConfig } from './types';

export * from './types';

const defaultConfig: MapboxConfig = { apiKey: '', enabled: false };

export function getMapboxConfig(): MapboxConfig {
    const stored = localStorage.getItem(MapboxProvider.Id);
    if (!stored) return defaultConfig;
    try {
        return JSON.parse(stored) as MapboxConfig;
    } catch {
        return defaultConfig;
    }
}

export function setMapboxConfig(config: MapboxConfig): void {
    localStorage.setItem(MapboxProvider.Id, JSON.stringify(config));
}
