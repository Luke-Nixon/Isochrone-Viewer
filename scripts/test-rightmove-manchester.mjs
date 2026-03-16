// Two-part test:
// Part A: M1 1AE — test ALL point counts 6-30 against Rightmove (2s delays)
// Part B: Decode + analyse the 3 known-good polylines from test-polyline.mjs
//         vs M1 1AE 30-min isochrone full ring

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

// Known-good polylines (actual string values, not JS-escaped)
const KNOWN_GOOD = [
    { label: 'known-good #1', encoded: '_be}Ha`uBjhBiCi@kmGcN?_pA|[_AzjE}D~j@?cA' },
    { label: 'known-good #2', encoded: 'ki`}HuenBw|Dl_d@_jVdzRspFhkSdzHlx`@bwPdzRdpIkoFtqF}hRqIijp@~eJztAxfIljZnqJngJr|JoyCl}H_pUt~@gjp@erLcu|@vhD}yh@ufNinc@yqIor@c}Ex{D_sClw}@m|Fx~TipJxbHr^njZci@oyC' },
    { label: 'known-good #3', encoded: 'qig}HmvaEsAjbQzlDzKrA~\\gDrlCcrD`]fDx{DbrDhCoIpwDytDbP~[vfFzlDa]gDfn@qf@lTquBdP|Ffpb@ncAha@hmChC`q@{KeLm~RxeB}i@pf@gjBmQssFq}By}CtrCqwDlQ}gAyk@c`E}zBslCbeDsjD~[qpAon@kkHybCy}CbkBglA~x@ewB_\\_kF{eBqwDksAqG{c@re@fDpnB~x@hjB_y@ppAg~@?hDqpAqf@cyAy`A{KeLdPus@duClQ`bDfD?' },
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

// ── Decoder ───────────────────────────────────────────────────────────────────

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

// ── Geometry stats ────────────────────────────────────────────────────────────

function ringStats(ring) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let sumLat = 0, sumLng = 0;
    // use all points except closing duplicate for centroid/bbox
    const n = ring.length;
    // detect if ring is closed (first == last)
    const closed = ring.length >= 2 &&
        ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
    const pts = closed ? ring.slice(0, -1) : ring;

    for (const [lat, lng] of pts) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        sumLat += lat;
        sumLng += lng;
    }
    const centLat = sumLat / pts.length;
    const centLng = sumLng / pts.length;

    // Shoelace area in square degrees
    let area = 0;
    for (let i = 0; i < n - 1; i++) {
        area += ring[i][1] * ring[i + 1][0];
        area -= ring[i + 1][1] * ring[i][0];
    }
    const areaDeg2 = Math.abs(area) / 2;

    // Convert to km²: 1° lat ≈ 111.3 km; 1° lng ≈ 111.3 * cos(lat) km
    const cosLat = Math.cos(centLat * Math.PI / 180);
    const areaKm2 = areaDeg2 * 111.3 * 111.3 * cosLat;

    return {
        pts: pts.length,
        minLat, maxLat, minLng, maxLng,
        latRange: maxLat - minLat,
        lngRange: maxLng - minLng,
        centLat, centLng,
        areaDeg2, areaKm2,
    };
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
    return { status: res.status, notFound, ok: res.status === 200 && !notFound };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── PART B: Analyse known-good polylines ──────────────────────────────────────

console.log('='.repeat(72));
console.log('PART B: Known-good polyline analysis');
console.log('='.repeat(72));

console.log(`\n${'label'.padEnd(20)} | ${'pts'.padStart(4)} | ${'centLat'.padStart(8)} | ${'centLng'.padStart(8)} | ${'lat_range'.padStart(9)} | ${'lng_range'.padStart(9)} | ${'area_deg2'.padStart(10)} | ${'area_km2'.padStart(9)}`);
console.log(`${'-'.repeat(20)}-+-${'-'.repeat(4)}-+-${'-'.repeat(8)}-+-${'-'.repeat(8)}-+-${'-'.repeat(9)}-+-${'-'.repeat(9)}-+-${'-'.repeat(10)}-+-${'-'.repeat(9)}`);

const kgStats = [];
for (const { label, encoded } of KNOWN_GOOD) {
    const ring = decodePolyline(encoded);
    const s = ringStats(ring);
    kgStats.push({ label, encoded, ring, ...s });
    console.log(
        `${label.padEnd(20)} | ${String(s.pts).padStart(4)} | ${s.centLat.toFixed(4).padStart(8)} | ${s.centLng.toFixed(4).padStart(8)} | ${s.latRange.toFixed(4).padStart(9)} | ${s.lngRange.toFixed(4).padStart(9)} | ${s.areaDeg2.toFixed(5).padStart(10)} | ${s.areaKm2.toFixed(1).padStart(9)}`
    );
}

// ── Fetch M1 1AE isochrone for Part A and Part B stats ───────────────────────

console.log('\nGeocoding M1 1AE...');
const { lat, lng, display } = await geocode('M1 1AE');
console.log(`  ${lat.toFixed(5)}, ${lng.toFixed(5)} — ${display.split(',').slice(0,3).join(',')}`);

console.log('\nFetching M1 1AE 30-min isochrone...');
const raw30 = await getIsochrone(lat, lng, 30);
console.log(`  Raw ring: ${raw30.length} points`);

// Stats for the full raw ring
const rawStats = ringStats(raw30);
console.log(`\n${'M1 1AE 30min full ring'.padEnd(20)} | ${String(rawStats.pts).padStart(4)} | ${rawStats.centLat.toFixed(4).padStart(8)} | ${rawStats.centLng.toFixed(4).padStart(8)} | ${rawStats.latRange.toFixed(4).padStart(9)} | ${rawStats.lngRange.toFixed(4).padStart(9)} | ${rawStats.areaDeg2.toFixed(5).padStart(10)} | ${rawStats.areaKm2.toFixed(1).padStart(9)}`);

// ── PART A: M1 1AE, pts 6-30 Rightmove test ──────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('PART A: M1 1AE — testing pts=6 to pts=30 against Rightmove');
console.log(`25 tests with ${DELAY_MS}ms delay each ≈ ${Math.ceil(25 * DELAY_MS / 1000)}s`);
console.log('='.repeat(72) + '\n');

const rmResults = [];

for (let i = 0; i <= 24; i++) {
    const pc = 6 + i;
    if (i > 0) await delay(DELAY_MS);

    let ring = simplifyRing(raw30, pc);
    ring = forceClose(ring);
    const { encoded, url } = buildUrl(ring);
    const s = ringStats(ring);

    process.stdout.write(`  pts=${String(pc).padStart(2)}  enc=${String(encoded.length).padStart(4)}  url=${String(url.length).padStart(5)}  area=${s.areaKm2.toFixed(0).padStart(6)}km²  → `);

    let result, status;
    try {
        const r = await checkRightmove(url);
        status = r.status;
        result = r.ok ? 'OK' : '404';
    } catch (err) {
        status = null;
        result = 'ERR';
    }
    console.log(`HTTP ${status ?? '???'} → ${result}`);
    rmResults.push({ pc, encodedLen: encoded.length, urlLen: url.length, areaKm2: s.areaKm2, result });
}

// ── Summary tables ────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('PART A SUMMARY — M1 1AE 30-min, pts=6 to pts=30');
console.log('='.repeat(72));
console.log(`${'pts'.padStart(4)} | ${'enc_len'.padStart(7)} | ${'url_len'.padStart(7)} | ${'area_km2'.padStart(8)} | result`);
console.log(`${'-'.repeat(4)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-${'-'.repeat(8)}-+-------`);
for (const r of rmResults) {
    console.log(`${String(r.pc).padStart(4)} | ${String(r.encodedLen).padStart(7)} | ${String(r.urlLen).padStart(7)} | ${r.areaKm2.toFixed(0).padStart(8)} | ${r.result}`);
}

const okCounts = rmResults.filter(r => r.result === 'OK').map(r => r.pc);
const failCounts = rmResults.filter(r => r.result !== 'OK').map(r => r.pc);
console.log(`\nOK:   ${okCounts.length ? okCounts.join(', ') : 'none'}`);
console.log(`FAIL: ${failCounts.join(', ')}`);

// ── Area comparison ───────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('AREA COMPARISON');
console.log('='.repeat(72));
console.log(`Known-good polygons:`);
for (const s of kgStats) {
    console.log(`  ${s.label}: ${s.pts} pts, centroid=(${s.centLat.toFixed(3)},${s.centLng.toFixed(3)}), area=${s.areaKm2.toFixed(1)} km²`);
}
console.log(`\nM1 1AE 30-min isochrone (full ring, ${rawStats.pts} pts):`);
console.log(`  centroid=(${rawStats.centLat.toFixed(3)},${rawStats.centLng.toFixed(3)}), area=${rawStats.areaKm2.toFixed(1)} km²`);
console.log(`\nM1 1AE simplified rings area range: ${Math.min(...rmResults.map(r=>r.areaKm2)).toFixed(1)} – ${Math.max(...rmResults.map(r=>r.areaKm2)).toFixed(1)} km²`);

console.log('\nDone.');
