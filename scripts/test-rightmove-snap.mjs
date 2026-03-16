// Test whether snapping coordinates to 1e-5 precision fixes ring closure and
// improves Rightmove acceptance rates across 4 UK locations.
//
// Pipeline per candidate: simplifyRing → forceClose → snapRing → encode → buildUrl
// Verify: decode the encoded polyline and check first == last exactly.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

const LOCATIONS = [
    { postcode: 'CM77 7UE', city: 'Essex',      minutes: 30 },
    { postcode: 'M1 1AE',   city: 'Manchester', minutes: 30 },
    { postcode: 'EC1A 1BB', city: 'London',     minutes: 30 },
    { postcode: 'BS1 4DJ',  city: 'Bristol',    minutes: 30 },
];

const CANDIDATE_PTS = [20, 18, 22, 12, 10, 9, 7, 6];

// ── Core functions ────────────────────────────────────────────────────────────

const snap = v => Math.round(v * 1e5) / 1e5;

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

function decodePolyline(encoded) {
    const coords = [];
    let lat = 0, lng = 0, i = 0;
    while (i < encoded.length) {
        let r = 0, s = 0, b;
        do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
        lat += (r & 1) ? ~(r >> 1) : (r >> 1);
        r = 0; s = 0;
        do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
        lng += (r & 1) ? ~(r >> 1) : (r >> 1);
        coords.push([lat / 1e5, lng / 1e5]);
    }
    return coords;
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

function snapRing(ring) {
    return ring.map(([lat, lng]) => [snap(lat), snap(lng)]);
}

function buildUrl(encoded) {
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    return `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
}

// Verify closure survives the encode→decode round-trip
function checkRoundTripClosure(ring) {
    const encoded = encodePolyline(ring);
    const decoded = decodePolyline(encoded);
    if (decoded.length < 2) return { closed: false, firstPt: null, lastPt: null };
    const first = decoded[0], last = decoded[decoded.length - 1];
    const closed = first[0] === last[0] && first[1] === last[1];
    return { closed, firstPt: first, lastPt: last };
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
    const body = { locations: [{ lon: lng, lat }], costing: 'auto', contours: [{ time: minutes }], polygons: true };
    const res = await fetch('https://valhalla1.openstreetmap.de/isochrone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Valhalla ${res.status}: ${t}`); }
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('No Valhalla features');
    const ring = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0][0];
    return ring.map(([lng, lat]) => [lat, lng]);
}

async function checkRightmove(url) {
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
    return { status: res.status, ok: res.status === 200 && !notFound };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('='.repeat(76));
console.log('Snap-to-1e-5 fix test — 4 locations × 8 point counts');
console.log('Pipeline: simplifyRing → forceClose → snapRing → encode → Rightmove');
console.log(`Candidate pts: ${CANDIDATE_PTS.join(', ')}`);
console.log('='.repeat(76));

// Step 1: geocode all locations
console.log('\nGeocoding...');
for (const loc of LOCATIONS) {
    try {
        const { lat, lng } = await geocode(loc.postcode);
        loc.lat = lat; loc.lng = lng;
        console.log(`  ${loc.postcode} (${loc.city}): ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch (err) {
        loc.geoError = err.message;
        console.log(`  ${loc.postcode}: GEOCODE ERROR — ${err.message}`);
    }
}

// Step 2: fetch isochrones
console.log('\nFetching isochrones...');
for (const loc of LOCATIONS) {
    if (loc.geoError) { loc.ring = null; continue; }
    try {
        loc.ring = await getIsochrone(loc.lat, loc.lng, loc.minutes);
        console.log(`  ${loc.postcode} ${loc.minutes}min: ${loc.ring.length} raw points`);
    } catch (err) {
        loc.isoError = err.message;
        loc.ring = null;
        console.log(`  ${loc.postcode}: ISOCHRONE ERROR — ${err.message}`);
    }
}

// Step 3: pre-compute rings (no HTTP yet) and show closure check
console.log('\n' + '='.repeat(76));
console.log('PRE-FLIGHT: Closure check WITHOUT snap vs WITH snap (no HTTP)');
console.log('='.repeat(76));

for (const loc of LOCATIONS) {
    if (!loc.ring) continue;
    console.log(`\n${loc.postcode} (${loc.city}) ${loc.minutes}min:`);
    console.log(`${'pts'.padStart(4)} | ${'closed_NO_snap'.padStart(14)} | ${'closed_WITH_snap'.padStart(16)} | delta_last_lat (no snap)`);
    console.log(`${'-'.repeat(4)}-+-${'-'.repeat(14)}-+-${'-'.repeat(16)}-+-${'-'.repeat(25)}`);

    for (const pc of CANDIDATE_PTS) {
        // Without snap
        let ringNoSnap = simplifyRing(loc.ring, pc);
        ringNoSnap = forceClose(ringNoSnap);
        const { closed: closedNoSnap, firstPt: f1, lastPt: l1 } = checkRoundTripClosure(ringNoSnap);

        // With snap
        let ringSnap = simplifyRing(loc.ring, pc);
        ringSnap = forceClose(ringSnap);
        ringSnap = snapRing(ringSnap);
        const { closed: closedSnap } = checkRoundTripClosure(ringSnap);

        const deltaLat = f1 && l1 ? Math.abs(f1[0] - l1[0]) : 0;
        const deltaStr = deltaLat === 0 ? '0' : deltaLat.toFixed(6);

        console.log(
            `${String(pc).padStart(4)} | ${String(closedNoSnap).padStart(14)} | ${String(closedSnap).padStart(16)} | ${deltaStr}`
        );
    }
}

// Step 4: Rightmove HTTP tests WITH snap applied
console.log('\n' + '='.repeat(76));
console.log('RIGHTMOVE HTTP TESTS — with snap applied');
const totalRequests = LOCATIONS.filter(l => l.ring).reduce((n, _) => n + CANDIDATE_PTS.length, 0);
console.log(`${totalRequests} requests × ${DELAY_MS}ms ≈ ${Math.ceil(totalRequests * DELAY_MS / 1000)}s`);
console.log('='.repeat(76));

const allRows = [];
let requestIndex = 0;

for (const loc of LOCATIONS) {
    if (!loc.ring) {
        console.log(`\n${loc.postcode}: skipped (${loc.geoError || loc.isoError})`);
        continue;
    }

    console.log(`\n── ${loc.postcode} (${loc.city}) ${loc.minutes}min ──`);
    console.log(`${'pts'.padStart(4)} | ${'rt_closed'.padStart(9)} | ${'url_len'.padStart(7)} | result`);
    console.log(`${'-'.repeat(4)}-+-${'-'.repeat(9)}-+-${'-'.repeat(7)}-+-------`);

    const locRows = [];

    for (const pc of CANDIDATE_PTS) {
        if (requestIndex > 0) await delay(DELAY_MS);
        requestIndex++;

        let ring = simplifyRing(loc.ring, pc);
        ring = forceClose(ring);
        ring = snapRing(ring);

        const { closed } = checkRoundTripClosure(ring);
        const encoded = encodePolyline(ring);
        const url = buildUrl(encoded);

        let result;
        try {
            const r = await checkRightmove(url);
            result = r.ok ? 'OK' : '404';
        } catch (err) {
            result = 'ERR';
        }

        const marker = result === 'OK' ? '  <<<' : '';
        console.log(`${String(pc).padStart(4)} | ${String(closed).padStart(9)} | ${String(url.length).padStart(7)} | ${result}${marker}`);

        locRows.push({ postcode: loc.postcode, city: loc.city, minutes: loc.minutes, pc, closed, urlLen: url.length, result });
    }

    allRows.push(...locRows);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(76));
console.log('SUMMARY TABLE — all locations');
console.log('='.repeat(76));
console.log(`${'postcode'.padEnd(10)} | ${'city'.padEnd(11)} | ${'pts'.padStart(4)} | ${'rt_closed'.padStart(9)} | ${'url_len'.padStart(7)} | result`);
console.log(`${'-'.repeat(10)}-+-${'-'.repeat(11)}-+-${'-'.repeat(4)}-+-${'-'.repeat(9)}-+-${'-'.repeat(7)}-+-------`);

for (const r of allRows) {
    const marker = r.result === 'OK' ? '  <<<' : '';
    console.log(
        `${r.postcode.padEnd(10)} | ${r.city.padEnd(11)} | ${String(r.pc).padStart(4)} | ${String(r.closed).padStart(9)} | ${String(r.urlLen).padStart(7)} | ${r.result}${marker}`
    );
}

// Per-location verdict
console.log('\n' + '='.repeat(76));
console.log('PER-LOCATION VERDICT');
console.log('='.repeat(76));

for (const loc of LOCATIONS) {
    const rows = allRows.filter(r => r.postcode === loc.postcode);
    if (!rows.length) { console.log(`  ${loc.postcode}: no data`); continue; }

    const okRows = rows.filter(r => r.result === 'OK');
    const allClosedBeforeSnap = rows.every(r => r.closed);
    const allClosed = rows.every(r => r.closed);

    if (okRows.length === 0) {
        console.log(`  ${loc.postcode} (${loc.city}): ALL FAILED — tried pts: ${rows.map(r=>r.pc).join(', ')}`);
    } else {
        console.log(`  ${loc.postcode} (${loc.city}): OK at pts=${okRows.map(r=>r.pc).join(', ')}`);
    }
    console.log(`    Ring closure after round-trip: ${allClosed ? 'ALL closed' : rows.map(r=>`pts=${r.pc}:${r.closed}`).join(', ')}`);
}

// Snap effectiveness summary
const closedCount = allRows.filter(r => r.closed).length;
const totalCount  = allRows.length;
console.log(`\nSnap effectiveness: ${closedCount}/${totalCount} rings closed after encode→decode round-trip`);

const okWithClosed  = allRows.filter(r => r.result === 'OK' && r.closed).length;
const okWithOpen    = allRows.filter(r => r.result === 'OK' && !r.closed).length;
const failWithOpen  = allRows.filter(r => r.result !== 'OK' && !r.closed).length;
const failWithClosed = allRows.filter(r => r.result !== 'OK' && r.closed).length;

console.log('\nResult vs closure cross-tab:');
console.log(`  OK   + closed: ${okWithClosed}`);
console.log(`  OK   + open:   ${okWithOpen}`);
console.log(`  FAIL + closed: ${failWithClosed}`);
console.log(`  FAIL + open:   ${failWithOpen}`);

console.log('\nDone.');
