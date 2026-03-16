// Deep analysis of a failing Rightmove URL vs known-good URL #1.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const FAILING_URL = 'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22oio%7CHwzgCtfOjqj%40b_Jdyk%40%7Cr%5Equ%60%40kzTosw%40i_d%40n%7D%40%22%7D&viewType=MAP&numberOfPropertiesPerPage=95';

const KNOWN_GOOD_1_URL = 'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22_be%7DHa%60uBjhBiCi%40kmGcN%3F_pA%7C%5B_AzjE%7DD%7Ej%40%3FcA%22%7D&viewType=MAP&numberOfPropertiesPerPage=95';

const KNOWN_GOOD_2_URL = 'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22ki%60%7DHuenBw%7CDl_d%40_jVdzRspFhkSdzHlx%60%40bwPdzRdpIkoFtqF%7DhRqIijp%40%7EeJztAxfIljZnqJngJr%7CJoyCl%7DH_pUt%7E%40gjp%40erLcu%7C%40vhD%7Dyh%40ufNinc%40yqIor%40c%7DEx%7BD_sClw%7D%40m%7CFx%7ETipJxbHr%5EnjZci%40oyC%22%7D&viewType=MAP&numberOfPropertiesPerPage=95';

const KNOWN_GOOD_3_URL = 'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22qig%7DHmvaEsAjbQzlDzKrA%7E%5CgDrlCcrD%60%5DfDx%7BDbrDhCoIpwDytDbP%7E%5BvfFzlDa%5DgDfn%40qf%40lTquBdP%7CFfpb%40ncAha%40hmChC%60q%40%7BKeLm%7ERxeB%7Di%40pf%40gjBmQssFq%7DBy%7DCtrCqwDlQ%7DgAyk%40c%60E%7DzBslCbeDsjD%7E%5BqpAon%40kkHybCy%7DCbkBglA%7Ex%40ewB_%5C_kF%7BeBqwDksAqG%7Bc%40re%40fDpnB%7Ex%40hjB_y%40ppAg%7E%40%3FhDqpAqf%40cyAy%60A%7BKeLdPus%40duClQ%60bDfD%3F%22%7D&viewType=MAP&numberOfPropertiesPerPage=95';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractLocationIdentifier(url) {
    const u = new URL(url);
    return u.searchParams.get('locationIdentifier');
}

// NOTE: URL.searchParams.get() already decodes percent-encoding for us.
// But Rightmove uses %5E for ^ and we need the raw encoded value too.
function extractLocationIdentifierRaw(url) {
    const match = url.match(/[?&]locationIdentifier=([^&]*)/);
    return match ? match[1] : null;
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

function buildUrl(encoded) {
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    return `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
}

function charByChar(str, label) {
    const lines = [];
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        const code = str.charCodeAt(i);
        lines.push(`  [${String(i).padStart(3)}] '${c === '\n' ? '\\n' : c}' (${code} / 0x${code.toString(16).padStart(2,'0')})`);
    }
    return lines;
}

async function httpGet(url, label) {
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
        },
        redirect: 'follow',
    });
    const notFound = res.url.includes('page-not-found');
    return { status: res.status, finalUrl: res.url, notFound, ok: res.status === 200 && !notFound };
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('DEEP URL ANALYSIS — failing URL vs known-good URL #1');
console.log('='.repeat(72));

// ── STEP 1: Decode and analyse the failing URL ────────────────────────────────

console.log('\n' + '─'.repeat(72));
console.log('STEP 1 — Decode and analyse the locationIdentifier');
console.log('─'.repeat(72));

// Raw percent-encoded locationIdentifier values (before decoding)
const failingRaw = extractLocationIdentifierRaw(FAILING_URL);
const kg1Raw     = extractLocationIdentifierRaw(KNOWN_GOOD_1_URL);

console.log('\nRaw (percent-encoded) locationIdentifier values:');
console.log(`  FAILING:     ${failingRaw}`);
console.log(`  KNOWN-GOOD1: ${kg1Raw}`);

// Decoded locationIdentifier (the full `USERDEFINEDAREA^{...}` string)
const failingDecoded = decodeURIComponent(failingRaw);
const kg1Decoded     = decodeURIComponent(kg1Raw);

console.log('\nDecoded locationIdentifier strings:');
console.log(`  FAILING:     ${failingDecoded}`);
console.log(`  KNOWN-GOOD1: ${kg1Decoded}`);

// Count ^ characters in each
const failingCarets = (failingDecoded.match(/\^/g) || []).length;
const kg1Carets     = (kg1Decoded.match(/\^/g) || []).length;

console.log(`\nNumber of ^ (caret) characters:`);
console.log(`  FAILING:     ${failingCarets}`);
console.log(`  KNOWN-GOOD1: ${kg1Carets}`);

// Extract the polyline string (between the double-quotes after "polylines":)
function extractPolyline(decoded) {
    const m = decoded.match(/"polylines":"([^"]*)"/);
    return m ? m[1] : null;
}

const failingPolyline = extractPolyline(failingDecoded);
const kg1Polyline     = extractPolyline(kg1Decoded);

console.log(`\nExtracted polyline strings:`);
console.log(`  FAILING:     ${failingPolyline ?? '(NOT FOUND — JSON may be broken)'}`);
console.log(`  KNOWN-GOOD1: ${kg1Polyline ?? '(NOT FOUND)'}`);

// Also try parsing as JSON
console.log('\nJSON.parse test on the {...} portion:');
for (const [label, decoded] of [['FAILING', failingDecoded], ['KNOWN-GOOD1', kg1Decoded]]) {
    const jsonPart = decoded.slice(decoded.indexOf('^') + 1);
    try {
        const parsed = JSON.parse(jsonPart);
        console.log(`  ${label}: VALID JSON — polylines="${parsed.polylines}"`);
    } catch (e) {
        console.log(`  ${label}: INVALID JSON — ${e.message}`);
        console.log(`    JSON string attempted: ${jsonPart}`);
    }
}

// Decode polyline to coordinates
if (failingPolyline) {
    console.log('\nDecoded coordinates from FAILING polyline:');
    try {
        const coords = decodePolyline(failingPolyline);
        coords.forEach((c, i) => {
            console.log(`  [${String(i).padStart(2)}] lat=${c[0].toFixed(6)}, lng=${c[1].toFixed(6)}`);
        });
        console.log(`  Total: ${coords.length} points`);

        // Check closure
        const first = coords[0], last = coords[coords.length - 1];
        const closed = first[0] === last[0] && first[1] === last[1];
        console.log(`  Ring closed (first == last): ${closed}`);
    } catch (e) {
        console.log(`  ERROR decoding: ${e.message}`);
    }
}

// ── STEP 2: Round-trip test ───────────────────────────────────────────────────

console.log('\n' + '─'.repeat(72));
console.log('STEP 2 — Round-trip: decode → re-encode → rebuild URL');
console.log('─'.repeat(72));

if (failingPolyline) {
    const coords = decodePolyline(failingPolyline);
    const reEncoded = encodePolyline(coords);
    const rebuiltUrl = buildUrl(reEncoded);

    console.log(`\nOriginal polyline:  ${failingPolyline}`);
    console.log(`Re-encoded polyline: ${reEncoded}`);
    console.log(`Match: ${failingPolyline === reEncoded}`);

    console.log(`\nOriginal URL:\n  ${FAILING_URL}`);
    console.log(`Rebuilt URL:\n  ${rebuiltUrl}`);
    console.log(`URLs match: ${FAILING_URL === rebuiltUrl}`);

    if (FAILING_URL !== rebuiltUrl) {
        // Find first difference
        const a = FAILING_URL, b = rebuiltUrl;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if (a[i] !== b[i]) {
                console.log(`\nFirst difference at index ${i}:`);
                console.log(`  Original[${i}]: '${a[i]}' (code ${a.charCodeAt(i)})`);
                console.log(`  Rebuilt[${i}]:  '${b[i]}' (code ${b.charCodeAt(i)})`);
                console.log(`  Original context: ...${a.slice(Math.max(0,i-10), i+15)}...`);
                console.log(`  Rebuilt  context: ...${b.slice(Math.max(0,i-10), i+15)}...`);
                break;
            }
        }
        // Also compare percent-encoded locationIdentifier raw values
        const failRawLI  = extractLocationIdentifierRaw(FAILING_URL);
        const rebuildRawLI = extractLocationIdentifierRaw(rebuiltUrl);
        console.log(`\nOriginal raw locationIdentifier:\n  ${failRawLI}`);
        console.log(`Rebuilt  raw locationIdentifier:\n  ${rebuildRawLI}`);
        console.log(`Raw LI match: ${failRawLI === rebuildRawLI}`);
    }
}

// ── STEP 3: Character comparison ──────────────────────────────────────────────

console.log('\n' + '─'.repeat(72));
console.log('STEP 3 — Character-level comparison of polyline strings');
console.log('─'.repeat(72));

// Collect all chars in all 3 known-good polylines
const kg2Raw = extractLocationIdentifierRaw(KNOWN_GOOD_2_URL);
const kg3Raw = extractLocationIdentifierRaw(KNOWN_GOOD_3_URL);
const kg2Decoded = decodeURIComponent(kg2Raw);
const kg3Decoded = decodeURIComponent(kg3Raw);
const kg2Polyline = extractPolyline(kg2Decoded);
const kg3Polyline = extractPolyline(kg3Decoded);

const allKnownGoodChars = new Set([
    ...(kg1Polyline ?? ''),
    ...(kg2Polyline ?? ''),
    ...(kg3Polyline ?? ''),
]);

console.log(`\nKnown-good polyline #1: ${kg1Polyline}`);
console.log(`Known-good polyline #2: ${kg2Polyline}`);
console.log(`Known-good polyline #3: ${kg3Polyline}`);

if (failingPolyline) {
    const novelChars = new Set();
    for (const c of failingPolyline) {
        if (!allKnownGoodChars.has(c)) novelChars.add(c);
    }
    console.log(`\nChars in FAILING polyline NOT in any known-good polyline:`);
    if (novelChars.size === 0) {
        console.log('  (none — all characters appear in known-good polylines)');
    } else {
        for (const c of novelChars) {
            console.log(`  '${c}' (code ${c.charCodeAt(0)} / 0x${c.charCodeAt(0).toString(16)})`);
        }
    }

    // Specifically check for ^
    const caretInPolyline = failingPolyline.includes('^');
    console.log(`\nDoes FAILING polyline contain '^' (caret, code 94)? ${caretInPolyline}`);
    if (caretInPolyline) {
        const positions = [];
        for (let i = 0; i < failingPolyline.length; i++) {
            if (failingPolyline[i] === '^') positions.push(i);
        }
        console.log(`  Positions: ${positions.join(', ')}`);
        console.log(`  Context: ...${failingPolyline.slice(Math.max(0, positions[0]-5), positions[0]+6)}...`);
    }
}

// Decode all and check carets
console.log('\nCaret (^) count in fully-decoded locationIdentifier:');
for (const [label, decoded] of [
    ['FAILING', failingDecoded],
    ['KNOWN-GOOD1', kg1Decoded],
    ['KNOWN-GOOD2', kg2Decoded],
    ['KNOWN-GOOD3', kg3Decoded],
]) {
    const count = (decoded.match(/\^/g) || []).length;
    const positions = [];
    for (let i = 0; i < decoded.length; i++) if (decoded[i] === '^') positions.push(i);
    console.log(`  ${label.padEnd(12)}: ${count} caret(s) at index(es): [${positions.join(', ')}]`);
    if (count > 1) {
        for (const pos of positions) {
            console.log(`    pos ${pos}: ...${decoded.slice(Math.max(0,pos-5),pos+6)}...`);
        }
    }
}

// ── STEP 4: HTTP tests ────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(72));
console.log('STEP 4 — HTTP GET tests');
console.log('─'.repeat(72));

async function httpTest(label, url) {
    process.stdout.write(`\n  ${label}:\n  GET ${url.slice(0, 80)}...\n  → `);
    try {
        const r = await httpGet(url, label);
        console.log(`HTTP ${r.status}  notFound=${r.notFound}  result=${r.ok ? 'OK' : '404/REJECTED'}`);
        if (r.finalUrl !== url) console.log(`  redirected to: ${r.finalUrl}`);
        return r;
    } catch (err) {
        console.log(`ERROR: ${err.message}`);
        return null;
    }
}

const failResult = await httpTest('FAILING URL', FAILING_URL);
await new Promise(r => setTimeout(r, 2000));
const kg1Result  = await httpTest('KNOWN-GOOD #1', KNOWN_GOOD_1_URL);

// Also test the rebuilt URL if it differs
if (failingPolyline) {
    const coords = decodePolyline(failingPolyline);
    const reEncoded = encodePolyline(coords);
    const rebuiltUrl = buildUrl(reEncoded);
    if (rebuiltUrl !== FAILING_URL) {
        await new Promise(r => setTimeout(r, 2000));
        await httpTest('REBUILT URL (round-trip)', rebuiltUrl);
    }
}

// ── STEP 5: ^ splitting hypothesis ────────────────────────────────────────────

console.log('\n' + '─'.repeat(72));
console.log('STEP 5 — Caret-splitting hypothesis');
console.log('─'.repeat(72));

console.log('\nIf Rightmove splits the decoded locationIdentifier on the FIRST ^ only,');
console.log('the part after the first ^ is interpreted as JSON.');
console.log('If the polyline itself contains ^, the JSON would be truncated.\n');

for (const [label, decoded] of [
    ['FAILING', failingDecoded],
    ['KNOWN-GOOD1', kg1Decoded],
]) {
    const firstCaret = decoded.indexOf('^');
    const afterCaret = decoded.slice(firstCaret + 1);
    console.log(`${label}:`);
    console.log(`  Full decoded:  ${decoded}`);
    console.log(`  After 1st ^:   ${afterCaret}`);
    try {
        JSON.parse(afterCaret);
        console.log(`  JSON.parse(after 1st ^): VALID`);
    } catch (e) {
        console.log(`  JSON.parse(after 1st ^): INVALID — ${e.message}`);
    }

    // If there's a 2nd ^, what does splitting on ALL ^ do?
    const parts = decoded.split('^');
    if (parts.length > 2) {
        console.log(`  split('^') gives ${parts.length} parts:`);
        parts.forEach((p, i) => console.log(`    [${i}]: ${p}`));
        // Try parsing part[1] as JSON (what a naive split+[1] would give)
        try {
            JSON.parse(parts[1]);
            console.log(`  JSON.parse(parts[1]): VALID`);
        } catch (e) {
            console.log(`  JSON.parse(parts[1]): INVALID — ${e.message}`);
        }
    }
    console.log('');
}

// ── Final verdict ─────────────────────────────────────────────────────────────

console.log('─'.repeat(72));
console.log('SUMMARY / VERDICT');
console.log('─'.repeat(72));
console.log(`\nFailing URL HTTP result:    ${failResult ? (failResult.ok ? 'OK' : '404/REJECTED') : 'ERROR'}`);
console.log(`Known-good #1 HTTP result:  ${kg1Result  ? (kg1Result.ok  ? 'OK' : '404/REJECTED') : 'ERROR'}`);

const caretCountFailing = (failingDecoded.match(/\^/g) || []).length;
console.log(`\nCarets in failing decoded locationIdentifier:     ${caretCountFailing}`);
console.log(`Carets in known-good #1 decoded locationIdentifier: ${(kg1Decoded.match(/\^/g) || []).length}`);

if (caretCountFailing > 1) {
    console.log('\n*** CONFIRMED: The failing URL contains multiple ^ characters in the');
    console.log('    decoded locationIdentifier. The polyline itself encodes a ^ (caret,');
    console.log('    char code 94). Rightmove likely splits on ^ to separate the area type');
    console.log('    from the JSON payload — a second ^ inside the polyline truncates or');
    console.log('    corrupts the JSON, causing rejection. ***');
} else if (failingPolyline && failingPolyline.includes('^')) {
    console.log('\n*** The polyline contains ^ but it is percent-encoded in the URL,');
    console.log('    so the decoded locationIdentifier still only has one ^. ***');
} else {
    console.log('\nNo extra ^ detected — caret hypothesis not confirmed for this URL.');
    console.log('The failure has a different cause.');
}

console.log('\nDone.');
