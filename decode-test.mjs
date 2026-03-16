// Google Encoded Polyline decoder test

function decodePolyline(encoded) {
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0, result = 0, byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

// The raw URL-encoded string from Rightmove
const raw = `{"polylines"%3A"qmbbIddcGztk%40nw}Bht\`%40pnQphRo|FzdWepn%40jpMkxxAaiJ_~jCelZepn%40cjb%40bu^}eRvv{%40sdRnsA_oXurf%40i_ZbcTkoHrrf%40toc%40tdq%40ydBtdq%40vwCs\`\\"}`;

// Decode the URL encoding
const decoded = decodeURIComponent(raw.replace(/\\"/g, '"'));
console.log("Decoded JSON string:", decoded);

const parsed = JSON.parse(decoded);
console.log("\nPolyline string:", parsed.polylines);

const coords = decodePolyline(parsed.polylines);
console.log("\nDecoded coordinates (lat, lng):");
coords.forEach((c, i) => console.log(`  [${i}] lat: ${c[0]}, lng: ${c[1]}`));
