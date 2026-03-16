// Test script: decode known-good Rightmove polylines, re-encode, and compare

// ── Decoder ──────────────────────────────────────────────────────────────────

function decodePolyline(encoded) {
    const coords = [];
    let lat = 0, lng = 0, i = 0;

    while (i < encoded.length) {
        // decode one value
        let result = 0, shift = 0, b;
        do {
            b = encoded.charCodeAt(i++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dLat;

        result = 0; shift = 0;
        do {
            b = encoded.charCodeAt(i++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dLng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dLng;

        coords.push([lat / 1e5, lng / 1e5]);
    }
    return coords;
}

// ── Encoder ──────────────────────────────────────────────────────────────────

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

// ── Test ─────────────────────────────────────────────────────────────────────

const polylines = [
    '_be}Ha`uBjhBiCi@kmGcN?_pA|[_AzjE}D~j@?cA',
    'ki`}HuenBw|Dl_d@_jVdzRspFhkSdzHlx`@bwPdzRdpIkoFtqF}hRqIijp@~eJztAxfIljZnqJngJr|JoyCl}H_pUt~@gjp@erLcu|@vhD}yh@ufNinc@yqIor@c}Ex{D_sClw}@m|Fx~TipJxbHr^njZci@oyC',
    'qig}HmvaEsAjbQzlDzKrA~\\gDrlCcrD`]fDx{DbrDhCoIpwDytDbP~[vfFzlDa]gDfn@qf@lTquBdP|Ffpb@ncAha@hmChC`q@{KeLm~RxeB}i@pf@gjBmQssFq}By}CtrCqwDlQ}gAyk@c`E}zBslCbeDsjD~[qpAon@kkHybCy}CbkBglA~x@ewB_\\_kF{eBqwDksAqG{c@re@fDpnB~x@hjB_y@ppAg~@?hDqpAqf@cyAy`A{KeLdPus@duClQ`bDfD?',
];

// ── Uniform resampling (mirrors rightmove.ts) ─────────────────────────────────

function simplifyRing(ring, maxPoints) {
    if (ring.length <= maxPoints) return ring;
    const step = (ring.length - 1) / (maxPoints - 1);
    const result = [];
    for (let i = 0; i < maxPoints - 1; i++) result.push(ring[Math.round(i * step)]);
    result.push(ring[ring.length - 1]);
    return result;
}

// ── URL builder (mirrors rightmove.ts) ───────────────────────────────────────

function buildRightmoveUrl(latLngs) {
    const simplified = simplifyRing(latLngs, 80);
    const encoded = encodePolyline(simplified);
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    return `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
}

// ── Reconstruct original URLs and compare ────────────────────────────────────

const originalUrls = [
    'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22_be%7DHa%60uBjhBiCi%40kmGcN%3F_pA%7C%5B_AzjE%7DD%7Ej%40%3FcA%22%7D&viewType=MAP&numberOfPropertiesPerPage=95',
    'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22ki%60%7DHuenBw%7CDl_d%40_jVdzRspFhkSdzHlx%60%40bwPdzRdpIkoFtqF%7DhRqIijp%40%7EeJztAxfIljZnqJngJr%7CJoyCl%7DH_pUt%7E%40gjp%40erLcu%7C%40vhD%7Dyh%40ufNinc%40yqIor%40c%7DEx%7BD_sClw%7D%40m%7CFx%7ETipJxbHr%5EnjZci%40oyC%22%7D&viewType=MAP&numberOfPropertiesPerPage=95',
    'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22qig%7DHmvaEsAjbQzlDzKrA%7E%5CgDrlCcrD%60%5DfDx%7BDbrDhCoIpwDytDbP%7E%5BvfFzlDa%5DgDfn%40qf%40lTquBdP%7CFfpb%40ncAha%40hmChC%60q%40%7BKeLm%7ERxeB%7Di%40pf%40gjBmQssFq%7DBy%7DCtrCqwDlQ%7DgAyk%40c%60E%7DzBslCbeDsjD%7E%5BqpAon%40kkHybCy%7DCbkBglA%7Ex%40ewB_%5C_kF%7BeBqwDksAqG%7Bc%40re%40fDpnB%7Ex%40hjB_y%40ppAg%7E%40%3FhDqpAqf%40cyAy%60A%7BKeLdPus%40duClQ%60bDfD%3F%22%7D&viewType=MAP&numberOfPropertiesPerPage=95',
];

console.log('\n── URL reconstruction ──');
polylines.forEach((polyline, i) => {
    const coords = decodePolyline(polyline);
    const generated = buildRightmoveUrl(coords);
    const match = generated === originalUrls[i];
    console.log(`URL ${i + 1}: ${match ? '✓ MATCH' : '✗ MISMATCH'}`);
    if (!match) {
        console.log('  Expected:', originalUrls[i]);
        console.log('  Got:     ', generated);
    }
});

// ── Round-trip tests ──────────────────────────────────────────────────────────

polylines.forEach((original, i) => {
    const coords = decodePolyline(original);
    const reEncoded = encodePolyline(coords);
    const match = original === reEncoded;

    console.log(`\n── Polyline ${i + 1} ──`);
    console.log(`Points:     ${coords.length}`);
    console.log(`First:      lat=${coords[0][0].toFixed(5)}, lng=${coords[0][1].toFixed(5)}`);
    console.log(`Last:       lat=${coords[coords.length-1][0].toFixed(5)}, lng=${coords[coords.length-1][1].toFixed(5)}`);
    console.log(`Round-trip: ${match ? '✓ MATCH' : '✗ MISMATCH'}`);
    if (!match) {
        console.log(`  Original:   ${original}`);
        console.log(`  Re-encoded: ${reEncoded}`);
        // find first difference
        for (let j = 0; j < Math.max(original.length, reEncoded.length); j++) {
            if (original[j] !== reEncoded[j]) {
                console.log(`  First diff at index ${j}: original='${original[j]}' re-encoded='${reEncoded[j]}'`);
                break;
            }
        }
    }
});
