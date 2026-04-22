import { effectiveWeights } from './weights';
import { buildResult } from './buildResult';
import { buildCandidateRegion } from '../algorithms/candidateRegion';
import { MeetingPointError } from '../types';
import type { Person, PersonBands, MeetingResult, MeetingOptions } from '../types';

export type CandidateScoreFn = (times: number[], weights: number[]) => number;

export function solveByCandidateScore(
    people: Person[],
    personBands: PersonBands[],
    options: MeetingOptions,
    score: CandidateScoreFn,
): MeetingResult {
    const weights = effectiveWeights(people, options.useWeights);
    const { intersection, candidates } = buildCandidateRegion(personBands);

    const reachable = candidates.filter(c => c.times.every(Number.isFinite));
    if (reachable.length === 0) {
        throw new MeetingPointError('No candidate points are reachable by everyone.', 'no_intersection');
    }

    let best = reachable[0];
    let bestScore = score(best.times, weights);
    for (let i = 1; i < reachable.length; i++) {
        const s = score(reachable[i].times, weights);
        if (s < bestScore) { best = reachable[i]; bestScore = s; }
    }

    return buildResult({
        people,
        weights,
        primary: best,
        intersection,
        samplesEvaluated: candidates.length,
    });
}
