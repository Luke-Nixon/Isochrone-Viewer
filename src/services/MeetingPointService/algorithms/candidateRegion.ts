import { intersectAll } from '../geometry';
import { generateCandidateGrid, evaluateCandidate } from '../sampling';
import { MeetingPointError } from '../types';
import type { PersonBands, Candidate } from '../types';

type Poly = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export interface CandidateRegion {
    intersection: Poly;
    candidates: Candidate[];
}

/** Builds the candidate set: intersection of every person's largest band, sampled on a grid. */
export function buildCandidateRegion(
    personBands: PersonBands[],
    resolution = 30,
): CandidateRegion {
    const largestPolygons: Poly[] = personBands.map(pb => {
        const last = pb.bands[pb.bands.length - 1];
        if (!last) {
            throw new MeetingPointError('Provider returned no isochrone bands.', 'fetch_failed');
        }
        return last.polygon;
    });

    const intersection = intersectAll(largestPolygons);
    if (!intersection) {
        throw new MeetingPointError(
            'No common reachable area at the chosen max travel time. Try increasing it.',
            'no_intersection',
        );
    }

    const points = generateCandidateGrid(intersection, resolution);
    const candidates: Candidate[] = points.map(point => ({
        point,
        times: evaluateCandidate(point, personBands),
    }));

    return { intersection, candidates };
}
