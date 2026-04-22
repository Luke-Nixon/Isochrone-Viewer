import { intersectAll, centroidInside } from '../geometry';
import { findBandAtOrAbove, evaluateCandidate } from '../sampling';
import { effectiveWeights } from '../shared/weights';
import { buildResult } from '../shared/buildResult';
import { MeetingPointError } from '../types';
import type { Person, PersonBands, MeetingResult, MeetingOptions, Band } from '../types';

type Poly = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export function solveMinimax(
    people: Person[],
    personBands: PersonBands[],
    options: MeetingOptions,
): MeetingResult {
    const weights = effectiveWeights(people, options.useWeights);

    // Effective T = weight[i] * actual_time. Walk the union of all candidate
    // effective Ts (one per band per person) in ascending order.
    const effectiveTSet = new Set<number>();
    for (let i = 0; i < people.length; i++) {
        for (const b of personBands[i].bands) {
            effectiveTSet.add(b.minutes * weights[i]);
        }
    }
    const effectiveTs = Array.from(effectiveTSet).sort((a, b) => a - b);

    for (const effT of effectiveTs) {
        const polygons: Poly[] = [];
        let feasible = true;

        for (let i = 0; i < people.length; i++) {
            const targetActual = effT / weights[i];
            const band: Band | undefined = findBandAtOrAbove(personBands[i].bands, targetActual);
            if (!band) { feasible = false; break; }
            polygons.push(band.polygon);
        }

        if (!feasible) continue;
        const intersection = intersectAll(polygons);
        if (!intersection) continue;

        // The bands picked above are the *bottleneck* bands needed to make the
        // intersection non-empty. The centroid of that intersection is often
        // reachable by the non-bottleneck people in much less time. Look up
        // each person's smallest enclosing band at the chosen point so the
        // reported per-person times reflect actual travel time, not the
        // bottleneck T.
        const point = centroidInside(intersection);
        const actualTimes = evaluateCandidate(point, personBands);

        return buildResult({
            people,
            weights,
            primary: { point, times: actualTimes },
            intersection,
            samplesEvaluated: 1,
        });
    }

    throw new MeetingPointError(
        `No common reachable point within ${options.maxMinutes} minutes. Try increasing the max travel time.`,
        'no_intersection',
    );
}
