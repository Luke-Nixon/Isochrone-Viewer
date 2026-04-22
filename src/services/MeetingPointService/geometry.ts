import intersect from '@turf/intersect';
import centroid from '@turf/centroid';
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import pointOnFeature from '@turf/point-on-feature';
import { featureCollection, point as turfPoint } from '@turf/helpers';

type Poly = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export function intersectAll(polygons: Poly[]): Poly | null {
    if (polygons.length === 0) return null;
    if (polygons.length === 1) return polygons[0];

    let acc: Poly | null = polygons[0];
    for (let i = 1; i < polygons.length; i++) {
        if (!acc) return null;
        const next = intersect(featureCollection([acc, polygons[i]])) as Poly | null;
        if (!next) return null;
        acc = next;
    }
    return acc;
}

export function centroidInside(polygon: Poly): GeoJSON.Position {
    const c = centroid(polygon);
    const cPoint = turfPoint(c.geometry.coordinates);
    if (booleanPointInPolygon(cPoint, polygon)) {
        return c.geometry.coordinates;
    }
    const fallback = pointOnFeature(polygon);
    return fallback.geometry.coordinates;
}

export function polygonArea(polygon: Poly): number {
    return area(polygon);
}

export function pointInPolygon(position: GeoJSON.Position, polygon: Poly): boolean {
    return booleanPointInPolygon(turfPoint(position), polygon);
}
