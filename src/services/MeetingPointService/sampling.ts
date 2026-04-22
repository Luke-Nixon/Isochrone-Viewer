import bbox from '@turf/bbox';
import { pointInPolygon } from './geometry';
import type { Band, PersonBands } from './types';

type Poly = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export function generateCandidateGrid(polygon: Poly, resolution = 30): GeoJSON.Position[] {
    const [minLng, minLat, maxLng, maxLat] = bbox(polygon);
    const stepLng = (maxLng - minLng) / resolution;
    const stepLat = (maxLat - minLat) / resolution;
    const points: GeoJSON.Position[] = [];
    for (let i = 0; i <= resolution; i++) {
        for (let j = 0; j <= resolution; j++) {
            const point: GeoJSON.Position = [minLng + i * stepLng, minLat + j * stepLat];
            if (pointInPolygon(point, polygon)) points.push(point);
        }
    }
    return points;
}

export function getTimeAt(bands: Band[], point: GeoJSON.Position): number {
    for (const band of bands) {
        if (pointInPolygon(point, band.polygon)) return band.minutes;
    }
    return Infinity;
}

export function evaluateCandidate(point: GeoJSON.Position, personBands: PersonBands[]): number[] {
    return personBands.map(pb => getTimeAt(pb.bands, point));
}

export function findBandAtOrAbove(bands: Band[], targetMinutes: number): Band | undefined {
    return bands.find(b => b.minutes >= targetMinutes);
}
