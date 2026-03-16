// Full Rightmove acceptance test for all point counts 8–40.
// Geocodes CM77 7UE → Valhalla 30-min isochrone → simplify to N points
// → encode → bbox + area → GET Rightmove → report table.
// Self-contained — no imports from src/

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DELAY_MS = 2000;

// Every integer from 8 to 40 inclusive, then double-check 12 and 20
const POINT_COUNTS = Array.from({ length: 40 - 8 + 1 }, (_, i) => i + 8);
const DOUBLE_CHECK = [12, 20];

// ── Google Encoded Polyline encoder ──────────────────────────────────────────

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

// ── Uniform resampling ────────────────────────────────────────────────────────

function simplifyRing(ring, maxPoints) {
    if (ring.length <= maxPoints) return ring;
    const step = (ring.length - 1) / (maxPoints - 1);
    const result = [];
    for (let i = 0; i < maxPoints - 1; i++) result.push(ring[Math.round(i * step)]);
    result.push(ring[ring.length - 1]);
    return result;
}

// ── Force-close: copy first point to last slot ────────────────────────────────

function forceClose(ring) {
    if (ring.length === 0) return ring;
    const result = [...ring];
    result[result.length - 1] = [result[0][0], result[0][1]];
    return result;
}

// ── Bounding box ──────────────────────────────────────────────────────────────

function boundingBox(ring) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }
    return { minLat, maxLat, minLng, maxLng };
}

// ── Shoelace area (in square degrees — relative comparison only) ──────────────

function shoelaceArea(ring) {
    let area = 0;
    const n = ring.length;
    for (let i = 0; i < n - 1; i++) {
        area += ring[i][1] * ring[i + 1][0]; // lng_i * lat_{i+1}
        area -= ring[i + 1][1] * ring[i][0]; // lng_{i+1} * lat_i
    }
    return Math.abs(area) / 2;
}

// ── Geocode ───────────────────────────────────────────────────────────────────

async function geocode(postcode) {
    console.log(`\n[1] Geocoding: ${postcode}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    if (!data.length) throw new Error(`No result for ${postcode}`);
    const { lat, lon, display_name } = data[0];
    console.log(`    lat=${lat}, lng=${lon} — ${display_name}`);
    return { lat: parseFloat(lat), lng: parseFloat(lon) };
}

// ── Valhalla isochrone ────────────────────────────────────────────────────────

async function getIsochrone(lat, lng, minutes) {
    console.log(`\n[2] Valhalla isochrone (${minutes} min, auto)`);
    const url = 'https://valhalla1.openstreetmap.de/isochrone';
    const body = { locations: [{ lon: lng, lat }], costing: 'auto', contours: [{ time: minutes }], polygons: true };
    const res = await fetch(url, {
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
    console.log(`    geometry=${feature.geometry.type}, ring points=${ring.length}`);
    return data;
}

// ── Extract raw [lat,lng] ring from GeoJSON ───────────────────────────────────

function extractRawLatLngs(isochroneData) {
    const { geometry } = isochroneData.features[0];
    const ring = geometry.type === 'Polygon'
        ? geometry.coordinates[0]
        : geometry.coordinates[0][0];
    return ring.map(([lng, lat]) => [lat, lng]); // GeoJSON [lng,lat] → [lat,lng]
}

// ── Rightmove fetch ───────────────────────────────────────────────────────────

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
    return { status: res.status, finalUrl: res.url, notFound };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Build everything for one point count ─────────────────────────────────────

function buildForCount(rawLatLngs, pointCount) {
    let ring = simplifyRing(rawLatLngs, pointCount);
    ring = forceClose(ring);
    const encoded = encodePolyline(ring);
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    const url = `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
    const bbox = boundingBox(ring);
    const area = shoelaceArea(ring);
    // Closed = first point equals last point after forceClose
    const first = ring[0], last = ring[ring.length - 1];
    const closed = first[0] === last[0] && first[1] === last[1];
    return { ring, encoded, url, bbox, area, closed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('='.repeat(80));
console.log('Rightmove acceptance test — all point counts 8–40 + double-check 12 & 20');
console.log(`${POINT_COUNTS.length} main tests + ${DOUBLE_CHECK.length * 2} double-check runs`);
console.log(`Delay between Rightmove requests: ${DELAY_MS}ms`);
console.log('='.repeat(80));

const { lat, lng } = await geocode('CM77 7UE');
const isochroneData = await getIsochrone(lat, lng, 30);
const rawLatLngs = extractRawLatLngs(isochroneData);
console.log(`\n[3] Raw ring: ${rawLatLngs.length} points\n`);

// ── Phase 1: 8–40 ────────────────────────────────────────────────────────────

console.log('[4] Testing point counts 8–40 against Rightmove...\n');

const results = [];

for (let i = 0; i < POINT_COUNTS.length; i++) {
    const pointCount = POINT_COUNTS[i];
    if (i > 0) await delay(DELAY_MS);

    const { encoded, url, bbox, area, closed } = buildForCount(rawLatLngs, pointCount);
    const latRange = (bbox.maxLat - bbox.minLat).toFixed(4);
    const lngRange = (bbox.maxLng - bbox.minLng).toFixed(4);
    const closedStr = closed ? 'YES' : 'NO ';

    let status, notFound, error;
    try {
        ({ status, notFound } = await checkRightmove(url));
        error = null;
    } catch (err) {
        status = null; notFound = null; error = err.message;
    }

    const ok = !error && status === 200 && !notFound;
    const resultStr = error ? 'ERROR' : ok ? 'OK' : '404';

    console.log(`  pts=${String(pointCount).padStart(2)}  closed=${closedStr}  enc=${String(encoded.length).padStart(4)}  url=${String(url.length).padStart(5)}  lat±${latRange}  lng±${lngRange}  area=${area.toFixed(6)}  → ${resultStr}`);

    results.push({ pointCount, closed, encodedLen: encoded.length, urlLen: url.length, latRange, lngRange, area: area.toFixed(6), ok, resultStr, run: 'main' });
}

// ── Phase 2: double-check 12 and 20 ──────────────────────────────────────────

console.log(`\n[5] Double-checking pts=12 and pts=20 (2 runs each)...\n`);

const doubleCheckResults = [];
const dcList = [...DOUBLE_CHECK, ...DOUBLE_CHECK]; // [12, 20, 12, 20]

for (let i = 0; i < dcList.length; i++) {
    const pointCount = dcList[i];
    await delay(DELAY_MS);

    const { encoded, url, bbox, area, closed } = buildForCount(rawLatLngs, pointCount);
    const latRange = (bbox.maxLat - bbox.minLat).toFixed(4);
    const lngRange = (bbox.maxLng - bbox.minLng).toFixed(4);
    const closedStr = closed ? 'YES' : 'NO ';
    const run = i < DOUBLE_CHECK.length ? 'check-1' : 'check-2';

    let status, notFound, error;
    try {
        ({ status, notFound } = await checkRightmove(url));
        error = null;
    } catch (err) {
        status = null; notFound = null; error = err.message;
    }

    const ok = !error && status === 200 && !notFound;
    const resultStr = error ? 'ERROR' : ok ? 'OK' : '404';

    console.log(`  [${run}] pts=${String(pointCount).padStart(2)}  closed=${closedStr}  enc=${String(encoded.length).padStart(4)}  url=${String(url.length).padStart(5)}  lat±${latRange}  lng±${lngRange}  area=${area.toFixed(6)}  → ${resultStr}`);

    doubleCheckResults.push({ pointCount, closed, encodedLen: encoded.length, urlLen: url.length, latRange, lngRange, area: area.toFixed(6), ok, resultStr, run });
}

// ── Summary table ─────────────────────────────────────────────────────────────

const allResults = [...results, ...doubleCheckResults];

console.log(`\n${'='.repeat(90)}`);
console.log('FULL SUMMARY TABLE');
console.log('='.repeat(90));
console.log(
    `${'pts'.padStart(5)} | ${'run'.padStart(7)} | ${'closed'.padStart(6)} | ${'enc_len'.padStart(7)} | ${'url_len'.padStart(7)} | ${'lat_range'.padStart(9)} | ${'lng_range'.padStart(9)} | ${'area(deg²)'.padStart(10)} | result`
);
console.log(`${'-'.repeat(5)}-+-${'-'.repeat(7)}-+-${'-'.repeat(6)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-${'-'.repeat(9)}-+-${'-'.repeat(9)}-+-${'-'.repeat(10)}-+-------`);

for (const r of allResults) {
    console.log(
        `${String(r.pointCount).padStart(5)} | ${r.run.padStart(7)} | ${(r.closed ? 'YES' : 'NO').padStart(6)} | ${String(r.encodedLen).padStart(7)} | ${String(r.urlLen).padStart(7)} | ${r.latRange.padStart(9)} | ${r.lngRange.padStart(9)} | ${r.area.padStart(10)} | ${r.resultStr}`
    );
}

console.log('='.repeat(90));

const okCounts   = results.filter(r => r.ok).map(r => r.pointCount);
const failCounts = results.filter(r => !r.ok).map(r => r.pointCount);

console.log(`\nMain run — OK:   ${okCounts.length ? okCounts.join(', ') : 'none'}`);
console.log(`Main run — 404:  ${failCounts.length ? failCounts.join(', ') : 'none'}`);

for (const pc of DOUBLE_CHECK) {
    const dc = doubleCheckResults.filter(r => r.pointCount === pc);
    const votes = dc.map(r => r.resultStr).join(', ');
    console.log(`Double-check pts=${pc}: ${votes}`);
}

console.log('\nDone.');
