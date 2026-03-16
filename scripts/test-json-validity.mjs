// Test whether encoded polyline strings produce valid JSON when embedded literally
// inside {"polylines":"<encoded>"}.
// Tests pts 8-22 from the CM77 7UE 30-min isochrone, plus the three known-good
// Rightmove polylines from test-polyline.mjs.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';

// ── Known-good polylines from test-polyline.mjs ───────────────────────────────

const KNOWN_GOOD_POLYLINES = [
    { label: 'known-good #1 (10 pts)', encoded: '_be}Ha`uBjhBiCi@kmGcN?_pA|[_AzjE}D~j@?cA' },
    { label: 'known-good #2 (30 pts)', encoded: 'ki`}HuenBw|Dl_d@_jVdzRspFhkSdzHlx`@bwPdzRdpIkoFtqF}hRqIijp@~eJztAxfIljZnqJngJr|JoyCl}H_pUt~@gjp@erLcu|@vhD}yh@ufNinc@yqIor@c}Ex{D_sClw}@m|Fx~TipJxbHr^njZci@oyC' },
    { label: 'known-good #3 (~60 pts)', encoded: 'qig}HmvaEsAjbQzlDzKrA~\\gDrlCcrD`]fDx{DbrDhCoIpwDytDbP~[vfFzlDa]gDfn@qf@lTquBdP|Ffpb@ncAha@hmChC`q@{KeLm~RxeB}i@pf@gjBmQssFq}By}CtrCqwDlQ}gAyk@c`E}zBslCbeDsjD~[qpAon@kkHybCy}CbkBglA~x@ewB_\\_kF{eBqwDksAqG{c@re@fDpnB~x@hjB_y@ppAg~@?hDqpAqf@cyAy`A{KeLdPus@duClQ`bDfD?' },
];

// ── Encoder / decoder ─────────────────────────────────────────────────────────

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

// ── JSON validity test ────────────────────────────────────────────────────────

function testJsonValidity(label, encoded) {
    // This is the exact string Rightmove's server would see after URL-decoding
    // the locationIdentifier parameter (before the ^ split and JSON parse).
    const json = `{"polylines":"${encoded}"}`;

    // Scan for characters that are invalid unescaped inside a JSON string:
    // These are control chars (0x00-0x1F), backslash (0x5C), and double-quote (0x22).
    const badChars = [];
    for (let i = 0; i < encoded.length; i++) {
        const code = encoded.charCodeAt(i);
        if (code === 0x22) badChars.push({ i, char: '"',  code, name: 'double-quote' });
        if (code === 0x5C) badChars.push({ i, char: '\\', code, name: 'backslash' });
        if (code <= 0x1F)  badChars.push({ i, char: `\\u${code.toString(16).padStart(4,'0')}`, code, name: 'control' });
    }

    let parseResult, parseError;
    try {
        JSON.parse(json);
        parseResult = 'VALID JSON';
        parseError = null;
    } catch (e) {
        parseResult = 'INVALID JSON';
        parseError = e.message;
    }

    // Also check whether the first point == last point (ring is closed)
    // by decoding the polyline
    let closed = null;
    try {
        const coords = [];
        let lat = 0, lng = 0, idx = 0;
        while (idx < encoded.length) {
            let r = 0, s = 0, b;
            do { b = encoded.charCodeAt(idx++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
            lat += (r & 1) ? ~(r >> 1) : (r >> 1);
            r = 0; s = 0;
            do { b = encoded.charCodeAt(idx++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
            lng += (r & 1) ? ~(r >> 1) : (r >> 1);
            coords.push([lat / 1e5, lng / 1e5]);
        }
        if (coords.length >= 2) {
            const first = coords[0], last = coords[coords.length - 1];
            closed = first[0] === last[0] && first[1] === last[1];
        }
    } catch (_) { closed = null; }

    return { label, encoded, parseResult, parseError, badChars, closed };
}

// ── Fetch pipeline ────────────────────────────────────────────────────────────

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
    return res.json();
}

function extractRawLatLngs(data) {
    const { geometry } = data.features[0];
    const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
    return ring.map(([lng, lat]) => [lat, lng]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Geocoding CM77 7UE...');
const { lat, lng } = await geocode('CM77 7UE');
console.log(`lat=${lat}, lng=${lng}\n`);

console.log('Fetching 30-min isochrone...');
const isoData = await getIsochrone(lat, lng, 30);
const rawLatLngs = extractRawLatLngs(isoData);
console.log(`Raw ring: ${rawLatLngs.length} points\n`);

// Build encoded strings for pts 8-22 (same pipeline as test-rightmove-points.mjs)
const isoResults = [];
for (let pc = 8; pc <= 22; pc++) {
    let ring = simplifyRing(rawLatLngs, pc);
    ring = forceClose(ring);
    const encoded = encodePolyline(ring);
    const r = testJsonValidity(`pts=${pc}`, encoded);
    isoResults.push(r);
}

// ── Section 1: Print encoded strings for pts 8-22 ────────────────────────────

console.log('='.repeat(80));
console.log('SECTION 1: Encoded strings for pts=8 through pts=22');
console.log('(forceClose applied: last point overwritten with first)');
console.log('='.repeat(80));

const KNOWN_OK   = new Set([10, 12, 18, 20, 22]);
const KNOWN_FAIL = new Set([8, 9, 11, 13, 14, 15, 16, 17, 19, 21]);

for (let i = 0; i < isoResults.length; i++) {
    const pc = 8 + i;
    const tag = KNOWN_OK.has(pc) ? 'OK  ' : KNOWN_FAIL.has(pc) ? 'FAIL' : '????';
    console.log(`pts=${String(pc).padStart(2)} [${tag}]: ${isoResults[i].encoded}`);
}

// ── Section 2: JSON validity for pts 8-22 ────────────────────────────────────

console.log('\n' + '='.repeat(80));
console.log('SECTION 2: JSON validity — pts=8 through pts=22');
console.log('='.repeat(80));
console.log(`${'label'.padEnd(12)} | ${'result'.padEnd(12)} | ${'closed'.padStart(6)} | ${'bad_chars'.padEnd(40)} | error`);
console.log(`${'-'.repeat(12)}-+-${'-'.repeat(12)}-+-${'-'.repeat(6)}-+-${'-'.repeat(40)}-+------`);

for (let i = 0; i < isoResults.length; i++) {
    const pc = 8 + i;
    const tag = KNOWN_OK.has(pc) ? 'OK  ' : KNOWN_FAIL.has(pc) ? 'FAIL' : '????';
    const r = isoResults[i];
    const badDesc = r.badChars.length
        ? r.badChars.map(b => `pos${b.i}:'${b.name}'(${b.code})`).join(', ')
        : 'none';
    const closedStr = r.closed === null ? '?' : r.closed ? 'YES' : 'NO';
    console.log(
        `pts=${String(pc).padStart(2)}[${tag}] | ${r.parseResult.padEnd(12)} | ${closedStr.padStart(6)} | ${badDesc.padEnd(40)} | ${r.parseError ?? ''}`
    );
}

// ── Section 3: JSON validity for the three known-good Rightmove polylines ─────

console.log('\n' + '='.repeat(80));
console.log('SECTION 3: JSON validity — three known-good Rightmove polylines');
console.log('(These are the raw JS string literals from test-polyline.mjs)');
console.log('='.repeat(80));
console.log('NOTE: In test-polyline.mjs these are JS string literals, so \\\\ → \\ and \\_ → _');
console.log('      The encoded strings as stored in JS source already have JS escaping applied.');
console.log('');

// The polylines as they appear in test-polyline.mjs are JS string literals.
// In JS source, '\' must be written '\\'. So 'a\\b' in JS source = a\b as the actual string.
// We test the ACTUAL string value (i.e., after JS engine processes escape sequences).

for (const { label, encoded } of KNOWN_GOOD_POLYLINES) {
    const r = testJsonValidity(label, encoded);
    const badDesc = r.badChars.length
        ? r.badChars.map(b => `pos${b.i}:'${b.name}'(${b.code})`).join(', ')
        : 'none';
    const closedStr = r.closed === null ? '?' : r.closed ? 'YES' : 'NO';
    console.log(`${label}`);
    console.log(`  encoded (${encoded.length} chars): ${encoded}`);
    console.log(`  JSON validity: ${r.parseResult}${r.parseError ? ' — ' + r.parseError : ''}`);
    console.log(`  bad chars: ${badDesc}`);
    console.log(`  ring closed (first==last): ${closedStr}`);
    console.log('');
}

// ── Section 4: Focused look at pts=11 ────────────────────────────────────────

console.log('='.repeat(80));
console.log('SECTION 4: Deep dive — pts=11 (FAIL)');
console.log('='.repeat(80));

const r11 = isoResults[11 - 8]; // index 3
console.log(`Encoded string: ${r11.encoded}`);
console.log(`Length: ${r11.encoded.length}`);
console.log(`\nJSON template: {"polylines":"${r11.encoded}"}`);
console.log(`\nJSON.parse result: ${r11.parseResult}`);
if (r11.parseError) console.log(`Error: ${r11.parseError}`);
if (r11.badChars.length) {
    console.log(`\nBad characters found:`);
    for (const b of r11.badChars) {
        console.log(`  index ${b.i}: char='${b.char}' code=${b.code} (${b.name})`);
        const ctx = r11.encoded.substring(Math.max(0, b.i - 5), b.i + 6);
        console.log(`  context: ...${ctx}...`);
    }
}

// ── Section 5: Summary ────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(80));
console.log('SECTION 5: Summary table');
console.log('='.repeat(80));
console.log(`${'pts'.padStart(5)} | ${'RM_result'.padStart(9)} | ${'json_valid'.padStart(10)} | ${'ring_closed'.padStart(11)} | ${'bad_chars'}`);
console.log(`${'-'.repeat(5)}-+-${'-'.repeat(9)}-+-${'-'.repeat(10)}-+-${'-'.repeat(11)}-+----------`);

for (let i = 0; i < isoResults.length; i++) {
    const pc = 8 + i;
    const tag = KNOWN_OK.has(pc) ? 'OK' : KNOWN_FAIL.has(pc) ? 'FAIL' : '?';
    const r = isoResults[i];
    const jsonOk = r.parseResult === 'VALID JSON' ? 'valid' : 'INVALID';
    const closedStr = r.closed === null ? '?' : r.closed ? 'YES' : 'no';
    const badDesc = r.badChars.length ? r.badChars.map(b => `${b.name}@${b.i}`).join(',') : 'none';
    console.log(
        `${String(pc).padStart(5)} | ${tag.padStart(9)} | ${jsonOk.padStart(10)} | ${closedStr.padStart(11)} | ${badDesc}`
    );
}

console.log('\nDone.');
