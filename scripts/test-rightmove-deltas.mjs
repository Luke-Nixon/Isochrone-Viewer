// Analyse max consecutive vertex delta (lat and lng) for:
//   - Uniform-resampled rings, pts 8-40 (known OK/FAIL from prior runs)
//   - Convex hull of 30-min and 60-min isochrones
//   - Three known-good Rightmove polylines from test-polyline.mjs
// No HTTP requests to Rightmove — uses previously observed pass/fail results.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';

// ── Known pass/fail from previous full run (pts 8-40, CM77 7UE 30-min) ────────
const KNOWN = {
    8:  'FAIL', 9:  'FAIL', 10: 'OK',   11: 'FAIL', 12: 'OK',
    13: 'FAIL', 14: 'FAIL', 15: 'FAIL', 16: 'FAIL', 17: 'FAIL',
    18: 'OK',   19: 'FAIL', 20: 'OK',   21: 'FAIL', 22: 'OK',
    23: 'FAIL', 24: 'FAIL', 25: 'FAIL', 26: 'FAIL', 27: 'FAIL',
    28: 'FAIL', 29: 'FAIL', 30: 'FAIL', 31: 'FAIL', 32: 'FAIL',
    33: 'FAIL', 34: 'FAIL', 35: 'FAIL', 36: 'FAIL', 37: 'FAIL',
    38: 'FAIL', 39: 'FAIL', 40: 'FAIL',
};

// ── Known-good polylines from test-polyline.mjs (actual string values) ────────
const KNOWN_GOOD_POLYLINES = [
    { label: 'known-good #1 (10 pts)', encoded: '_be}Ha`uBjhBiCi@kmGcN?_pA|[_AzjE}D~j@?cA' },
    { label: 'known-good #2 (30 pts)', encoded: 'ki`}HuenBw|Dl_d@_jVdzRspFhkSdzHlx`@bwPdzRdpIkoFtqF}hRqIijp@~eJztAxfIljZnqJngJr|JoyCl}H_pUt~@gjp@erLcu|@vhD}yh@ufNinc@yqIor@c}Ex{D_sClw}@m|Fx~TipJxbHr^njZci@oyC' },
    // backslashes in JS source represent literal \ in the string value
    { label: 'known-good #3 (~60 pts)', encoded: 'qig}HmvaEsAjbQzlDzKrA~\\gDrlCcrD`]fDx{DbrDhCoIpwDytDbP~[vfFzlDa]gDfn@qf@lTquBdP|Ffpb@ncAha@hmChC`q@{KeLm~RxeB}i@pf@gjBmQssFq}By}CtrCqwDlQ}gAyk@c`E}zBslCbeDsjD~[qpAon@kkHybCy}CbkBglA~x@ewB_\\_kF{eBqwDksAqG{c@re@fDpnB~x@hjB_y@ppAg~@?hDqpAqf@cyAy`A{KeLdPus@duClQ`bDfD?' },
];

// ── Google Encoded Polyline decoder ───────────────────────────────────────────

function decodePolyline(encoded) {
    const coords = [];
    let lat = 0, lng = 0, i = 0;
    while (i < encoded.length) {
        let result = 0, shift = 0, b;
        do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        result = 0; shift = 0;
        do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coords.push([lat / 1e5, lng / 1e5]);
    }
    return coords;
}

// ── Google Encoded Polyline encoder ───────────────────────────────────────────

function encodeValue(value) {
    let v = Math.round(value * 1e5);
    v = v < 0 ? ~(v << 1) : (v << 1);
    let result = '';
    while (v >= 0x20) {
        result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
        v >>= 5;
    }
    result += String.fromCharCode(v + 63);
    return result;
}

function encodePolyline(latLngs) {
    let result = '', prevLat = 0, prevLng = 0;
    for (const [lat, lng] of latLngs) {
        result += encodeValue(lat - prevLat);
        result += encodeValue(lng - prevLng);
        prevLat = lat;
        prevLng = lng;
    }
    return result;
}

// ── Ring helpers ──────────────────────────────────────────────────────────────

function simplifyRing(ring, maxPoints) {
    if (ring.length <= maxPoints) return ring;
    const step = (ring.length - 1) / (maxPoints - 1);
    const result = [];
    for (let i = 0; i < maxPoints - 1; i++) result.push(ring[Math.round(i * step)]);
    result.push(ring[ring.length - 1]);
    return result;
}

function forceClose(ring) {
    if (ring.length === 0) return ring;
    const result = [...ring];
    result[result.length - 1] = [result[0][0], result[0][1]];
    return result;
}

// ── Convex hull (gift wrapping) ───────────────────────────────────────────────

function cross(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points) {
    let start = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i][0] < points[start][0] ||
           (points[i][0] === points[start][0] && points[i][1] < points[start][1]))
            start = i;
    }
    const hull = [];
    let current = start;
    do {
        hull.push(points[current]);
        let next = (current + 1) % points.length;
        for (let i = 0; i < points.length; i++) {
            if (cross(points[current], points[next], points[i]) < 0) next = i;
        }
        current = next;
    } while (current !== start);
    hull.push(hull[0]);
    return hull;
}

// ── Delta stats ───────────────────────────────────────────────────────────────

function deltaStats(ring) {
    let maxDLat = 0, maxDLng = 0;
    let maxDLatIdx = -1, maxDLngIdx = -1;
    for (let i = 0; i < ring.length - 1; i++) {
        const dLat = Math.abs(ring[i + 1][0] - ring[i][0]);
        const dLng = Math.abs(ring[i + 1][1] - ring[i][1]);
        if (dLat > maxDLat) { maxDLat = dLat; maxDLatIdx = i; }
        if (dLng > maxDLng) { maxDLng = dLng; maxDLngIdx = i; }
    }
    return {
        maxDLat, maxDLng,
        maxDelta: Math.max(maxDLat, maxDLng),
        maxDLatIdx, maxDLngIdx,
    };
}

// ── Network ───────────────────────────────────────────────────────────────────

async function geocode(postcode) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    if (!data.length) throw new Error(`No result for ${postcode}`);
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function getIsochrone(lat, lng, minutes) {
    const res = await fetch('https://valhalla1.openstreetmap.de/isochrone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ locations: [{ lon: lng, lat }], costing: 'auto', contours: [{ time: minutes }], polygons: true }),
    });
    if (!res.ok) throw new Error(`Valhalla ${res.status}`);
    const data = await res.json();
    const feature = data.features[0];
    const ring = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0][0];
    return ring.map(([lng, lat]) => [lat, lng]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Geocoding CM77 7UE...');
const { lat, lng } = await geocode('CM77 7UE');
console.log(`lat=${lat}, lng=${lng}\n`);

console.log('Fetching 30-min isochrone...');
const raw30 = await getIsochrone(lat, lng, 30);
console.log(`30-min raw ring: ${raw30.length} points`);

console.log('Fetching 60-min isochrone...');
const raw60 = await getIsochrone(lat, lng, 60);
console.log(`60-min raw ring: ${raw60.length} points\n`);

// ── Collect all rows ──────────────────────────────────────────────────────────

const rows = [];

// 1. Uniform resampled, pts 8-40 (30-min isochrone)
for (let pc = 8; pc <= 40; pc++) {
    let ring = simplifyRing(raw30, pc);
    ring = forceClose(ring);
    const stats = deltaStats(ring);
    rows.push({
        method: `uniform-30min`,
        pts: pc,
        result: KNOWN[pc] ?? '?',
        ...stats,
        ring,
    });
}

// 2. Convex hull — 30-min
const hull30 = convexHull(raw30);
const stats30 = deltaStats(hull30);
rows.push({
    method: 'hull-30min',
    pts: hull30.length - 1,
    result: 'FAIL', // observed in previous run
    ...stats30,
    ring: hull30,
});

// 3. Convex hull — 60-min
const hull60 = convexHull(raw60);
const stats60 = deltaStats(hull60);
rows.push({
    method: 'hull-60min',
    pts: hull60.length - 1,
    result: 'FAIL', // observed in previous run
    ...stats60,
    ring: hull60,
});

// 4. Known-good Rightmove polylines
for (const { label, encoded } of KNOWN_GOOD_POLYLINES) {
    const ring = decodePolyline(encoded);
    const stats = deltaStats(ring);
    rows.push({
        method: label,
        pts: ring.length,
        result: 'OK',
        ...stats,
        ring,
    });
}

// ── Main table ────────────────────────────────────────────────────────────────

console.log('='.repeat(90));
console.log('DELTA ANALYSIS TABLE');
console.log('='.repeat(90));
console.log(
    `${'method'.padEnd(24)} | ${'pts'.padStart(4)} | ${'result'.padStart(6)} | ${'max_Δlat'.padStart(10)} | ${'max_Δlng'.padStart(10)} | ${'max_Δ'.padStart(10)}`
);
console.log(`${'-'.repeat(24)}-+-${'-'.repeat(4)}-+-${'-'.repeat(6)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}`);

for (const r of rows) {
    const flag = r.result === 'OK' ? '  ' : '<<';
    console.log(
        `${r.method.padEnd(24)} | ${String(r.pts).padStart(4)} | ${r.result.padStart(6)} | ${r.maxDLat.toFixed(6).padStart(10)} | ${r.maxDLng.toFixed(6).padStart(10)} | ${r.maxDelta.toFixed(6).padStart(10)} ${flag}`
    );
}

// ── Separate OK vs FAIL stats ─────────────────────────────────────────────────

const okRows   = rows.filter(r => r.result === 'OK');
const failRows = rows.filter(r => r.result === 'FAIL');

const maxOf = (arr, key) => Math.max(...arr.map(r => r[key]));
const minOf = (arr, key) => Math.min(...arr.map(r => r[key]));

console.log('\n' + '='.repeat(60));
console.log('THRESHOLD ANALYSIS');
console.log('='.repeat(60));
console.log(`OK   rows: ${okRows.length}`);
console.log(`  max_Δlat range: ${minOf(okRows,'maxDLat').toFixed(6)} – ${maxOf(okRows,'maxDLat').toFixed(6)}`);
console.log(`  max_Δlng range: ${minOf(okRows,'maxDLng').toFixed(6)} – ${maxOf(okRows,'maxDLng').toFixed(6)}`);
console.log(`  max_Δ    range: ${minOf(okRows,'maxDelta').toFixed(6)} – ${maxOf(okRows,'maxDelta').toFixed(6)}`);
console.log(`FAIL rows: ${failRows.length}`);
console.log(`  max_Δlat range: ${minOf(failRows,'maxDLat').toFixed(6)} – ${maxOf(failRows,'maxDLat').toFixed(6)}`);
console.log(`  max_Δlng range: ${minOf(failRows,'maxDLng').toFixed(6)} – ${maxOf(failRows,'maxDLng').toFixed(6)}`);
console.log(`  max_Δ    range: ${minOf(failRows,'maxDelta').toFixed(6)} – ${maxOf(failRows,'maxDelta').toFixed(6)}`);

// Find the largest max_Δ among OK rows and smallest among FAIL rows
const okMaxDelta   = maxOf(okRows, 'maxDelta');
const failMinDelta = minOf(failRows, 'maxDelta');
console.log(`\nLargest  max_Δ in OK rows:   ${okMaxDelta.toFixed(6)}`);
console.log(`Smallest max_Δ in FAIL rows: ${failMinDelta.toFixed(6)}`);
if (failMinDelta > okMaxDelta) {
    console.log(`\n*** CLEAN THRESHOLD EXISTS between ${okMaxDelta.toFixed(6)} and ${failMinDelta.toFixed(6)} ***`);
} else {
    console.log(`\nNo clean threshold — ranges overlap (OK max ${okMaxDelta.toFixed(6)} > FAIL min ${failMinDelta.toFixed(6)})`);
    // Show which OK rows have high deltas and which FAIL rows have low deltas
    const overlap = rows.filter(r =>
        (r.result === 'OK'   && r.maxDelta >= failMinDelta) ||
        (r.result === 'FAIL' && r.maxDelta <= okMaxDelta)
    );
    if (overlap.length) {
        console.log('Overlapping rows:');
        for (const r of overlap) {
            console.log(`  ${r.method} pts=${r.pts} result=${r.result} max_Δ=${r.maxDelta.toFixed(6)}`);
        }
    }
}

// ── Per-step detail for the largest-delta edges in hull vs uniform OK ─────────

console.log('\n' + '='.repeat(60));
console.log('LARGEST STEP DETAIL — hull-30min vs uniform pts=10 (OK)');
console.log('='.repeat(60));

for (const r of rows.filter(r => r.method === 'hull-30min' || (r.method === 'uniform-30min' && r.pts === 10))) {
    const ring = r.ring;
    console.log(`\n${r.method} pts=${r.pts} [${r.result}]`);
    // Print all steps sorted by delta descending
    const steps = [];
    for (let i = 0; i < ring.length - 1; i++) {
        const dLat = Math.abs(ring[i + 1][0] - ring[i][0]);
        const dLng = Math.abs(ring[i + 1][1] - ring[i][1]);
        steps.push({ i, dLat, dLng, maxD: Math.max(dLat, dLng) });
    }
    steps.sort((a, b) => b.maxD - a.maxD);
    console.log(`  Top steps by max(Δlat,Δlng):`);
    for (const s of steps.slice(0, 5)) {
        const from = ring[s.i], to = ring[s.i + 1];
        console.log(`  step[${s.i}→${s.i+1}]: Δlat=${s.dLat.toFixed(5)} Δlng=${s.dLng.toFixed(5)} max=${s.maxD.toFixed(5)}  from(${from[0].toFixed(4)},${from[1].toFixed(4)}) to(${to[0].toFixed(4)},${to[1].toFixed(4)})`);
    }
}

console.log('\nDone.');
