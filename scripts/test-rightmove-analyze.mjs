// Analyze encoded polyline strings for point counts 8–22.
// No Rightmove HTTP requests — pure string/geometry analysis.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';

const POINT_COUNTS = Array.from({ length: 22 - 8 + 1 }, (_, i) => i + 8); // 8..22
const KNOWN_OK   = new Set([10, 12, 18, 20, 22]);
const KNOWN_FAIL = new Set([8, 9, 11, 13, 14, 15, 16, 17, 19, 21]);

// ── Encoder ───────────────────────────────────────────────────────────────────

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

// ── Analysis helpers ──────────────────────────────────────────────────────────

// Characters that are valid in Google Encoded Polyline but might cause trouble
// in specific contexts. Google polyline uses chars 63–126 ('?' to '~').
// Chars of interest:
//   63  = '?'   — query string separator
//   64  = '@'   — valid, no special URL meaning
//   91  = '['   — not encoded by encodeURIComponent
//   92  = '\'   — JSON escape character
//   93  = ']'   — not encoded by encodeURIComponent
//   94  = '^'   — not encoded by encodeURIComponent
//   95  = '_'   — not encoded by encodeURIComponent
//   96  = '`'   — not encoded by encodeURIComponent
//  123  = '{'   — not encoded by encodeURIComponent
//  124  = '|'   — not encoded by encodeURIComponent
//  125  = '}'   — not encoded by encodeURIComponent
//  126  = '~'   — not encoded by encodeURIComponent (we replace with %7E)
//
// encodeURIComponent does NOT encode: A-Z a-z 0-9 - _ . ! ~ * ' ( )
// It DOES encode everything else including ^, {, }, |, \, [, ], `
// BUT: the polyline is always inside encodeURIComponent(...), so those get
// encoded. The question is whether any of them survive into the final URL raw.

function analyzeEncoded(encoded) {
    // a) Characters in encoded string that are in the polyline alphabet (63–126)
    //    but have special meaning in URLs or JSON
    const specialInJson = [];
    const specialInUrl  = [];
    for (let i = 0; i < encoded.length; i++) {
        const c = encoded[i];
        const code = encoded.charCodeAt(i);
        // JSON special chars (inside a JSON string value)
        if (c === '"' || c === '\\') specialInJson.push({ i, c, code });
        // URL special chars that encodeURIComponent would NOT encode
        // (i.e., they'd survive raw into the URL if we applied encodeURIComponent
        //  to the whole locationIdentifier string)
        // encodeURIComponent does not encode: A-Z a-z 0-9 - _ . ! ~ * ' ( )
        // But since the polyline is *inside* encodeURIComponent(full_string),
        // only chars that encodeURIComponent itself doesn't touch matter.
        if ("!'()*-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~".includes(c)) {
            // These survive encoding. Check if any are URL-breaking.
            if (c === '?' || c === '#' || c === '&' || c === '=') {
                specialInUrl.push({ i, c, code });
            }
        }
    }

    // b) After building the full locationIdentifier, check for raw &, =, ?, #
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    const urlBreakers = [];
    for (const ch of ['&', '=', '?', '#']) {
        if (locationIdentifier.includes(ch)) urlBreakers.push(ch);
    }

    // c) Duplicate consecutive points (zero delta in both dimensions)
    //    We need to decode to find this. Decode the polyline first.
    const coords = decodePolyline(encoded);
    let dupConsecutive = 0;
    const dupPositions = [];
    for (let i = 1; i < coords.length; i++) {
        if (coords[i][0] === coords[i-1][0] && coords[i][1] === coords[i-1][1]) {
            dupConsecutive++;
            dupPositions.push(i);
        }
    }

    // d) Any two sampled points identical (not just consecutive)
    const identicalPairs = [];
    for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
            if (coords[i][0] === coords[j][0] && coords[i][1] === coords[j][1]) {
                identicalPairs.push([i, j]);
            }
        }
    }

    // e) Does the encoded string contain '\' or '"' — literal, not escaped?
    const backslash = encoded.includes('\\');
    const dquote    = encoded.includes('"');

    return {
        specialInJson,
        specialInUrl,
        urlBreakers,
        dupConsecutive,
        dupPositions,
        identicalPairs,
        backslash,
        dquote,
        locationIdentifier,
        coords,
    };
}

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

// ── Character-level diff between two encoded strings ─────────────────────────

function charDiff(a, b) {
    const lines = [];
    const maxLen = Math.max(a.length, b.length);
    const diffs = [];
    for (let i = 0; i < maxLen; i++) {
        if (a[i] !== b[i]) diffs.push({ i, a: a[i] ?? '(end)', b: b[i] ?? '(end)', codeA: a.charCodeAt(i), codeB: b.charCodeAt(i) });
    }
    return diffs;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Geocoding CM77 7UE...');
const { lat, lng } = await geocode('CM77 7UE');
console.log(`lat=${lat}, lng=${lng}`);

console.log('Fetching 30-min isochrone...');
const isoData = await getIsochrone(lat, lng, 30);
const rawLatLngs = extractRawLatLngs(isoData);
console.log(`Raw ring: ${rawLatLngs.length} points\n`);

// Build all rings and analysis objects upfront
const data = {};
for (const pc of POINT_COUNTS) {
    let ring = simplifyRing(rawLatLngs, pc);
    ring = forceClose(ring);
    const encoded = encodePolyline(ring);
    const analysis = analyzeEncoded(encoded);
    data[pc] = { ring, encoded, analysis };
}

// ── Section 1: Encoded strings + analysis ────────────────────────────────────

console.log('='.repeat(80));
console.log('SECTION 1: Encoded polyline strings and issue checks');
console.log('='.repeat(80));

for (const pc of POINT_COUNTS) {
    const status = KNOWN_OK.has(pc) ? 'OK  ' : KNOWN_FAIL.has(pc) ? 'FAIL' : '????';
    const { encoded, analysis } = data[pc];
    const { urlBreakers, dupConsecutive, identicalPairs, backslash, dquote, specialInJson, locationIdentifier } = analysis;

    console.log(`\npts=${String(pc).padStart(2)} [${status}]  enc_len=${String(encoded.length).padStart(4)}`);
    console.log(`  encoded: ${encoded}`);

    // Check a: JSON-breaking chars in polyline
    const jsonIssues = backslash ? ['backslash(\\)'] : [];
    if (dquote) jsonIssues.push('double-quote(")');
    console.log(`  a) JSON-breaking chars in polyline: ${jsonIssues.length ? jsonIssues.join(', ') : 'none'}`);

    // Check b: URL-breaking chars in locationIdentifier
    console.log(`  b) URL-breaking chars in locationIdentifier: ${urlBreakers.length ? urlBreakers.join(', ') : 'none'}`);

    // Check c/d: duplicate points
    console.log(`  c) Consecutive duplicate points: ${dupConsecutive}${dupConsecutive > 0 ? ' at positions ' + data[pc].analysis.dupPositions.join(',') : ''}`);
    console.log(`  d) Any identical point pairs: ${identicalPairs.length}${identicalPairs.length > 0 ? ' pairs: ' + identicalPairs.map(p => `[${p[0]},${p[1]}]`).join(' ') : ''}`);

    // Check e: chars with code 92 (\) or 34 (") in encoded string
    const problematic = [];
    for (let i = 0; i < encoded.length; i++) {
        const code = encoded.charCodeAt(i);
        if (code === 92 || code === 34) problematic.push({ i, code, char: encoded[i] });
    }
    if (problematic.length) {
        console.log(`  !! PROBLEMATIC CHARS: ${problematic.map(p => `pos${p.i}='${p.char}'(${p.code})`).join(', ')}`);
    }

    // Show all char codes in encoded string
    const charCodes = Array.from(encoded).map(c => c.charCodeAt(0));
    console.log(`  char codes: [${charCodes.join(',')}]`);
}

// ── Section 2: Coordinate comparison pts=11 (fail) vs pts=12 (pass) ──────────

console.log('\n' + '='.repeat(80));
console.log('SECTION 2: Coordinate dump — pts=11 (FAIL) vs pts=12 (PASS)');
console.log('='.repeat(80));

for (const pc of [11, 12]) {
    const status = KNOWN_OK.has(pc) ? 'PASS' : 'FAIL';
    const { ring } = data[pc];
    console.log(`\npts=${pc} [${status}] — ${ring.length} points (after forceClose):`);
    ring.forEach((pt, i) => {
        const raw_idx = Math.round(i * ((rawLatLngs.length - 1) / (pc - 1)));
        const marker = i === ring.length - 1 ? ' ← last (force-closed)' : '';
        console.log(`  [${String(i).padStart(2)}] lat=${pt[0].toFixed(6)}, lng=${pt[1].toFixed(6)}  (raw idx ~${raw_idx})${marker}`);
    });
}

// ── Section 3: Pairwise character-level diff: each failing vs nearest passing ─

console.log('\n' + '='.repeat(80));
console.log('SECTION 3: Character-level diffs — failing vs adjacent passing');
console.log('='.repeat(80));

const pairs = [[10,11],[10,9],[12,11],[12,13],[18,17],[18,19],[20,19],[20,21],[22,21]];
for (const [ok, fail] of pairs) {
    if (!data[ok] || !data[fail]) continue;
    const encOk   = data[ok].encoded;
    const encFail = data[fail].encoded;
    const diffs = charDiff(encOk, encFail);
    console.log(`\n  pts=${ok}[OK,len=${encOk.length}] vs pts=${fail}[FAIL,len=${encFail.length}] — ${diffs.length} char diffs (len diff ${encFail.length - encOk.length})`);
    console.log(`    OK  : ${encOk}`);
    console.log(`    FAIL: ${encFail}`);
    if (diffs.length <= 20) {
        diffs.forEach(d => console.log(`    pos ${d.i}: OK='${d.a}'(${d.codeA}) FAIL='${d.b}'(${d.codeB})`));
    } else {
        console.log(`    (${diffs.length} diffs — strings are quite different in length, char-by-char diff not meaningful)`);
    }
}

// ── Section 4: Summary table ──────────────────────────────────────────────────

console.log('\n' + '='.repeat(80));
console.log('SECTION 4: Summary — per-count issue flags');
console.log('='.repeat(80));
console.log(`${'pts'.padStart(4)} | ${'result'.padStart(6)} | ${'enc_len'.padStart(7)} | ${'\\\\or"'.padStart(6)} | ${'url_break'.padStart(9)} | ${'dup_consec'.padStart(10)} | ${'ident_pairs'.padStart(11)}`);
console.log(`${'-'.repeat(4)}-+-${'-'.repeat(6)}-+-${'-'.repeat(7)}-+-${'-'.repeat(6)}-+-${'-'.repeat(9)}-+-${'-'.repeat(10)}-+-${'-'.repeat(11)}`);
for (const pc of POINT_COUNTS) {
    const status = KNOWN_OK.has(pc) ? 'OK' : KNOWN_FAIL.has(pc) ? 'FAIL' : '?';
    const { encoded, analysis } = data[pc];
    const { urlBreakers, dupConsecutive, identicalPairs, backslash, dquote } = analysis;
    const jsonFlag = (backslash || dquote) ? 'YES' : 'no';
    const urlFlag  = urlBreakers.length ? urlBreakers.join('') : 'no';
    console.log(
        `${String(pc).padStart(4)} | ${status.padStart(6)} | ${String(encoded.length).padStart(7)} | ${jsonFlag.padStart(6)} | ${urlFlag.padStart(9)} | ${String(dupConsecutive).padStart(10)} | ${String(identicalPairs.length).padStart(11)}`
    );
}

console.log('\nDone.');
