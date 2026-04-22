import { z } from 'zod';

export const ValhallaProvider = {
    Id: 'valhalla',
} as const;

export type ValhallaCosting = 'auto' | 'pedestrian' | 'bicycle' | 'bus';

export interface ValhallaConfig {
    url: string;
    enabled: boolean;
}

export interface ValhallaRequest {
    lat: number;
    lng: number;
    minutes: number;
    costing: ValhallaCosting;
}

const ValhallaFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.enum(['Polygon', 'MultiPolygon']),
        coordinates: z.array(z.unknown()),
    }),
    properties: z.object({
        contour: z.number(),
        color: z.string().optional(),
        opacity: z.number().optional(),
        metric: z.string().optional(),
    }).passthrough(),
});

export const ValhallaResponseSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(ValhallaFeatureSchema),
});

export type ValhallaResponse = z.infer<typeof ValhallaResponseSchema>;

export class ValhallaApiError extends Error {
    readonly status: number;
    constructor(status: number, statusText: string) {
        super(`Valhalla API error: ${status} ${statusText}`);
        this.name = 'ValhallaApiError';
        this.status = status;
    }
}
