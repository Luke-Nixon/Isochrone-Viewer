import { describe, it, expect } from 'vitest';
import { bandsAt, makePerson } from './fixtures';
import { solveMinimax } from '../algorithms/minimax';
import { solveLeximin } from '../algorithms/leximin';
import { solveUtilitarian } from '../algorithms/utilitarian';
import { solveMinVariance } from '../algorithms/minVariance';
import { solveNash } from '../algorithms/nash';
import { solvePareto } from '../algorithms/pareto';
import { buildCandidateRegion } from '../algorithms/candidateRegion';
import { effectiveWeights } from '../shared/weights';
import { utilitarianScore, varianceScore, nashScore } from '../shared/scoring';
import type { MeetingOptions, Person, PersonBands } from '../types';

const STEPS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function baseOptions(overrides: Partial<MeetingOptions> = {}): MeetingOptions {
    return {
        mode: 'minimax',
        useWeights: false,
        maxMinutes: 50,
        bandStepMinutes: 5,
        ...overrides,
    };
}

// Three-person setup where bands meaningfully overlap.
// Using kmPerMinute=5 (highway-ish). Distances between people: ~11, 22, 11 km.
// So intersection appears roughly around 10-15 min bands.
function threePeople(): { people: Person[]; bands: PersonBands[] } {
    const people = [
        makePerson('A', 'A', 50.00, 0.00, '#7c9fff'),
        makePerson('B', 'B', 50.10, 0.00, '#ff8c00'),
        makePerson('C', 'C', 50.05, 0.10, '#4ade80'),
    ];
    const bands = [
        bandsAt('A', 50.00, 0.00, STEPS, 5),
        bandsAt('B', 50.10, 0.00, STEPS, 5),
        bandsAt('C', 50.05, 0.10, STEPS, 5),
    ];
    return { people, bands };
}

function asymmetric(): { people: Person[]; bands: PersonBands[] } {
    // A is far from B,C; utilitarian should favor a point closer to B,C.
    // Minimax should balance toward A since A is the bottleneck.
    const people = [
        makePerson('A', 'A', 50.00, 0.00),
        makePerson('B', 'B', 50.20, 0.00),
        makePerson('C', 'C', 50.22, 0.02),
    ];
    const bands = [
        bandsAt('A', 50.00, 0.00, STEPS, 5),
        bandsAt('B', 50.20, 0.00, STEPS, 5),
        bandsAt('C', 50.22, 0.02, STEPS, 5),
    ];
    return { people, bands };
}

describe('solveMinimax', () => {
    it('reports each person\'s actual band time at the chosen point (not the bottleneck T)', () => {
        const { people, bands } = threePeople();
        const result = solveMinimax(people, bands, baseOptions());

        // Per-person times should all be finite and ≤ maxMinutes
        for (const stat of result.perPerson) {
            expect(stat.minutes).toBeGreaterThan(0);
            expect(stat.minutes).toBeLessThanOrEqual(50);
            expect(Number.isFinite(stat.minutes)).toBe(true);
        }
        // aggregate.max should equal max of per-person times
        const maxTime = Math.max(...result.perPerson.map(p => p.minutes));
        expect(result.aggregate.max).toBe(maxTime);
    });

    it('finds a lower max-time than any brute-force alternative', () => {
        const { people, bands } = threePeople();
        const options = baseOptions();
        const result = solveMinimax(people, bands, options);

        // Brute force: evaluate every candidate, find min of max(times).
        const { candidates } = buildCandidateRegion(bands);
        let bruteMinOfMax = Infinity;
        for (const c of candidates) {
            if (c.times.some(t => !Number.isFinite(t))) continue;
            const maxT = Math.max(...c.times);
            if (maxT < bruteMinOfMax) bruteMinOfMax = maxT;
        }

        // The algorithm's worst should be ≤ brute-force min-of-max
        // (equal when the algorithm finds the optimum; never worse).
        expect(result.aggregate.max).toBeLessThanOrEqual(bruteMinOfMax);
    });
});

describe('solveUtilitarian', () => {
    it('minimises total travel time vs brute force', () => {
        const { people, bands } = asymmetric();
        const options = baseOptions({ mode: 'utilitarian' });
        const result = solveUtilitarian(people, bands, options);

        const { candidates } = buildCandidateRegion(bands);
        const weights = effectiveWeights(people, options.useWeights);
        let bruteMin = Infinity;
        for (const c of candidates) {
            if (c.times.some(t => !Number.isFinite(t))) continue;
            const s = utilitarianScore(c.times, weights);
            if (s < bruteMin) bruteMin = s;
        }

        const resultScore = utilitarianScore(result.primary.times, weights);
        expect(resultScore).toBeCloseTo(bruteMin, 5);
    });

    it('has lower total than minimax on asymmetric layouts', () => {
        const { people, bands } = asymmetric();
        const util = solveUtilitarian(people, bands, baseOptions({ mode: 'utilitarian' }));
        const mm = solveMinimax(people, bands, baseOptions());
        expect(util.aggregate.total).toBeLessThanOrEqual(mm.aggregate.total);
    });
});

describe('solveMinVariance', () => {
    it('minimises variance vs brute force', () => {
        const { people, bands } = threePeople();
        const options = baseOptions({ mode: 'minVariance' });
        const result = solveMinVariance(people, bands, options);

        const { candidates } = buildCandidateRegion(bands);
        const weights = effectiveWeights(people, options.useWeights);
        let bruteMin = Infinity;
        for (const c of candidates) {
            if (c.times.some(t => !Number.isFinite(t))) continue;
            const s = varianceScore(c.times, weights);
            if (s < bruteMin) bruteMin = s;
        }

        const resultScore = varianceScore(result.primary.times, weights);
        expect(resultScore).toBeCloseTo(bruteMin, 5);
    });
});

describe('solveNash', () => {
    it('minimises sum of log(times) vs brute force', () => {
        const { people, bands } = asymmetric();
        const options = baseOptions({ mode: 'nash' });
        const result = solveNash(people, bands, options);

        const { candidates } = buildCandidateRegion(bands);
        const weights = effectiveWeights(people, options.useWeights);
        let bruteMin = Infinity;
        for (const c of candidates) {
            if (c.times.some(t => !Number.isFinite(t))) continue;
            const s = nashScore(c.times, weights);
            if (s < bruteMin) bruteMin = s;
        }

        const resultScore = nashScore(result.primary.times, weights);
        expect(resultScore).toBeCloseTo(bruteMin, 5);
    });
});

describe('solveLeximin', () => {
    it('picks candidate with lexicographically smallest sorted-descending time vector', () => {
        const { people, bands } = asymmetric();
        const options = baseOptions({ mode: 'leximin' });
        const result = solveLeximin(people, bands, options);

        const { candidates } = buildCandidateRegion(bands);
        const resultKey = [...result.primary.times].sort((a, b) => b - a);

        // For every reachable candidate, resultKey should be lex-smaller-or-equal.
        for (const c of candidates) {
            if (c.times.some(t => !Number.isFinite(t))) continue;
            const candKey = [...c.times].sort((a, b) => b - a);
            // lex compare: find first index where they differ
            for (let i = 0; i < resultKey.length; i++) {
                if (resultKey[i] < candKey[i]) break; // result strictly better — fine
                if (resultKey[i] > candKey[i]) {
                    // result is lex-worse than candKey — violation
                    throw new Error(`Leximin not optimal: picked ${JSON.stringify(resultKey)}, candidate ${JSON.stringify(candKey)} is lex-better`);
                }
            }
        }
    });
});

describe('solvePareto', () => {
    it('every alternate + primary is Pareto-optimal (no other reachable candidate dominates it)', () => {
        const { people, bands } = asymmetric();
        const result = solvePareto(people, bands, baseOptions({ mode: 'pareto' }));

        const { candidates } = buildCandidateRegion(bands);
        const reachable = candidates.filter(c => c.times.every(Number.isFinite));

        const check = (times: number[]) => {
            for (const other of reachable) {
                let strictlyBetter = false;
                let anyWorse = false;
                for (let i = 0; i < times.length; i++) {
                    if (other.times[i] < times[i]) strictlyBetter = true;
                    else if (other.times[i] > times[i]) { anyWorse = true; break; }
                }
                if (strictlyBetter && !anyWorse) {
                    throw new Error(`Candidate dominated: ${JSON.stringify(times)} vs ${JSON.stringify(other.times)}`);
                }
            }
        };

        check(result.primary.times);
        for (const alt of result.alternates) check(alt.times);
    });

    it('returns at least one point (primary)', () => {
        const { people, bands } = asymmetric();
        const result = solvePareto(people, bands, baseOptions({ mode: 'pareto' }));
        expect(result.primary).toBeDefined();
        expect(result.primary.times.every(t => Number.isFinite(t))).toBe(true);
    });
});

describe('weighted variants', () => {
    it('weighted minimax shifts point toward the heavier person', () => {
        const people = [
            makePerson('A', 'A', 50.00, 0.00, '#7c9fff', 3.0), // heavy weight
            makePerson('B', 'B', 50.20, 0.00, '#ff8c00', 1.0),
        ];
        const bands = [
            bandsAt('A', 50.00, 0.00, STEPS, 5),
            bandsAt('B', 50.20, 0.00, STEPS, 5),
        ];

        const unweighted = solveMinimax(people, bands, baseOptions());
        const weighted = solveMinimax(people, bands, baseOptions({ useWeights: true }));

        // Unweighted minimax centers between A and B. Weighted (A is heavy)
        // should pull the point closer to A → A's time shorter, B's time longer.
        const aUnw = unweighted.perPerson[0].minutes;
        const aWt = weighted.perPerson[0].minutes;
        expect(aWt).toBeLessThanOrEqual(aUnw);
    });

    it('weighted utilitarian with A weight = 3 prefers points closer to A', () => {
        const people = [
            makePerson('A', 'A', 50.00, 0.00, '#7c9fff', 3.0),
            makePerson('B', 'B', 50.20, 0.00, '#ff8c00', 1.0),
        ];
        const bands = [
            bandsAt('A', 50.00, 0.00, STEPS, 5),
            bandsAt('B', 50.20, 0.00, STEPS, 5),
        ];

        const unweighted = solveUtilitarian(people, bands, baseOptions({ mode: 'utilitarian' }));
        const weighted = solveUtilitarian(people, bands, baseOptions({ mode: 'utilitarian', useWeights: true }));

        expect(weighted.perPerson[0].minutes).toBeLessThanOrEqual(unweighted.perPerson[0].minutes);
        expect(weighted.perPerson[1].minutes).toBeGreaterThanOrEqual(unweighted.perPerson[1].minutes);
    });
});

describe('aggregate stats', () => {
    it('aggregate correctly reflects per-person times', () => {
        const { people, bands } = threePeople();
        const result = solveMinimax(people, bands, baseOptions());

        const times = result.perPerson.map(p => p.minutes);
        const total = times.reduce((s, t) => s + t, 0);
        const mean = total / times.length;
        const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;

        expect(result.aggregate.total).toBeCloseTo(total, 5);
        expect(result.aggregate.mean).toBeCloseTo(mean, 5);
        expect(result.aggregate.variance).toBeCloseTo(variance, 5);
        expect(result.aggregate.max).toBe(Math.max(...times));
    });

    it('weightedAggregate is set when weights are non-uniform, undefined otherwise', () => {
        const { people, bands } = threePeople();
        const unw = solveMinimax(people, bands, baseOptions());
        expect(unw.weightedAggregate).toBeUndefined();

        const weighted = solveMinimax(
            [makePerson('A', 'A', 50.00, 0.00, '#fff', 2.0), ...people.slice(1)],
            bands,
            baseOptions({ useWeights: true }),
        );
        expect(weighted.weightedAggregate).toBeDefined();
    });
});
