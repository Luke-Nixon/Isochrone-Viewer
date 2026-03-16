import { useState, useEffect, useRef } from 'react';
import { searchAddresses } from './index';
import type { GeocodingResult } from './index';

export interface UseAddressSearchResult {
    inputValue: string;
    setInputValue: (value: string) => void;
    options: GeocodingResult[];
    selected: GeocodingResult | null;
    setSelected: (result: GeocodingResult | null) => void;
    loading: boolean;
}

export function useAddressSearch(): UseAddressSearchResult {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState<GeocodingResult[]>([]);
    const [selected, setSelected] = useState<GeocodingResult | null>(null);
    const [loading, setLoading] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (inputValue.trim().length < 3) {
            setOptions([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            setLoading(true);
            try {
                setOptions(await searchAddresses(inputValue));
            } catch {
                setOptions([]);
            } finally {
                setLoading(false);
            }
        }, 400);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [inputValue]);

    return { inputValue, setInputValue, options, selected, setSelected, loading };
}
