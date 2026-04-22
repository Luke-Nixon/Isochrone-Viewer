import { effectiveWeights } from '../shared/weights';
import { utilitarianScore } from '../shared/scoring';
import { buildResult } from '../shared/buildResult';
import { buildCandidateRegion } from './candidateRegion';
import { MeetingPointError } from '../types';
import type { Person, PersonBands, MeetingResult, MeetingOptions, Candidate } from '../types';

const MAX_ALTERNATES = 12;

function dominates(a: number[], b: number[]): boolean {
    let strict = false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] > b[i]) return false;
        if (a[i] < b[i]) strict = true;
    }
    return strict;
}

export function solvePareto(
    people: Person[],
    personBands: PersonBands[],
    options: MeetingOptions,
): MeetingResult {
    const weights = effectiveWeights(people, options.useWeights);
    const { intersection, candidates } = buildCandidateRegion(personBands);

    const reachable = candidates.filter(c => c.times.every(Number.isFinite));
    if (reachable.length === 0) {
        throw new MeetingPointError('No candidate points are reachable by everyone.', 'no_intersection');
    }

    const weighted = reachable.map(c => c.times.map((t, i) => t * weights[i]));

    const front: Candidate[] = [];
    for (let i = 0; i < reachable.length; i++) {
        let dominated = false;
        for (let j = 0; j < reachable.length; j++) {
            if (i === j) continue;
            if (dominates(weighted[j], weighted[i])) { dominated = true; break; }
        }
        if (!dominated) front.push(reachable[i]);
    }

    if (front.length === 0) {
        throw new MeetingPointError('Empty Pareto front (unexpected).', 'no_intersection');
    }

    front.sort((a, b) => utilitarianScore(a.times, weights) - utilitarianScore(b.times, weights));

    const primary = front[0];
    const alternates = front.slice(1, 1 + MAX_ALTERNATES);

    return buildResult({
        people,
        weights,
        primary,
        alternates,
        intersection,
        samplesEvaluated: candidates.length,
        paretoFrontSize: front.length,
    });
}
