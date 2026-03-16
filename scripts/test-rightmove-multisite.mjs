// Cross-postcode reliability test for pts=12 (and pts=10 fallback on failure).
// Tests 5 combinations: EC1A 1BB 30+60min, M1 1AE 30+60min, CM77 7UE 30min.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

const TESTS = [
    { postcode: 'EC1A 1BB', minutes: 30 },
    { postcode: 'EC1A 1BB', minutes: 60 },
    { postcode: 'M1 1AE',   minutes: 30 },
    { postcode: 'M1 1AE',   minutes: 60 },
    { postcode: 'CM77 7UE', minutes: 30 },
];

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

function buildUrl(ring) {
    const encoded = encodePolyline(ring);
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    const url = `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
    return { encoded, url };
}

// ── Network ───────────────────────────────────────────────────────────────────

async function geocode(postcode) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    if (!data.length) throw new Error(`No geocode result for ${postcode}`);
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
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
    if (!feature) throw new Error('No features in Valhalla response');
    const ring = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0][0];
    return ring.map(([lng, lat]) => [lat, lng]); // [lng,lat] → [lat,lng]
}

async function checkRightmove(url) {
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
        },
        redirect: 'follow',
    });
    const notFound = res.url.includes('page-not-found');
    return { status: res.status, notFound, ok: res.status === 200 && !notFound };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('Cross-postcode reliability test — pts=12 (fallback pts=10)');
console.log(`${TESTS.length} primary tests + fallback retries if needed`);
console.log('='.repeat(72));

// Geocode all unique postcodes up front (no delay needed, different service)
const geocodeCache = {};
for (const { postcode } of TESTS) {
    if (geocodeCache[postcode]) continue;
    process.stdout.write(`Geocoding ${postcode}... `);
    geocodeCache[postcode] = await geocode(postcode);
    console.log(`${geocodeCache[postcode].lat.toFixed(5)}, ${geocodeCache[postcode].lng.toFixed(5)} — ${geocodeCache[postcode].display.split(',').slice(0, 3).join(',')}`);
}

console.log('');

const rows = [];
let firstRequest = true;

for (const { postcode, minutes } of TESTS) {
    const { lat, lng } = geocodeCache[postcode];

    process.stdout.write(`\n[${postcode} ${minutes}min] Fetching isochrone... `);
    let rawRing;
    try {
        rawRing = await getIsochrone(lat, lng, minutes);
        console.log(`${rawRing.length} raw points`);
    } catch (err) {
        console.log(`ERROR: ${err.message}`);
        rows.push({ postcode, minutes, pts: 12, rawPts: '?', urlLen: '?', result: `ERROR:${err.message}`, fallback: false });
        continue;
    }

    // Test pts=12
    let ring12 = simplifyRing(rawRing, 12);
    ring12 = forceClose(ring12);
    const { encoded: enc12, url: url12 } = buildUrl(ring12);

    if (!firstRequest) await delay(DELAY_MS);
    firstRequest = false;

    process.stdout.write(`  pts=12 (enc=${enc12.length}, url=${url12.length})... `);
    let r12;
    try {
        r12 = await checkRightmove(url12);
        console.log(`HTTP ${r12.status} → ${r12.ok ? 'OK' : '404/REJECTED'}`);
    } catch (err) {
        console.log(`ERROR: ${err.message}`);
        rows.push({ postcode, minutes, pts: 12, rawPts: rawRing.length, urlLen: url12.length, result: 'ERROR', fallback: false });
        continue;
    }

    rows.push({ postcode, minutes, pts: 12, rawPts: rawRing.length, urlLen: url12.length, result: r12.ok ? 'OK' : '404', fallback: false });

    // If pts=12 failed, also try pts=10
    if (!r12.ok) {
        let ring10 = simplifyRing(rawRing, 10);
        ring10 = forceClose(ring10);
        const { encoded: enc10, url: url10 } = buildUrl(ring10);

        await delay(DELAY_MS);
        process.stdout.write(`  pts=10 fallback (enc=${enc10.length}, url=${url10.length})... `);
        let r10;
        try {
            r10 = await checkRightmove(url10);
            console.log(`HTTP ${r10.status} → ${r10.ok ? 'OK' : '404/REJECTED'}`);
        } catch (err) {
            console.log(`ERROR: ${err.message}`);
            rows.push({ postcode, minutes, pts: 10, rawPts: rawRing.length, urlLen: url10.length, result: 'ERROR', fallback: true });
            continue;
        }
        rows.push({ postcode, minutes, pts: 10, rawPts: rawRing.length, urlLen: url10.length, result: r10.ok ? 'OK' : '404', fallback: true });
    }
}

// ── Summary table ─────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(72)}`);
console.log('SUMMARY TABLE');
console.log('='.repeat(72));
console.log(`${'postcode'.padEnd(12)} | ${'min'.padStart(4)} | ${'raw_pts'.padStart(7)} | ${'pts'.padStart(4)} | ${'url_len'.padStart(7)} | ${'fallback'.padStart(8)} | result`);
console.log(`${'-'.repeat(12)}-+-${'-'.repeat(4)}-+-${'-'.repeat(7)}-+-${'-'.repeat(4)}-+-${'-'.repeat(7)}-+-${'-'.repeat(8)}-+-------`);

for (const r of rows) {
    console.log(
        `${r.postcode.padEnd(12)} | ${String(r.minutes).padStart(4)} | ${String(r.rawPts).padStart(7)} | ${String(r.pts).padStart(4)} | ${String(r.urlLen).padStart(7)} | ${(r.fallback ? 'yes' : '').padStart(8)} | ${r.result}`
    );
}

console.log('='.repeat(72));

const primary12 = rows.filter(r => r.pts === 12 && !r.fallback);
const ok12 = primary12.filter(r => r.result === 'OK').length;
console.log(`\npts=12 primary: ${ok12}/${primary12.length} passed`);

const fallbackRows = rows.filter(r => r.fallback);
if (fallbackRows.length) {
    const ok10 = fallbackRows.filter(r => r.result === 'OK').length;
    console.log(`pts=10 fallback: ${ok10}/${fallbackRows.length} passed`);
}

if (ok12 === primary12.length) {
    console.log('\nCONCLUSION: pts=12 is reliable across all tested postcode/time combinations.');
} else {
    const failed = primary12.filter(r => r.result !== 'OK').map(r => `${r.postcode} ${r.minutes}min`);
    console.log(`\nCONCLUSION: pts=12 FAILED for: ${failed.join(', ')}`);
}

console.log('\nDone.');
