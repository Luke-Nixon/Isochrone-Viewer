// End-to-end test: geocode → Valhalla isochrone → Rightmove URL → HTTP check
// Self-contained — no imports from src/

const UA = 'IsochromeViewer-Test/1.0 (github.com/isochrone-viewer; test script)';

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

// ── Uniform resampling (mirrors rightmove.ts) ─────────────────────────────────

function simplifyRing(ring, maxPoints) {
    if (ring.length <= maxPoints) return ring;
    const step = (ring.length - 1) / (maxPoints - 1);
    const result = [];
    for (let i = 0; i < maxPoints - 1; i++) {
        result.push(ring[Math.round(i * step)]);
    }
    result.push(ring[ring.length - 1]); // preserve closing vertex
    return result;
}

// ── Force close the ring ──────────────────────────────────────────────────────

function forceClose(ring) {
    if (ring.length === 0) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        return [...ring, [first[0], first[1]]];
    }
    return ring;
}

// ── Rightmove URL builder ─────────────────────────────────────────────────────

function buildRightmoveUrl(geoJsonFeatureCollection) {
    const feature = geoJsonFeatureCollection.features[0];
    if (!feature) throw new Error('No features in response');

    const { geometry } = feature;

    // GeoJSON coordinates are [lng, lat] — polyline encoding needs [lat, lng]
    let ring;
    if (geometry.type === 'Polygon') {
        ring = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
        ring = geometry.coordinates[0][0];
    } else {
        throw new Error(`Unexpected geometry type: ${geometry.type}`);
    }

    // Flip [lng, lat] → [lat, lng]
    let latLngs = ring.map(([lng, lat]) => [lat, lng]);

    // Simplify to 80 points using uniform resampling
    latLngs = simplifyRing(latLngs, 80);

    // Force close the ring
    latLngs = forceClose(latLngs);

    // Encode using Google Encoded Polyline
    const encoded = encodePolyline(latLngs);

    // Build locationIdentifier
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');

    const url = `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;

    return { url, encoded, points: latLngs.length };
}

// ── Step 1: Geocode postcode ──────────────────────────────────────────────────

async function geocode(postcode) {
    console.log(`\n[1] Geocoding postcode: ${postcode}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&format=json&limit=1`;
    console.log(`    GET ${url}`);

    const res = await fetch(url, {
        headers: {
            'User-Agent': UA,
            'Accept-Language': 'en',
        },
    });

    if (!res.ok) throw new Error(`Nominatim error: ${res.status} ${res.statusText}`);

    const data = await res.json();
    if (!data.length) throw new Error(`No geocoding result for: ${postcode}`);

    const { lat, lon, display_name } = data[0];
    console.log(`    Result: lat=${lat}, lng=${lon}`);
    console.log(`    Address: ${display_name}`);

    return { lat: parseFloat(lat), lng: parseFloat(lon) };
}

// ── Step 2: Call Valhalla isochrone API ───────────────────────────────────────

async function getIsochrone(lat, lng, minutes) {
    console.log(`\n[2] Fetching Valhalla isochrone (${minutes} min, costing=auto)`);
    const url = 'https://valhalla1.openstreetmap.de/isochrone';

    const body = {
        locations: [{ lon: lng, lat: lat }],
        costing: 'auto',
        contours: [{ time: minutes }],
        polygons: true,
    };

    console.log(`    POST ${url}`);
    console.log(`    Body: ${JSON.stringify(body)}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': UA,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Valhalla error: ${res.status} ${res.statusText}\n${text}`);
    }

    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('No features in Valhalla response');

    console.log(`    Features: ${data.features.length}, geometry type: ${feature.geometry.type}`);
    const ring = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates[0][0];
    console.log(`    Outer ring points: ${ring.length}`);

    return data;
}

// ── Step 3–7: Build Rightmove URL ─────────────────────────────────────────────

function buildUrl(isochroneData, minutes) {
    console.log(`\n[3-7] Building Rightmove URL (${minutes} min)`);

    const { url, encoded, points } = buildRightmoveUrl(isochroneData);

    console.log(`    Encoded polyline length: ${encoded.length} chars`);
    console.log(`    Points in simplified ring: ${points}`);

    return url;
}

// ── Step 8: Print URL and length ──────────────────────────────────────────────

function printUrl(url, minutes) {
    console.log(`\n[8] Rightmove URL (${minutes} min):`);
    console.log(`    Length: ${url.length} characters`);
    console.log(`    URL: ${url}`);
}

// ── Step 9: HTTP GET to Rightmove ─────────────────────────────────────────────

async function checkRightmoveUrl(url, minutes) {
    console.log(`\n[9] HTTP GET to Rightmove (${minutes} min)...`);

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
        },
        redirect: 'follow',
    });

    const finalUrl = res.url;
    const redirectedToNotFound = finalUrl.includes('/page-not-found');

    console.log(`    Status: ${res.status} ${res.statusText}`);
    console.log(`    Final URL: ${finalUrl}`);
    console.log(`    Redirected to /page-not-found: ${redirectedToNotFound}`);

    if (redirectedToNotFound) {
        console.log(`    *** URL rejected by Rightmove (redirected to page-not-found) ***`);
    } else if (res.status === 200) {
        console.log(`    *** URL accepted by Rightmove (200 OK) ***`);
    } else {
        console.log(`    *** Unexpected response ***`);
    }

    return { status: res.status, finalUrl, redirectedToNotFound };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runTest(minutes) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: CM77 7UE, ${minutes}-minute isochrone`);
    console.log('='.repeat(60));

    try {
        const { lat, lng } = await geocode('CM77 7UE');
        const isochroneData = await getIsochrone(lat, lng, minutes);
        const url = buildUrl(isochroneData, minutes);
        printUrl(url, minutes);
        await checkRightmoveUrl(url, minutes);
    } catch (err) {
        console.error(`\nERROR during ${minutes}-min test:`, err.message);
    }
}

// Run both 30-min and 60-min tests
await runTest(30);
await runTest(60);

console.log(`\n${'='.repeat(60)}`);
console.log('Done.');
