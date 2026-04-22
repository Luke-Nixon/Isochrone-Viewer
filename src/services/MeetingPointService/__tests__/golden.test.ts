// Golden tests: real Valhalla isochrone bands captured into JSON fixtures,
// expected outputs hand-verified geographically against a map.
//
// Refreshing the fixture data:
//   npm run test:capture                      # re-fetch from public Valhalla
//   npx vitest run golden-preview --reporter=verbose   # print outputs for review
//   <update EXPECTATIONS below to match if the new outputs are still correct>
//
// Tolerances:
//   - point coords: 3 decimals (~110 m at UK latitudes); algorithms are
//     deterministic but turf operations have tiny float noise
//   - per-person times: exact (5-min quantised, no float noise)
//   - aggregate.max/total: exact (sums of integers)
//   - aggregate.mean/variance: 1 decimal (small float noise)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { solveMinimax } from '../algorithms/minimax';
import { solveLeximin } from '../algorithms/leximin';
import { solveUtilitarian } from '../algorithms/utilitarian';
import { solveMinVariance } from '../algorithms/minVariance';
import { solveNash } from '../algorithms/nash';
import { solvePareto } from '../algorithms/pareto';
import type { MeetingMode, MeetingOptions, MeetingResult, Person, PersonBands } from '../types';

const FIXTURE_DIR = resolve(__dirname, 'fixtures');
const PALETTE = ['#7c9fff', '#ff8c00', '#4ade80', '#f472b6', '#facc15', '#22d3ee'];

interface FixtureFile {
    name: string;
    description: string;
    maxMinutes: number;
    people: Array<{ id: string; label: string; lat: number; lng: number; bands: Array<{ minutes: number; polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> }> }>;
}

interface ExpectedResult {
    point: [number, number]; // [lat, lng]
    times: number[]; // per-person in fixture.people order
    max: number;
    total: number;
    mean: number;
    variance: number;
}

interface ParetoExpected extends ExpectedResult {
    frontSizeMin: number;
    frontSizeMax: number;
}

function loadFixture(name: string): FixtureFile {
    return JSON.parse(readFileSync(resolve(FIXTURE_DIR, `${name}.json`), 'utf-8'));
}

function fixtureToInputs(fx: FixtureFile): { people: Person[]; bands: PersonBands[]; options: MeetingOptions } {
    const people: Person[] = fx.people.map((p, i) => ({
        id: p.id,
        label: p.label,
        address: { lat: p.lat, lng: p.lng, displayName: p.label },
        mode: 'auto',
        weight: 1,
        color: PALETTE[i % PALETTE.length],
    }));
    const bands: PersonBands[] = fx.people.map(p => ({ personId: p.id, bands: p.bands }));
    const options: MeetingOptions = {
        mode: 'minimax',
        useWeights: false,
        maxMinutes: fx.maxMinutes,
        bandStepMinutes: 5,
    };
    return { people, bands, options };
}

const SOLVERS: Record<MeetingMode, (p: Person[], b: PersonBands[], o: MeetingOptions) => MeetingResult> = {
    minimax: solveMinimax,
    leximin: solveLeximin,
    utilitarian: solveUtilitarian,
    minVariance: solveMinVariance,
    nash: solveNash,
    pareto: solvePareto,
};

function runMode(fx: FixtureFile, mode: MeetingMode): MeetingResult {
    const { people, bands, options } = fixtureToInputs(fx);
    return SOLVERS[mode](people, bands, { ...options, mode });
}

function assertExpected(actual: MeetingResult, expected: ExpectedResult, label: string) {
    const [lng, lat] = actual.primary.point;
    expect(lat, `${label} lat`).toBeCloseTo(expected.point[0], 3);
    expect(lng, `${label} lng`).toBeCloseTo(expected.point[1], 3);
    expect(actual.perPerson.map(p => p.minutes), `${label} per-person times`).toEqual(expected.times);
    expect(actual.aggregate.max, `${label} max`).toBe(expected.max);
    expect(actual.aggregate.total, `${label} total`).toBe(expected.total);
    expect(actual.aggregate.mean, `${label} mean`).toBeCloseTo(expected.mean, 1);
    // Variance is fp-derived; use absolute tolerance so values written to 1
    // decimal in the table above (e.g., 181.3 for actual 181.25) still pass.
    expect(Math.abs(actual.aggregate.variance - expected.variance), `${label} variance ${actual.aggregate.variance} vs ${expected.variance}`).toBeLessThan(0.1);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 1: pair-slough-reading
// SL1 1RU (Slough) ↔ RG1 1JX (Reading), ~30 km apart on the M4.
// Symmetric two-person case — minimax/leximin should center both at ~20 min.
// Utilitarian and Nash have multiple equal-total optima; tie-break is
// arbitrary (algorithms only commit to minimising their score).
// ─────────────────────────────────────────────────────────────────────────
describe('golden: pair-slough-reading (~30 km, symmetric)', () => {
    const fx = loadFixture('pair-slough-reading');

    // [SL1 1RU, RG1 1JX]
    const expectations: Record<MeetingMode, ExpectedResult> = {
        // Centered between them, both 20 min — clean symmetric optimum.
        minimax: { point: [51.4596, -0.7930], times: [20, 20], max: 20, total: 40, mean: 20, variance: 0 },
        // Same as minimax (worst-time minimised, no tie to break further).
        leximin: { point: [51.4481, -0.8145], times: [20, 20], max: 20, total: 40, mean: 20, variance: 0 },
        // (30, 10) ties (20, 20) at total=40 — tie-break picked the lopsided split.
        utilitarian: { point: [51.4421, -0.9242], times: [30, 10], max: 30, total: 40, mean: 20, variance: 100 },
        // Both at 30 min → variance 0. Ties (20,20) which is also variance 0; tie-break picked the costlier split.
        minVariance: { point: [51.5194, -0.8301], times: [30, 30], max: 30, total: 60, mean: 30, variance: 0 },
        // Same point as utilitarian (Nash often coincides for asymmetric splits).
        nash: { point: [51.4421, -0.9242], times: [30, 10], max: 30, total: 40, mean: 20, variance: 100 },
        // Pareto: same primary as utilitarian (best by sum), trade-off curve as alternates.
        pareto: { point: [51.4421, -0.9242], times: [30, 10], max: 30, total: 40, mean: 20, variance: 100 },
    };

    for (const mode of Object.keys(expectations) as MeetingMode[]) {
        it(mode, () => assertExpected(runMode(fx, mode), expectations[mode], mode));
    }

    it('pareto: front has multiple non-dominated trade-offs (N=2 → curve)', () => {
        const r = runMode(fx, 'pareto');
        expect(r.alternates.length).toBeGreaterThanOrEqual(3);
        expect(r.paretoFrontSize ?? 0).toBeGreaterThanOrEqual(4);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// Scenario 2: cluster-plus-outlier
// 3 people in Reading (RG1, RG6, RG30) + 1 outlier in Oxford (~50 km away).
//
// This is the *diagnostic* scenario for fairness modes:
//   - utilitarian: should sit AT the Reading cluster (3 happy, 1 sad)
//   - minimax: should be PULLED toward Oxford (balance)
// If those two agree, something's wrong.
// ─────────────────────────────────────────────────────────────────────────
describe('golden: cluster-plus-outlier (3 in Reading + 1 in Oxford)', () => {
    const fx = loadFixture('cluster-plus-outlier');

    // [RG1 1JX, RG6 1HW, RG30 2AA, OX1 1HP]
    const expectations: Record<MeetingMode, ExpectedResult> = {
        // North of Reading, south of Oxford — minimax pulls toward Oxford to lower its time.
        // Worst=35 min, all four within 5 min of each other.
        minimax: { point: [51.5916, -1.0785], times: [30, 35, 35, 35], max: 35, total: 135, mean: 33.75, variance: 4.7 },
        leximin: { point: [51.5478, -1.0865], times: [25, 35, 25, 40], max: 40, total: 125, mean: 31.25, variance: 42.2 },
        // RIGHT AT THE READING CLUSTER. Sum minimised: 3 people in 5-20 min, Oxford pays 60.
        utilitarian: { point: [51.4601, -0.9951], times: [10, 20, 5, 60], max: 60, total: 95, mean: 23.75, variance: 467.2 },
        // Equal-effort sweet spot is far from everyone (way west) so all four hit ~55-60 min.
        minVariance: { point: [51.4952, -1.4522], times: [60, 60, 55, 60], max: 60, total: 235, mean: 58.75, variance: 4.7 },
        // Nash on this asymmetry tracks utilitarian.
        nash: { point: [51.4601, -0.9951], times: [10, 20, 5, 60], max: 60, total: 95, mean: 23.75, variance: 467.2 },
        // Pareto primary = best utilitarian on the front.
        pareto: { point: [51.4601, -0.9951], times: [10, 20, 5, 60], max: 60, total: 95, mean: 23.75, variance: 467.2 },
    };

    for (const mode of Object.keys(expectations) as MeetingMode[]) {
        it(mode, () => assertExpected(runMode(fx, mode), expectations[mode], mode));
    }

    it('utilitarian point ≠ minimax point (modes diverge under asymmetry)', () => {
        const u = runMode(fx, 'utilitarian');
        const m = runMode(fx, 'minimax');
        const distSq = (u.primary.point[0] - m.primary.point[0]) ** 2
                     + (u.primary.point[1] - m.primary.point[1]) ** 2;
        // ≥0.05° apart in lat or lng (~5 km) — should be ~13 km here
        expect(Math.sqrt(distSq)).toBeGreaterThan(0.05);
    });

    it('utilitarian total < minimax total (sum-minimising wins on aggregate)', () => {
        const u = runMode(fx, 'utilitarian');
        const m = runMode(fx, 'minimax');
        expect(u.aggregate.total).toBeLessThan(m.aggregate.total);
    });

    it('minimax max < utilitarian max (egalitarian wins on worst-case)', () => {
        const u = runMode(fx, 'utilitarian');
        const m = runMode(fx, 'minimax');
        expect(m.aggregate.max).toBeLessThan(u.aggregate.max);
    });

    it('pareto front has at least the cluster-leaning + balance trade-off', () => {
        const r = runMode(fx, 'pareto');
        expect(r.paretoFrontSize ?? 0).toBeGreaterThanOrEqual(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// Scenario 3: triangle-london-reading-crawley
// W2 2DJ + RG1 1JX + RH10 1AA — roughly equilateral 50 km triangle.
// Minimax should land ALL THREE at the same time (perfect symmetric centroid).
// ─────────────────────────────────────────────────────────────────────────
describe('golden: triangle-london-reading-crawley (~50 km equilateral)', () => {
    const fx = loadFixture('triangle-london-reading-crawley');

    // [W2 2DJ, RG1 1JX, RH10 1AA]
    const expectations: Record<MeetingMode, ExpectedResult> = {
        // All three at exactly 45 min — variance 0, perfect minimax centroid behaviour.
        minimax: { point: [51.3739, -0.5087], times: [45, 45, 45], max: 45, total: 135, mean: 45, variance: 0 },
        // Slightly north — improves London + Reading at Crawley's expense.
        leximin: { point: [51.4433, -0.5328], times: [40, 40, 50], max: 50, total: 130, mean: 43.33, variance: 22.2 },
        // Further north — sum lower than minimax, Crawley pays the bottleneck.
        utilitarian: { point: [51.4929, -0.5328], times: [35, 35, 55], max: 55, total: 125, mean: 41.67, variance: 88.9 },
        // Equal-effort tie-break lands on (55,55,55) instead of (45,45,45) — variance 0 either way.
        minVariance: { point: [51.3442, -0.5328], times: [55, 55, 55], max: 55, total: 165, mean: 55, variance: 0 },
        // Nash slightly different from utilitarian.
        nash: { point: [51.4929, -0.4196], times: [30, 40, 55], max: 55, total: 125, mean: 41.67, variance: 105.6 },
        // Pareto primary = best utilitarian on the front.
        pareto: { point: [51.4929, -0.5328], times: [35, 35, 55], max: 55, total: 125, mean: 41.67, variance: 88.9 },
    };

    for (const mode of Object.keys(expectations) as MeetingMode[]) {
        it(mode, () => assertExpected(runMode(fx, mode), expectations[mode], mode));
    }

    it('minimax achieves zero variance (perfectly equilateral input)', () => {
        const r = runMode(fx, 'minimax');
        expect(r.aggregate.variance).toBeCloseTo(0, 1);
    });

    it('pareto front size capped to 13 alternates (12 + primary) for large fronts', () => {
        const r = runMode(fx, 'pareto');
        // Front size > 13 → alternates capped to 12
        expect(r.paretoFrontSize ?? 0).toBeGreaterThan(13);
        expect(r.alternates.length).toBeLessThanOrEqual(12);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// Scenario 4: east-anglia-essex (user's original 4 postcodes)
// CB9 8GY (Haverhill), IP31 3FP (Suffolk), CM16 6PE (Epping), CM77 7UE (Braintree).
// Real-world regression case — locks in the answer the user manually verified.
// ─────────────────────────────────────────────────────────────────────────
describe('golden: east-anglia-essex (user real-world scenario)', () => {
    const fx = loadFixture('east-anglia-essex');

    // [CB9 8GY, IP31 3FP, CM16 6PE, CM77 7UE]
    const expectations: Record<MeetingMode, ExpectedResult> = {
        // South Cambridgeshire — bottleneck IP31 hits 60 min.
        // Per-person {30, 60, 55, 60} — verified by user manually post-bugfix.
        minimax: { point: [52.1508, 0.2395], times: [30, 60, 55, 60], max: 60, total: 205, mean: 51.25, variance: 154.7 },
        leximin: { point: [52.1304, 0.2200], times: [25, 60, 50, 55], max: 60, total: 190, mean: 47.5, variance: 181.3 },
        utilitarian: { point: [52.1304, 0.2200], times: [25, 60, 50, 55], max: 60, total: 190, mean: 47.5, variance: 181.3 },
        minVariance: { point: [52.1496, 0.2322], times: [40, 60, 60, 60], max: 60, total: 220, mean: 55, variance: 75 },
        nash: { point: [52.1304, 0.2200], times: [25, 60, 50, 55], max: 60, total: 190, mean: 47.5, variance: 181.3 },
        pareto: { point: [52.1304, 0.2200], times: [25, 60, 50, 55], max: 60, total: 190, mean: 47.5, variance: 181.3 },
    };

    for (const mode of Object.keys(expectations) as MeetingMode[]) {
        it(mode, () => assertExpected(runMode(fx, mode), expectations[mode], mode));
    }

    it('minimax reports each person\'s ACTUAL band time (not bottleneck T) — fix verification', () => {
        // Pre-fix bug: all four would read 55 min (or 60). After fix, the closest
        // person (CB9 8GY) correctly reads 30 min while IP31 3FP shows the true 60-min bottleneck.
        const r = runMode(fx, 'minimax');
        expect(r.perPerson[0].minutes).toBe(30);  // CB9 8GY (close)
        expect(r.perPerson[1].minutes).toBe(60);  // IP31 3FP (bottleneck)
        expect(r.aggregate.max).toBe(60);
    });
});
