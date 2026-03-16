import type { ValhallaResponse } from '../../services/IsochroneService';
import { forceClose } from './polygonValidation';

// ── Uniform resampling ────────────────────────────────────────────────────────

function simplifyRing(ring: [number, number][], maxPoints: number): [number, number][] {
    if (ring.length <= maxPoints) return ring;
    const step = (ring.length - 1) / (maxPoints - 1);
    const result: [number, number][] = [];
    for (let i = 0; i < maxPoints - 1; i++) {
        result.push(ring[Math.round(i * step)]);
    }
    result.push(ring[ring.length - 1]);
    return result;
}

// Snap to polyline precision (1e-5) so delta arithmetic operates on exact integers,
// eliminating the sub-precision drift that caused the last point to decode as
// 0.00001° different from the first — making the ring appear unclosed to Rightmove.
function snapRing(ring: [number, number][]): [number, number][] {
    return ring.map(([lat, lng]) => [
        Math.round(lat * 1e5) / 1e5,
        Math.round(lng * 1e5) / 1e5,
    ]);
}

// ── Google Encoded Polyline ───────────────────────────────────────────────────

function encodeValue(value: number): string {
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

function encodePolyline(latLngs: [number, number][]): string {
    let result = '', prevLat = 0, prevLng = 0;
    for (const [lat, lng] of latLngs) {
        result += encodeValue(lat - prevLat);
        result += encodeValue(lng - prevLng);
        prevLat = lat;
        prevLng = lng;
    }
    return result;
}

// ── Rightmove URL builder ─────────────────────────────────────────────────────

function buildUrl(encoded: string): string {
    const locationIdentifier = encodeURIComponent(`USERDEFINEDAREA^{"polylines":"${encoded}"}`).replace(/~/g, '%7E');
    return `https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=${locationIdentifier}&viewType=MAP&numberOfPropertiesPerPage=95`;
}

// 500 pts (url ~3955 chars) passes; 1000 pts (url ~6180 chars) fails.
// Stay well inside the passing zone.
const MAX_URL_LENGTH = 4000;

export interface RightmoveResult {
    url: string;
    /** Simplified ring as [lat, lng] pairs — for map overlay */
    ring: [number, number][];
}

export function buildRightmoveResult(result: ValhallaResponse): RightmoveResult | null {
    const feature = result.features[0];
    if (!feature) return null;

    const { geometry } = feature;
    let raw: number[][];
    if (geometry.type === 'Polygon') {
        raw = (geometry.coordinates as number[][][])[0];
    } else if (geometry.type === 'MultiPolygon') {
        raw = (geometry.coordinates as number[][][][])[0][0];
    } else {
        return null;
    }

    // GeoJSON is [lng, lat]; polyline encoding needs [lat, lng]
    const latLngs: [number, number][] = raw.map(([lng, lat]) => [lat, lng]);

    // Binary search for the maximum point count whose URL fits within MAX_URL_LENGTH.
    // Start with the full ring; if it already fits, use it as-is.
    const buildCandidate = (pts: number) =>
        snapRing(forceClose(simplifyRing(latLngs, pts)));

    let lo = 6, hi = latLngs.length;
    let ring = buildCandidate(hi);
    if (buildUrl(encodePolyline(ring)).length > MAX_URL_LENGTH) {
        // Binary search for the largest pts that fits
        while (lo < hi - 1) {
            const mid = Math.floor((lo + hi) / 2);
            const candidate = buildCandidate(mid);
            if (buildUrl(encodePolyline(candidate)).length <= MAX_URL_LENGTH) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        ring = buildCandidate(lo);
    }

    return { url: buildUrl(encodePolyline(ring)), ring };
}

/** Convenience: return just the URL */
export function buildRightmoveUrl(result: ValhallaResponse): string | null {
    return buildRightmoveResult(result)?.url ?? null;
}

/** Convert a ring to a GeoJSON Polygon Feature for Leaflet */
export function ringToGeoJSON(ring: [number, number][]): GeoJSON.Feature<GeoJSON.Polygon> {
    return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [ring.map(([lat, lng]) => [lng, lat])] },
    };
}
