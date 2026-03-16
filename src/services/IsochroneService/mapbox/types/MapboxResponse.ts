import { z } from 'zod';

const MapboxIsochroneGeometrySchema = z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const MapboxIsochronePropertiesSchema = z.object({
    contour: z.number(),
    color: z.string(),
    opacity: z.number(),
    fill: z.string(),
    'fill-opacity': z.number(),
    fillColor: z.string(),
    fillOpacity: z.number(),
});

const MapboxIsochroneFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: MapboxIsochroneGeometrySchema,
    properties: MapboxIsochronePropertiesSchema,
});

export const MapboxResponseSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(MapboxIsochroneFeatureSchema),
});

export type MapboxResponse = z.infer<typeof MapboxResponseSchema>;
