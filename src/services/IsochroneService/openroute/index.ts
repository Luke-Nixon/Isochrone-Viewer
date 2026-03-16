import { OpenRouteProvider } from './types';
import type { OpenRouteConfig } from './types';

export * from './types';

const defaultConfig: OpenRouteConfig = { apiKey: '', enabled: false };

export function getOpenRouteConfig(): OpenRouteConfig {
    const stored = localStorage.getItem(OpenRouteProvider.Id);
    if (!stored) return defaultConfig;
    try {
        return JSON.parse(stored) as OpenRouteConfig;
    } catch {
        return defaultConfig;
    }
}

export function setOpenRouteConfig(config: OpenRouteConfig): void {
    localStorage.setItem(OpenRouteProvider.Id, JSON.stringify(config));
}
