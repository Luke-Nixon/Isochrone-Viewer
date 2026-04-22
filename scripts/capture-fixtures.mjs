// Capture real Valhalla isochrone bands for our golden test scenarios.
//
// Run with: node scripts/capture-fixtures.mjs
//
// Hits the public OSM Valhalla. Output → src/services/MeetingPointService/__tests__/fixtures/*.json
//
// Mirrors the chunking + pacing + retry rules in src/services/MeetingPointService/provider.ts
// so we exercise the same request shape the production code uses.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../src/services/MeetingPointService/__tests__/fixtures');

const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de';
const MAX_CONTOURS_PER_REQUEST = 4;
const PACING_MS = 250;
const RETRIABLE = new Set([429, 502, 503, 504]);

const SCENARIOS = [
    {
        name: 'pair-slough-reading',
        description: 'Two people ~30 km apart. Should be symmetric — all modes converge near halfway.',
        maxMinutes: 30,
        people: [
            { id: 'slough', label: 'SL1 1RU', lat: 51.51018, lng: -0.58237 },
            { id: 'reading', label: 'RG1 1JX', lat: 51.4577666, lng: -0.9718685 },
        ],
    },
    {
        name: 'cluster-plus-outlier',
        description: '3 people clustered in Reading + 1 outlier in Oxford ~50 km away. Utilitarian should lean toward the cluster; minimax should center between cluster and outlier.',
        maxMinutes: 60,
        people: [
            { id: 'reading_centre', label: 'RG1 1JX', lat: 51.4577666, lng: -0.9718685 },
            { id: 'reading_east',   label: 'RG6 1HW', lat: 51.4517551, lng: -0.9273858 },
            { id: 'reading_west',   label: 'RG30 2AA', lat: 51.4486874, lng: -0.9948317 },
            { id: 'oxford',         label: 'OX1 1HP', lat: 51.7536064, lng: -1.2685994 },
        ],
    },
    {
        name: 'triangle-london-reading-crawley',
        description: '3 people at corners of a roughly equilateral triangle (~50 km sides). Meeting point should be near the geographic centroid (south of London).',
        maxMinutes: 60,
        people: [
            { id: 'london',  label: 'W2 2DJ',   lat: 51.51711,    lng: -0.16805 },
            { id: 'reading', label: 'RG1 1JX',  lat: 51.4577666,  lng: -0.9718685 },
            { id: 'crawley', label: 'RH10 1AA', lat: 51.1168014,  lng: -0.1881621 },
        ],
    },
    {
        name: 'east-anglia-essex',
        description: "User's original 4-postcode scenario in East Anglia / Essex. Real-world regression case.",
        maxMinutes: 60,
        people: [
            { id: 'haverhill', label: 'CB9 8GY',  lat: 52.0828635, lng: 0.4349448 },
            { id: 'suffolk',   label: 'IP31 3FP', lat: 52.2548699, lng: 0.8153899 },
            { id: 'epping',    label: 'CM16 6PE', lat: 51.73521,   lng: 0.09486 },
            { id: 'braintree', label: 'CM77 7UE', lat: 51.8588328, lng: 0.5267644 },
        ],
    },
];

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function fetchIsochrone(person, contourMinutes, attempt = 0) {
    const body = {
        locations: [{ lon: person.lng, lat: person.lat }],
        costing: 'auto',
        contours: contourMinutes.map(t => ({ time: t })),
        polygons: true,
    };

    try {
        const res = await fetch(`${VALHALLA_BASE}/isochrone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            if (RETRIABLE.has(res.status) && attempt < 4) {
                const backoff = 500 * 2 ** attempt;
                console.warn(`    HTTP ${res.status} for ${person.label} ${contourMinutes.join(',')}, retrying in ${backoff}ms`);
                await delay(backoff);
                return fetchIsochrone(person, contourMinutes, attempt + 1);
            }
            const txt = await res.text().catch(() => '');
            throw new Error(`Valhalla HTTP ${res.status}: ${txt.slice(0, 200)}`);
        }
        return res.json();
    } catch (e) {
        if (e instanceof TypeError && attempt < 4) {
            const backoff = 500 * 2 ** attempt;
            console.warn(`    Network error for ${person.label} ${contourMinutes.join(',')}, retrying in ${backoff}ms`);
            await delay(backoff);
            return fetchIsochrone(person, contourMinutes, attempt + 1);
        }
        throw e;
    }
}

async function captureBands(person, maxMinutes) {
    const minutes = [];
    for (let m = 5; m <= maxMinutes; m += 5) minutes.push(m);
    const chunks = chunk(minutes, MAX_CONTOURS_PER_REQUEST);

    const bands = [];
    for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await delay(PACING_MS);
        process.stdout.write(`    chunk ${i + 1}/${chunks.length} (${chunks[i].join(',')} min)... `);
        const t0 = Date.now();
        const resp = await fetchIsochrone(person, chunks[i]);
        const ms = Date.now() - t0;
        for (const f of resp.features) {
            bands.push({ minutes: f.properties.contour, polygon: f });
        }
        console.log(`done in ${ms}ms`);
    }
    bands.sort((a, b) => a.minutes - b.minutes);
    return bands;
}

async function captureScenario(scenario) {
    console.log(`\n[${scenario.name}] ${scenario.description}`);
    const out = {
        name: scenario.name,
        description: scenario.description,
        maxMinutes: scenario.maxMinutes,
        capturedAt: new Date().toISOString(),
        people: [],
    };

    for (const person of scenario.people) {
        console.log(`  ${person.label} (${person.id})`);
        const bands = await captureBands(person, scenario.maxMinutes);
        out.people.push({
            id: person.id,
            label: person.label,
            lat: person.lat,
            lng: person.lng,
            bands,
        });
    }

    const path = resolve(FIXTURE_DIR, `${scenario.name}.json`);
    writeFileSync(path, JSON.stringify(out));
    const sizeKB = (JSON.stringify(out).length / 1024).toFixed(1);
    console.log(`  ✓ saved ${path} (${sizeKB} KB)`);
}

async function main() {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    console.log(`Capturing ${SCENARIOS.length} scenarios → ${FIXTURE_DIR}`);
    const t0 = Date.now();
    for (const s of SCENARIOS) {
        try {
            await captureScenario(s);
        } catch (e) {
            console.error(`  ✗ ${s.name} failed: ${e.message}`);
        }
    }
    console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
