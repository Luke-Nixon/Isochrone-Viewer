// Test convex hull approach for Rightmove polygon URLs.
// Computes convex hull of the full Valhalla isochrone ring and tests it
// against Rightmove, comparing with known-working uniform-resampled counts.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

// ── Cross product (shared by hull and self-intersection checks) ───────────────

function cross(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// ── Gift-wrapping convex hull ─────────────────────────────────────────────────

function convexHull(points) {
    // Find bottom-most (min lat) point; break ties by min lng
    let start = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i][0] < points[start][0] ||
           (points[i][0] === points[start][0] && points[i][1] < points[start][1]))
            start = i;
    }
    const hull = [];
    let current = start;
    do {
        hull.push(points[current]);
        let next = (current + 1) % points.length;
        for (let i = 0; i < points.length; i++) {
            const c = cross(points[current], points[next], points[i]);
            if (c < 0) next = i;
        }
        current = next;
    } while (current !== start);
    hull.push(hull[0]); // close ring
    return hull;
}

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

// ── Uniform resampling (for comparison) ──────────────────────────────────────

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

// ── Geometry stats ────────────────────────────────────────────────────────────

function shoelaceArea(ring) {
    let area = 0;
    const n = ring.length;
    for (let i = 0; i < n - 1; i++) {
        area += ring[i][1] * ring[i + 1][0];
        area -= ring[i + 1][1] * ring[i][0];
    }
    return Math.abs(area) / 2;
}

function boundingBox(ring) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }
    return { minLat, maxLat, minLng, maxLng };
}

function isConvex(ring) {
    // All cross products of consecutive edges should have the same sign
    let sign = 0;
    const n = ring.length - 1; // last == first, so use n-1 edges
    for (let i = 0; i < n; i++) {
        const c = cross(ring[i], ring[(i + 1) % n], ring[(i + 2) % n]);
        if (c !== 0) {
            const s = c > 0 ? 1 : -1;
            if (sign === 0) sign = s;
            else if (s !== sign) return false;
        }
    }
    return true;
}

// ── URL builder ───────────────────────────────────────────────────────────────

function buildUrl(ring) {
    const encoded = encodePolyline(ring);
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    const url = `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
    return { encoded, url };
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
    return { status: res.status, notFound, ok: res.status === 200 && !notFound };
}

// ── Network helpers ───────────────────────────────────────────────────────────

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
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('No features in Valhalla response');
    const ring = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0][0];
    return { data, rawRing: ring.map(([lng, lat]) => [lat, lng]) };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Run one isochrone test ────────────────────────────────────────────────────

async function testIsochrone(label, lat, lng, minutes, comparisonCounts, isFirst) {
    if (!isFirst) await delay(DELAY_MS);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`${label} — ${minutes}-min driving isochrone`);
    console.log('='.repeat(70));

    const { rawRing } = await getIsochrone(lat, lng, minutes);
    console.log(`Raw ring: ${rawRing.length} points`);

    // ── Convex hull ───────────────────────────────────────────────────────────
    const hull = convexHull(rawRing);
    const hullPts = hull.length - 1; // exclude closing duplicate
    const hullBbox = boundingBox(hull);
    const hullArea = shoelaceArea(hull);
    const hullConvex = isConvex(hull);
    const { encoded: hullEncoded, url: hullUrl } = buildUrl(hull);

    console.log(`\nConvex hull: ${hullPts} points (ring has ${hull.length} incl. closing point)`);
    console.log(`  convex check: ${hullConvex}`);
    console.log(`  encoded length: ${hullEncoded.length}`);
    console.log(`  url length: ${hullUrl.length}`);
    console.log(`  bbox: lat [${hullBbox.minLat.toFixed(4)}, ${hullBbox.maxLat.toFixed(4)}]  lng [${hullBbox.minLng.toFixed(4)}, ${hullBbox.maxLng.toFixed(4)}]`);
    console.log(`  area (deg²): ${hullArea.toFixed(6)}`);
    console.log(`  encoded: ${hullEncoded}`);
    console.log(`  hull vertices (lat, lng):`);
    for (let i = 0; i < hull.length - 1; i++) {
        console.log(`    [${String(i).padStart(2)}] ${hull[i][0].toFixed(5)}, ${hull[i][1].toFixed(5)}`);
    }

    await delay(DELAY_MS);
    process.stdout.write(`\nTesting convex hull URL against Rightmove... `);
    const hullResult = await checkRightmove(hullUrl);
    console.log(`HTTP ${hullResult.status} → ${hullResult.ok ? 'OK' : '404/REJECTED'}`);

    // ── Comparison: known-working uniform-resampled counts ────────────────────
    const compResults = [];
    for (const pc of comparisonCounts) {
        await delay(DELAY_MS);
        let ring = simplifyRing(rawRing, pc);
        ring = forceClose(ring);
        const { encoded, url } = buildUrl(ring);
        process.stdout.write(`Testing uniform pts=${pc}... `);
        const r = await checkRightmove(url);
        console.log(`HTTP ${r.status} → ${r.ok ? 'OK' : '404/REJECTED'}`);
        compResults.push({ pc, encodedLen: encoded.length, urlLen: url.length, ok: r.ok });
    }

    return { label, minutes, hullPts, hullEncLen: hullEncoded.length, hullUrlLen: hullUrl.length, hullOk: hullResult.ok, compResults };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('='.repeat(70));
console.log('Convex hull Rightmove test — 30-min and 60-min isochrones');
console.log('='.repeat(70));

const { lat, lng } = await geocode('CM77 7UE');
console.log(`Geocoded CM77 7UE: lat=${lat}, lng=${lng}`);

// Known-working counts from previous runs (use 10, 12, 20 as cheap comparison set)
const compCounts30 = [10, 12, 20];
const compCounts60 = [10, 12, 20];

const r30 = await testIsochrone('CM77 7UE 30-min', lat, lng, 30, compCounts30, true);
const r60 = await testIsochrone('CM77 7UE 60-min', lat, lng, 60, compCounts60, false);

// ── Final comparison table ────────────────────────────────────────────────────

console.log(`\n${'='.repeat(70)}`);
console.log('COMPARISON TABLE');
console.log('='.repeat(70));
console.log(`${'method'.padEnd(22)} | ${'iso'.padStart(5)} | ${'pts'.padStart(5)} | ${'enc_len'.padStart(7)} | ${'url_len'.padStart(7)} | result`);
console.log(`${'-'.repeat(22)}-+-${'-'.repeat(5)}-+-${'-'.repeat(5)}-+-${'-'.repeat(7)}-+-${'-'.repeat(7)}-+-------`);

for (const r of [r30, r60]) {
    const isoLabel = `${r.minutes}min`;
    console.log(
        `${'convex hull'.padEnd(22)} | ${isoLabel.padStart(5)} | ${String(r.hullPts).padStart(5)} | ${String(r.hullEncLen).padStart(7)} | ${String(r.hullUrlLen).padStart(7)} | ${r.hullOk ? 'OK' : '404/REJECTED'}`
    );
    for (const c of r.compResults) {
        console.log(
            `${'uniform resample'.padEnd(22)} | ${isoLabel.padStart(5)} | ${String(c.pc).padStart(5)} | ${String(c.encodedLen).padStart(7)} | ${String(c.urlLen).padStart(7)} | ${c.ok ? 'OK' : '404/REJECTED'}`
        );
    }
}

console.log('='.repeat(70));
console.log('\nDone.');
