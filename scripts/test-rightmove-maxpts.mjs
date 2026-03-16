// Critical re-test: CM77 7UE 30-min with snap fix applied.
// Tests pts 23,25,30,35,40,50,60,80,100 to find the real URL length ceiling
// (or confirm all pass now that the closure bug is fixed).

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

const POINT_COUNTS = [23, 25, 30, 35, 40, 50, 60, 80, 100];

// ── Core ──────────────────────────────────────────────────────────────────────

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

function buildUrl(encoded) {
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    return `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
}

function roundTripClosed(ring) {
    const encoded = encodePolyline(ring);
    const decoded = decodePolyline(encoded);
    if (decoded.length < 2) return false;
    const f = decoded[0], l = decoded[decoded.length - 1];
    return f[0] === l[0] && f[1] === l[1];
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

console.log('='.repeat(70));
console.log('CM77 7UE 30-min — max pts test WITH snap fix');
console.log(`Point counts: ${POINT_COUNTS.join(', ')}`);
console.log('Pipeline: simplifyRing → forceClose → snapRing → encode → Rightmove');
console.log('='.repeat(70));

const { lat, lng } = await geocode('CM77 7UE');
console.log(`\nGeocoded CM77 7UE: lat=${lat}, lng=${lng}`);

const rawRing = await getIsochrone(lat, lng, 30);
console.log(`Raw ring: ${rawRing.length} points\n`);

const results = [];

for (let i = 0; i < POINT_COUNTS.length; i++) {
    const pc = POINT_COUNTS[i];
    if (i > 0) await delay(DELAY_MS);

    let ring = simplifyRing(rawRing, pc);
    ring = forceClose(ring);
    ring = ring.map(([lat, lng]) => [snap(lat), snap(lng)]);

    const closed = roundTripClosed(ring);
    const encoded = encodePolyline(ring);
    const url = buildUrl(encoded);

    process.stdout.write(`  pts=${String(pc).padStart(3)}  enc=${String(encoded.length).padStart(4)}  url=${String(url.length).padStart(5)}  closed=${String(closed).padStart(5)}  → `);

    let result;
    try {
        const r = await checkRightmove(url);
        result = r.ok ? 'OK' : '404';
    } catch (err) {
        result = 'ERR';
    }
    const marker = result === 'OK' ? '' : '  <<<FAIL';
    console.log(`${result}${marker}`);
    results.push({ pc, encodedLen: encoded.length, urlLen: url.length, closed, result });
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(70));
console.log('SUMMARY TABLE');
console.log('='.repeat(70));
console.log(`${'pts'.padStart(5)} | ${'enc_len'.padStart(7)} | ${'url_len'.padStart(7)} | ${'closed'.padStart(6)} | result`);
console.log(`${'-'.repeat(5)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-${'-'.repeat(6)}-+-------`);
for (const r of results) {
    const marker = r.result !== 'OK' ? '  <<<' : '';
    console.log(`${String(r.pc).padStart(5)} | ${String(r.encodedLen).padStart(7)} | ${String(r.urlLen).padStart(7)} | ${String(r.closed).padStart(6)} | ${r.result}${marker}`);
}

const okCounts   = results.filter(r => r.result === 'OK');
const failCounts = results.filter(r => r.result !== 'OK');

console.log(`\nOK:   ${okCounts.length ? okCounts.map(r => `pts=${r.pc}(url=${r.urlLen})`).join(', ') : 'none'}`);
console.log(`FAIL: ${failCounts.length ? failCounts.map(r => `pts=${r.pc}(url=${r.urlLen})`).join(', ') : 'none'}`);

if (failCounts.length === 0) {
    console.log('\nCONCLUSION: ALL passed — the previous 23+ failures were entirely');
    console.log('caused by the closure bug (missing snap). No URL length ceiling found');
    console.log(`in this range (max url_len tested: ${Math.max(...results.map(r=>r.urlLen))}).`);
} else {
    const lastOk   = okCounts.at(-1);
    const firstFail = failCounts[0];
    console.log(`\nCONCLUSION: Failures begin at pts=${firstFail.pc} (url_len=${firstFail.urlLen}).`);
    if (lastOk) console.log(`Last OK: pts=${lastOk.pc} (url_len=${lastOk.urlLen}).`);
    console.log('A real URL length or point-count ceiling may exist in this range.');
}

console.log('\nDone.');
