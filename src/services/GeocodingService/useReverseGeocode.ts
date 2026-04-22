import { useEffect, useState } from 'react';
import { reverseGeocode } from './index';
import type { ReverseGeocodingResult } from './index';

const cache = new Map<string, Promise<ReverseGeocodingResult>>();

function key(lat: number, lng: number): string {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export interface UseReverseGeocodeResult {
    data: ReverseGeocodingResult | null;
    loading: boolean;
    error: string | null;
}

/** Resolve a coordinate to a human-readable address. Cached per-coord across the page. */
export function useReverseGeocode(lat: number | null, lng: number | null): UseReverseGeocodeResult {
    const [state, setState] = useState<UseReverseGeocodeResult>({ data: null, loading: false, error: null });

    useEffect(() => {
        if (lat === null || lng === null) {
            setState({ data: null, loading: false, error: null });
            return;
        }

        const k = key(lat, lng);
        let cancelled = false;

        let promise = cache.get(k);
        if (!promise) {
            promise = reverseGeocode(lat, lng);
            cache.set(k, promise);
        }

        setState({ data: null, loading: true, error: null });
        promise
            .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
            .catch(e => {
                if (cancelled) return;
                cache.delete(k);
                setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Reverse geocode failed' });
            });

        return () => { cancelled = true; };
    }, [lat, lng]);

    return state;
}
