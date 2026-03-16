// Extreme point count test: 200, 500, 1000, full raw ring.
// CM77 7UE 30-min driving isochrone, snap fix applied.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

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

function buildUrl(encoded) {
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    return `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
}

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

console.log('='.repeat(70));
console.log('CM77 7UE 30-min — extreme point counts with snap fix');
console.log('Counts: 200, 500, 1000, full raw ring');
console.log('='.repeat(70));

const { lat, lng } = await geocode('CM77 7UE');
console.log(`\nGeocoded: lat=${lat}, lng=${lng}`);

const rawRing = await getIsochrone(lat, lng, 30);
console.log(`Raw ring: ${rawRing.length} points\n`);

// Build test cases: named point counts + the full raw ring
const cases = [
    { label: '200',      pts: 200,             ring: simplifyRing(rawRing, 200) },
    { label: '500',      pts: 500,             ring: simplifyRing(rawRing, 500) },
    { label: '1000',     pts: 1000,            ring: simplifyRing(rawRing, 1000) },
    { label: 'full raw', pts: rawRing.length,  ring: [...rawRing] },
];

// Apply forceClose + snap to all
for (const c of cases) {
    c.ring = forceClose(c.ring);
    c.ring = c.ring.map(([lat, lng]) => [snap(lat), snap(lng)]);
    c.encoded = encodePolyline(c.ring);
    c.url = buildUrl(c.encoded);
}

console.log(`${'label'.padEnd(10)} | ${'pts'.padStart(6)} | ${'enc_len'.padStart(8)} | ${'url_len'.padStart(8)}`);
console.log(`${'-'.repeat(10)}-+-${'-'.repeat(6)}-+-${'-'.repeat(8)}-+-${'-'.repeat(8)}`);
for (const c of cases) {
    console.log(`${c.label.padEnd(10)} | ${String(c.pts).padStart(6)} | ${String(c.encoded.length).padStart(8)} | ${String(c.url.length).padStart(8)}`);
}
console.log('');

const results = [];
for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (i > 0) await delay(DELAY_MS);
    process.stdout.write(`  ${c.label.padEnd(10)} pts=${String(c.pts).padStart(5)}  enc=${String(c.encoded.length).padStart(5)}  url=${String(c.url.length).padStart(6)}  → `);
    let result;
    try {
        const r = await checkRightmove(c.url);
        result = r.ok ? 'OK' : '404';
    } catch (err) {
        result = 'ERR';
    }
    console.log(`${result}${result !== 'OK' ? '  <<<FAIL' : ''}`);
    results.push({ ...c, result });
}

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`${'label'.padEnd(10)} | ${'pts'.padStart(6)} | ${'enc_len'.padStart(8)} | ${'url_len'.padStart(8)} | result`);
console.log(`${'-'.repeat(10)}-+-${'-'.repeat(6)}-+-${'-'.repeat(8)}-+-${'-'.repeat(8)}-+-------`);
for (const r of results) {
    console.log(`${r.label.padEnd(10)} | ${String(r.pts).padStart(6)} | ${String(r.encoded.length).padStart(8)} | ${String(r.url.length).padStart(8)} | ${r.result}`);
}

const allOk = results.every(r => r.result === 'OK');
if (allOk) {
    console.log('\nAll passed. No upper limit found up to the full raw ring.');
} else {
    const firstFail = results.find(r => r.result !== 'OK');
    console.log(`\nFirst failure: ${firstFail.label} (pts=${firstFail.pts}, url_len=${firstFail.url.length})`);
}
console.log('\nDone.');
