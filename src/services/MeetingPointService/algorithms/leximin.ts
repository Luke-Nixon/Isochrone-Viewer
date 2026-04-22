import { effectiveWeights } from '../shared/weights';
import { buildResult } from '../shared/buildResult';
import { buildCandidateRegion } from './candidateRegion';
import { MeetingPointError } from '../types';
import type { Person, PersonBands, MeetingResult, MeetingOptions, Candidate } from '../types';

function leximinCompare(a: number[], b: number[]): number {
    // Both inputs already sorted descending. Returns < 0 if a is preferred.
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
}

export function solveLeximin(
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

    const sorted: { candidate: Candidate; key: number[] }[] = reachable.map(c => ({
        candidate: c,
        key: [...c.times.map((t, i) => t * weights[i])].sort((a, b) => b - a),
    }));

    let best = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (leximinCompare(sorted[i].key, best.key) < 0) best = sorted[i];
    }

    return buildResult({
        people,
        weights,
        primary: best.candidate,
        intersection,
        samplesEvaluated: candidates.length,
    });
}
