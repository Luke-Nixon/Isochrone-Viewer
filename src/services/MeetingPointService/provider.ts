import { getValhallaConfig, getValhallaIsochrones, ValhallaApiError } from '../IsochroneService';
import type { ValhallaCosting, ValhallaResponse } from '../IsochroneService';
import type { GeocodingResult } from '../GeocodingService';
import { MeetingPointError } from './types';
import type { Band } from './types';

export interface RetryNotice {
    reason: string;
    attempt: number;
    maxAttempts: number;
}

export interface IsochroneProvider {
    getBands(
        location: GeocodingResult,
        mode: ValhallaCosting,
        minutes: number[],
        onRetry?: (notice: RetryNotice) => void,
    ): Promise<Band[]>;
}

const VALHALLA_MAX_CONTOURS_PER_REQUEST = 4;
const VALHALLA_REQUEST_PACING_MS = 250;
// Contours above this get sent as single-contour requests (not batched). Large
// isochrones are individually expensive; bundling them makes one bad contour
// take down a whole batch.
const VALHALLA_SINGLE_REQUEST_THRESHOLD_MINUTES = 60;
const MAX_RETRY_ATTEMPTS = 3;

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// Split contour list into groups suited for the public OSM Valhalla:
//   - small contours (≤60 min) → chunked up to 4 per request (efficient)
//   - large contours  (>60 min) → one per request (each is individually expensive)
function planRequests(minutes: number[]): number[][] {
    const small = minutes.filter(m => m <= VALHALLA_SINGLE_REQUEST_THRESHOLD_MINUTES);
    const large = minutes.filter(m => m >  VALHALLA_SINGLE_REQUEST_THRESHOLD_MINUTES);
    return [...chunk(small, VALHALLA_MAX_CONTOURS_PER_REQUEST), ...large.map(m => [m])];
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function responseToBands(response: ValhallaResponse): Band[] {
    return response.features.map(feature => ({
        minutes: feature.properties.contour,
        polygon: feature as unknown as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    }));
}

// 429 = rate-limited; 502/503/504 = upstream/gateway transient errors common on
// the public OSM Valhalla instance under load.
const RETRIABLE_STATUSES = new Set([429, 502, 503, 504]);

function isRetriable(e: unknown): boolean {
    if (e instanceof ValhallaApiError) return RETRIABLE_STATUSES.has(e.status);
    // Bare fetch() throws TypeError on network failures and on responses missing
    // CORS headers (which the public OSM Valhalla strips on some 5xx replies).
    // Treat those as transient too.
    return e instanceof TypeError;
}

function retryReason(e: unknown): string {
    if (e instanceof ValhallaApiError) {
        if (e.status === 429) return 'rate limited';
        if (e.status === 504) return 'gateway timeout';
        if (e.status === 503) return 'server unavailable';
        if (e.status === 502) return 'bad gateway';
        return `HTTP ${e.status}`;
    }
    return 'network error';
}

async function fetchWithRetry(
    location: GeocodingResult,
    mode: ValhallaCosting,
    minutes: number[],
    baseUrl: string,
    onRetry?: (notice: RetryNotice) => void,
    attempt = 0,
): Promise<ValhallaResponse> {
    try {
        return await getValhallaIsochrones({ location, minutes, costing: mode, baseUrl });
    } catch (e) {
        if (isRetriable(e) && attempt < MAX_RETRY_ATTEMPTS) {
            // Exponential backoff with jitter: 500/1000/2000/4000/8000 ms ± 30%
            const base = 500 * 2 ** attempt;
            const jitter = base * (0.7 + Math.random() * 0.6);
            const wait = Math.min(jitter, 10_000);
            onRetry?.({
                reason: retryReason(e),
                attempt: attempt + 1,
                maxAttempts: MAX_RETRY_ATTEMPTS,
            });
            await delay(wait);
            return fetchWithRetry(location, mode, minutes, baseUrl, onRetry, attempt + 1);
        }
        throw e;
    }
}

// Cache so re-running the same compute (e.g. after switching mode) doesn't refetch.
// Keyed on everything that affects the response. Stores the in-flight promise to dedupe
// concurrent requests for the same key.
const bandCache = new Map<string, Promise<Band[]>>();

function cacheKey(baseUrl: string, location: GeocodingResult, mode: ValhallaCosting, minutes: number[]): string {
    return `${baseUrl}|${location.lat.toFixed(6)},${location.lng.toFixed(6)}|${mode}|${minutes.join(',')}`;
}

export function clearBandCache(): void {
    bandCache.clear();
}

// Recursive split-on-failure: if a multi-contour request fails after the
// per-request retries, divide it in half and try each half. This salvages
// the smaller contours even if the largest one (e.g. 100 min) is too
// expensive for the server to compute.
async function fetchGroupResilient(
    location: GeocodingResult,
    mode: ValhallaCosting,
    contours: number[],
    baseUrl: string,
    onRetry?: (notice: RetryNotice) => void,
): Promise<Band[]> {
    try {
        const response = await fetchWithRetry(location, mode, contours, baseUrl, onRetry);
        return responseToBands(response);
    } catch (e) {
        if (contours.length === 1) throw e;
        const mid = Math.ceil(contours.length / 2);
        const left = contours.slice(0, mid);
        const right = contours.slice(mid);
        const leftBands = await fetchGroupResilient(location, mode, left, baseUrl, onRetry);
        await delay(VALHALLA_REQUEST_PACING_MS);
        const rightBands = await fetchGroupResilient(location, mode, right, baseUrl, onRetry);
        return [...leftBands, ...rightBands];
    }
}

export const valhallaProvider: IsochroneProvider = {
    async getBands(location, mode, minutes, onRetry) {
        const config = getValhallaConfig();
        if (!config.enabled) {
            throw new MeetingPointError(
                'Valhalla is not enabled. Enable it from the panel above.',
                'provider_disabled',
            );
        }

        const key = cacheKey(config.url, location, mode, minutes);
        const hit = bandCache.get(key);
        if (hit) return hit;

        const promise = (async () => {
            const groups = planRequests(minutes);
            const allBands: Band[] = [];
            const droppedContours: number[] = [];
            for (let i = 0; i < groups.length; i++) {
                if (i > 0) await delay(VALHALLA_REQUEST_PACING_MS);
                try {
                    const bands = await fetchGroupResilient(location, mode, groups[i], config.url, onRetry);
                    allBands.push(...bands);
                } catch (e) {
                    // Server couldn't deliver these contours. Rather than fail
                    // the whole compute, drop them and proceed with whatever
                    // smaller contours did succeed. The algorithms handle
                    // non-uniform band coverage across people naturally.
                    droppedContours.push(...groups[i]);
                    // eslint-disable-next-line no-console
                    console.warn(`[valhalla] dropped contours ${groups[i].join(',')} for ${location.displayName}: ${e instanceof Error ? e.message : e}`);
                }
            }
            if (allBands.length === 0) {
                throw new MeetingPointError(
                    `Could not fetch any isochrones for ${location.displayName}. The public OSM Valhalla may be overloaded — wait a moment and retry, or use a self-hosted instance.`,
                    'fetch_failed',
                );
            }
            return allBands.sort((a, b) => a.minutes - b.minutes);
        })();

        bandCache.set(key, promise);
        try {
            return await promise;
        } catch (e) {
            // Don't cache failures — let the next attempt retry.
            bandCache.delete(key);
            throw e;
        }
    },
};
