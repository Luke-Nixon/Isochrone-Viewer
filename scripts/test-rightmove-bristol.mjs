// Test A: BS1 4DJ — full scan pts 6-50 (uniform resampling)
// Test B: Angular sampling N=10,12,16,20 for Bristol + CM77 7UE verification
// 2.5s delay between all Rightmove requests

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2500;

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

// ── Uniform resampling + forceClose ──────────────────────────────────────────

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

// ── Angular sampling ──────────────────────────────────────────────────────────

function angularSample(ring, n) {
    // Use all unique points (exclude closing duplicate if present)
    const pts = (ring.length >= 2 &&
        ring[0][0] === ring[ring.length-1][0] &&
        ring[0][1] === ring[ring.length-1][1])
        ? ring.slice(0, -1) : ring;

    // Centroid
    let cLat = 0, cLng = 0;
    for (const [lat, lng] of pts) { cLat += lat; cLng += lng; }
    cLat /= pts.length; cLng /= pts.length;

    // For each of N evenly-spaced angular directions, find the ring vertex
    // with the largest dot product with that direction unit vector.
    // Direction unit vector for angle θ (from north, clockwise):
    //   dx = sin(θ) in lng dimension, dy = cos(θ) in lat dimension
    // Dot product with point p relative to centroid:
    //   (p.lat - cLat)*cos(θ) + (p.lng - cLng)*sin(θ)

    const selectedIndices = new Set();
    for (let i = 0; i < n; i++) {
        const theta = (2 * Math.PI * i) / n; // evenly spaced, starting at north
        const dy = Math.cos(theta); // lat component
        const dx = Math.sin(theta); // lng component
        let bestDot = -Infinity, bestIdx = 0;
        for (let j = 0; j < pts.length; j++) {
            const dot = (pts[j][0] - cLat) * dy + (pts[j][1] - cLng) * dx;
            if (dot > bestDot) { bestDot = dot; bestIdx = j; }
        }
        selectedIndices.add(bestIdx);
    }

    // Collect selected vertices, then sort by bearing from centroid to maintain
    // polygon winding order (counter-clockwise by bearing ascending = CCW)
    const selected = Array.from(selectedIndices).map(idx => {
        const [lat, lng] = pts[idx];
        const bearing = Math.atan2(lng - cLng, lat - cLat); // angle in lat/lng plane
        return { lat, lng, bearing, idx };
    });

    // Sort by bearing (ascending = CCW when viewed in lat/lng space)
    selected.sort((a, b) => a.bearing - b.bearing);

    // Build closed ring
    const result = selected.map(p => [p.lat, p.lng]);
    result.push([result[0][0], result[0][1]]); // close
    return { ring: result, centLat: cLat, centLng: cLng, uniquePts: selected.length };
}

// ── URL builder ───────────────────────────────────────────────────────────────

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
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
        },
        redirect: 'follow',
    });
    const notFound = res.url.includes('page-not-found');
    return { status: res.status, ok: res.status === 200 && !notFound };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testUrl(label, ring, isFirst) {
    if (!isFirst) await delay(DELAY_MS);
    const { encoded, url } = buildUrl(ring);
    process.stdout.write(`  ${label}  enc=${String(encoded.length).padStart(4)}  url=${String(url.length).padStart(5)}  → `);
    let result;
    try {
        const r = await checkRightmove(url);
        result = r.ok ? 'OK' : '404';
    } catch (err) {
        result = 'ERR';
    }
    console.log(result);
    return { label, encLen: encoded.length, urlLen: url.length, result };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('Bristol BS1 4DJ + CM77 7UE — uniform scan and angular sampling');
console.log(`Delay between Rightmove requests: ${DELAY_MS}ms`);
console.log('='.repeat(72));

console.log('\nGeocoding...');
const bristolCoord  = await geocode('BS1 4DJ');
const essexCoord    = await geocode('CM77 7UE');
console.log(`  BS1 4DJ  (Bristol):   ${bristolCoord.lat.toFixed(5)}, ${bristolCoord.lng.toFixed(5)}`);
console.log(`  CM77 7UE (Essex):     ${essexCoord.lat.toFixed(5)}, ${essexCoord.lng.toFixed(5)}`);

console.log('\nFetching 30-min isochrones...');
const bristolRing = await getIsochrone(bristolCoord.lat, bristolCoord.lng, 30);
const essexRing   = await getIsochrone(essexCoord.lat,   essexCoord.lng,   30);
console.log(`  BS1 4DJ  raw ring: ${bristolRing.length} points`);
console.log(`  CM77 7UE raw ring: ${essexRing.length} points`);

// ── TEST A: Bristol full scan pts 6-50 ───────────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('TEST A: BS1 4DJ — uniform resampling, pts=6 to pts=50');
console.log(`45 requests × ${DELAY_MS}ms ≈ ${Math.ceil(45 * DELAY_MS / 1000)}s`);
console.log('='.repeat(72) + '\n');

const testAResults = [];
let requestCount = 0;

for (let pc = 6; pc <= 50; pc++) {
    let ring = simplifyRing(bristolRing, pc);
    ring = forceClose(ring);
    const r = await testUrl(`BS1 4DJ  pts=${String(pc).padStart(2)} [uniform]`, ring, requestCount === 0);
    testAResults.push({ pc, ...r });
    requestCount++;
}

// ── TEST B: Angular sampling ──────────────────────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('TEST B: Angular sampling — Bristol and CM77 7UE');
const angularNs = [10, 12, 16, 20];
console.log(`N values: ${angularNs.join(', ')} — ${angularNs.length * 2} requests × ${DELAY_MS}ms ≈ ${Math.ceil(angularNs.length * 2 * DELAY_MS / 1000)}s`);
console.log('='.repeat(72) + '\n');

const testBResults = [];

for (const n of angularNs) {
    const { ring, uniquePts } = angularSample(bristolRing, n);
    const r = await testUrl(`BS1 4DJ  N=${String(n).padStart(2)} [angular, ${uniquePts} unique pts]`, ring, false);
    testBResults.push({ location: 'BS1 4DJ', n, uniquePts, ...r });
}

for (const n of angularNs) {
    const { ring, uniquePts } = angularSample(essexRing, n);
    const r = await testUrl(`CM77 7UE N=${String(n).padStart(2)} [angular, ${uniquePts} unique pts]`, ring, false);
    testBResults.push({ location: 'CM77 7UE', n, uniquePts, ...r });
}

// ── Summary tables ────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('TEST A SUMMARY — BS1 4DJ uniform resampling pts=6 to pts=50');
console.log('='.repeat(72));
console.log(`${'pts'.padStart(4)} | ${'enc_len'.padStart(7)} | ${'url_len'.padStart(7)} | result`);
console.log(`${'-'.repeat(4)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-------`);
for (const r of testAResults) {
    const marker = r.result === 'OK' ? '  <<<' : '';
    console.log(`${String(r.pc).padStart(4)} | ${String(r.encLen).padStart(7)} | ${String(r.urlLen).padStart(7)} | ${r.result}${marker}`);
}
const aOk   = testAResults.filter(r => r.result === 'OK').map(r => r.pc);
const aFail = testAResults.filter(r => r.result !== 'OK').map(r => r.pc);
console.log(`\nOK:   ${aOk.length ? aOk.join(', ') : 'NONE — no uniform count worked for Bristol'}`);
console.log(`FAIL: ${aFail.join(', ')}`);

console.log('\n' + '='.repeat(72));
console.log('TEST B SUMMARY — Angular sampling');
console.log('='.repeat(72));
console.log(`${'location'.padEnd(10)} | ${'N'.padStart(4)} | ${'unique_pts'.padStart(10)} | ${'enc_len'.padStart(7)} | ${'url_len'.padStart(7)} | result`);
console.log(`${'-'.repeat(10)}-+-${'-'.repeat(4)}-+-${'-'.repeat(10)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-------`);
for (const r of testBResults) {
    const marker = r.result === 'OK' ? '  <<<' : '';
    console.log(`${r.location.padEnd(10)} | ${String(r.n).padStart(4)} | ${String(r.uniquePts).padStart(10)} | ${String(r.encLen).padStart(7)} | ${String(r.urlLen).padStart(7)} | ${r.result}${marker}`);
}

const bristolAngularOk = testBResults.filter(r => r.location === 'BS1 4DJ'  && r.result === 'OK');
const essexAngularOk   = testBResults.filter(r => r.location === 'CM77 7UE' && r.result === 'OK');
console.log(`\nAngular — BS1 4DJ  OK at N: ${bristolAngularOk.length ? bristolAngularOk.map(r=>r.n).join(', ') : 'none'}`);
console.log(`Angular — CM77 7UE OK at N: ${essexAngularOk.length   ? essexAngularOk.map(r=>r.n).join(', ')   : 'none'}`);

console.log('\nDone.');
