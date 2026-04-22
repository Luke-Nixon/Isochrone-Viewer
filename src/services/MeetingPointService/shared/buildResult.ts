import { aggregate } from './stats';
import type { Person, MeetingResult, Candidate } from '../types';

type Poly = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export interface BuildResultArgs {
    people: Person[];
    weights: number[];
    primary: Candidate;
    alternates?: Candidate[];
    intersection?: Poly;
    samplesEvaluated: number;
    paretoFrontSize?: number;
}

export function buildResult(args: BuildResultArgs): MeetingResult {
    const { people, weights, primary, alternates = [], intersection, samplesEvaluated, paretoFrontSize } = args;

    const weighted = primary.times.map((t, i) => t * weights[i]);
    const hasNonUnitWeight = weights.some(w => w !== 1);

    return {
        primary,
        alternates,
        intersection,
        perPerson: people.map((p, i) => ({
            personId: p.id,
            label: p.label,
            color: p.color,
            minutes: primary.times[i],
            weight: weights[i],
            weightedMinutes: hasNonUnitWeight ? weighted[i] : undefined,
        })),
        aggregate: aggregate(primary.times),
        weightedAggregate: hasNonUnitWeight ? aggregate(weighted) : undefined,
        paretoFrontSize,
        debug: { samplesEvaluated, apiCallsMade: people.length },
    };
}
