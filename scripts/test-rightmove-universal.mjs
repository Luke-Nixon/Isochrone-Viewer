// Test pts=19 and pts=20 across 4 UK postcodes (30-min driving).
// If pts=20 fails for any location, also retry pts=18, 22, 24 for that location.

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

const LOCATIONS = [
    { postcode: 'EC1A 1BB', city: 'London'     },
    { postcode: 'BS1 4DJ',  city: 'Bristol'    },
    { postcode: 'EH1 1YZ',  city: 'Edinburgh'  },
    { postcode: 'B1 1BB',   city: 'Birmingham' },
];
const PRIMARY_PTS   = [19, 20];
const FALLBACK_PTS  = [18, 22, 24];

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

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('Universal pts=20 test — 4 UK cities, 30-min driving isochrone');
console.log('Primary: pts=19, 20 | Fallback on pts=20 fail: pts=18, 22, 24');
console.log('='.repeat(72));

// Step 1: geocode all locations
console.log('\nGeocoding...');
for (const loc of LOCATIONS) {
    try {
        const { lat, lng } = await geocode(loc.postcode);
        loc.lat = lat; loc.lng = lng;
        console.log(`  ${loc.postcode} (${loc.city}): ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch (err) {
        console.log(`  ${loc.postcode} ERROR: ${err.message}`);
        loc.error = err.message;
    }
}

// Step 2: fetch isochrones
console.log('\nFetching 30-min isochrones...');
for (const loc of LOCATIONS) {
    if (loc.error) { loc.ring = null; continue; }
    try {
        loc.ring = await getIsochrone(loc.lat, loc.lng, 30);
        console.log(`  ${loc.postcode} (${loc.city}): ${loc.ring.length} raw ring points`);
    } catch (err) {
        console.log(`  ${loc.postcode} isochrone ERROR: ${err.message}`);
        loc.ring = null;
        loc.isoError = err.message;
    }
}

// Step 3: test PRIMARY_PTS against Rightmove for all locations
console.log('\n' + '='.repeat(72));
console.log('Testing primary point counts (pts=19, pts=20)...');
console.log('='.repeat(72));

const rows = [];
let firstRequest = true;

for (const loc of LOCATIONS) {
    if (!loc.ring) {
        for (const pts of PRIMARY_PTS) {
            rows.push({ postcode: loc.postcode, city: loc.city, pts, urlLen: '—', result: loc.error || loc.isoError || 'ERROR', fallback: false });
        }
        continue;
    }

    for (const pts of PRIMARY_PTS) {
        if (!firstRequest) await delay(DELAY_MS);
        firstRequest = false;

        let ring = simplifyRing(loc.ring, pts);
        ring = forceClose(ring);
        const { encoded, url } = buildUrl(ring);

        process.stdout.write(`  ${loc.postcode} pts=${pts}  enc=${encoded.length}  url=${url.length}  → `);

        let result;
        try {
            const r = await checkRightmove(url);
            result = r.ok ? 'OK' : '404';
        } catch (err) {
            result = 'ERR';
        }
        console.log(result);
        rows.push({ postcode: loc.postcode, city: loc.city, pts, urlLen: url.length, result, fallback: false });
    }
}

// Step 4: fallback retries for locations where pts=20 failed
const pt20Failures = LOCATIONS.filter(loc =>
    loc.ring && rows.some(r => r.postcode === loc.postcode && r.pts === 20 && r.result !== 'OK')
);

if (pt20Failures.length > 0) {
    console.log('\n' + '='.repeat(72));
    console.log(`pts=20 failed for ${pt20Failures.map(l => l.postcode).join(', ')} — trying fallback pts: ${FALLBACK_PTS.join(', ')}`);
    console.log('='.repeat(72));

    for (const loc of pt20Failures) {
        for (const pts of FALLBACK_PTS) {
            await delay(DELAY_MS);

            let ring = simplifyRing(loc.ring, pts);
            ring = forceClose(ring);
            const { encoded, url } = buildUrl(ring);

            process.stdout.write(`  ${loc.postcode} pts=${pts}  enc=${encoded.length}  url=${url.length}  → `);

            let result;
            try {
                const r = await checkRightmove(url);
                result = r.ok ? 'OK' : '404';
            } catch (err) {
                result = 'ERR';
            }
            console.log(result);
            rows.push({ postcode: loc.postcode, city: loc.city, pts, urlLen: url.length, result, fallback: true });
        }
    }
} else {
    console.log('\nAll locations passed pts=20 — no fallback needed.');
}

// ── Summary table ─────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('FULL RESULTS TABLE');
console.log('='.repeat(72));
console.log(`${'postcode'.padEnd(12)} | ${'city'.padEnd(11)} | ${'pts'.padStart(4)} | ${'url_len'.padStart(7)} | ${'fallback'.padStart(8)} | result`);
console.log(`${'-'.repeat(12)}-+-${'-'.repeat(11)}-+-${'-'.repeat(4)}-+-${'-'.repeat(7)}-+-${'-'.repeat(8)}-+-------`);

for (const r of rows) {
    console.log(
        `${r.postcode.padEnd(12)} | ${r.city.padEnd(11)} | ${String(r.pts).padStart(4)} | ${String(r.urlLen).padStart(7)} | ${(r.fallback ? 'yes' : '').padStart(8)} | ${r.result}`
    );
}

// ── per-location verdict ──────────────────────────────────────────────────────

console.log('\n' + '='.repeat(72));
console.log('PER-LOCATION VERDICT');
console.log('='.repeat(72));

for (const loc of LOCATIONS) {
    const locRows = rows.filter(r => r.postcode === loc.postcode);
    const okRows  = locRows.filter(r => r.result === 'OK');
    if (okRows.length === 0) {
        const tried = locRows.map(r => `pts=${r.pts}:${r.result}`).join(', ');
        console.log(`  ${loc.postcode} (${loc.city}): ALL FAILED — ${tried}`);
    } else {
        const okPts = okRows.map(r => `pts=${r.pts}`).join(', ');
        console.log(`  ${loc.postcode} (${loc.city}): OK at ${okPts}`);
    }
}

// pts=20 universal verdict
const pt20Results = rows.filter(r => r.pts === 20 && !r.fallback);
const pt20Ok = pt20Results.filter(r => r.result === 'OK').length;
console.log(`\npts=20 universal: ${pt20Ok}/${pt20Results.length} locations passed`);
if (pt20Ok === pt20Results.length) {
    console.log('CONCLUSION: pts=20 is universally accepted across all tested locations.');
} else {
    const failed = pt20Results.filter(r => r.result !== 'OK').map(r => `${r.postcode}`);
    console.log(`CONCLUSION: pts=20 is NOT universal — failed for: ${failed.join(', ')}`);
}

console.log('\nDone.');
