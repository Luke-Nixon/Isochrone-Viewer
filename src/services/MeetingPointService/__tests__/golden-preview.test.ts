// One-shot preview to print algorithm outputs for each fixture.
// Run with: npx vitest run src/services/MeetingPointService/__tests__/golden-preview.test.ts --reporter=verbose
//
// Use this when adding/changing fixtures to hand-verify the outputs are
// geographically sensible BEFORE committing them as golden expected values.

import { describe, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { solveMinimax } from '../algorithms/minimax';
import { solveLeximin } from '../algorithms/leximin';
import { solveUtilitarian } from '../algorithms/utilitarian';
import { solveMinVariance } from '../algorithms/minVariance';
import { solveNash } from '../algorithms/nash';
import { solvePareto } from '../algorithms/pareto';
import type { MeetingMode, MeetingOptions, Person, PersonBands, MeetingResult } from '../types';

const FIXTURE_DIR = resolve(__dirname, 'fixtures');

interface FixtureFile {
    name: string;
    description: string;
    maxMinutes: number;
    people: Array<{ id: string; label: string; lat: number; lng: number; bands: Array<{ minutes: number; polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> }> }>;
}

const palette = ['#7c9fff', '#ff8c00', '#4ade80', '#f472b6', '#facc15', '#22d3ee'];

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
        color: palette[i % palette.length],
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

function format(r: MeetingResult, mode: MeetingMode): string {
    const [lng, lat] = r.primary.point;
    const lines: string[] = [];
    lines.push(`    [${mode.padEnd(11)}] (${lat.toFixed(4)}, ${lng.toFixed(4)})  worst=${r.aggregate.max.toFixed(0)}m  total=${r.aggregate.total.toFixed(0)}m  mean=${r.aggregate.mean.toFixed(0)}m  σ²=${r.aggregate.variance.toFixed(1)}`);
    lines.push(`                  per-person: ${r.perPerson.map(p => `${p.label}=${p.minutes.toFixed(0)}m`).join('  ')}`);
    if (r.alternates.length > 0) {
        lines.push(`                  alternates: ${r.alternates.length} (front size ${r.paretoFrontSize ?? '?'})`);
    }
    return lines.join('\n');
}

// Skipped by default — flip to `describe.only` (or remove `.skip`) to run when
// refreshing fixtures. Output prints algorithm results so you can hand-verify
// before updating EXPECTATIONS in golden.test.ts.
describe.skip('golden-preview', () => {
    const fixtureFiles = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.json'));

    for (const file of fixtureFiles) {
        const fx = loadFixture(file.replace('.json', ''));
        it(`${fx.name}`, () => {
            const { people, bands, options } = fixtureToInputs(fx);
            console.log(`\n  ${fx.name} — ${fx.description}`);
            console.log(`  People: ${fx.people.map(p => `${p.label}(${p.lat.toFixed(3)},${p.lng.toFixed(3)})`).join(', ')}`);
            for (const mode of Object.keys(SOLVERS) as MeetingMode[]) {
                try {
                    const result = SOLVERS[mode](people, bands, { ...options, mode });
                    console.log(format(result, mode));
                } catch (e) {
                    console.log(`    [${mode.padEnd(11)}] ERROR: ${e instanceof Error ? e.message : e}`);
                }
            }
        });
    }
});
