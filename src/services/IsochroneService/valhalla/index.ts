import { ValhallaProvider } from './types';
import type { ValhallaConfig } from './types';

export * from './types';
export * from './api';

const DEFAULT_URL = 'https://valhalla1.openstreetmap.de';

const defaultConfig: ValhallaConfig = { url: DEFAULT_URL, enabled: false };

export function getValhallaConfig(): ValhallaConfig {
    const stored = localStorage.getItem(ValhallaProvider.Id);
    if (!stored) return defaultConfig;
    try {
        return JSON.parse(stored) as ValhallaConfig;
    } catch {
        return defaultConfig;
    }
}

export function setValhallaConfig(config: ValhallaConfig): void {
    localStorage.setItem(ValhallaProvider.Id, JSON.stringify(config));
}
