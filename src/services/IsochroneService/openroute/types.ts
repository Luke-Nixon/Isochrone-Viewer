export const OpenRouteProvider = {
    Id: 'openroute',
} as const;

export interface OpenRouteConfig {
    apiKey: string;
    enabled: boolean;
}

export interface OpenRouteRequest {
    apiKey: string;
}

export interface OpenRouteResponse {
    response: string;
}
