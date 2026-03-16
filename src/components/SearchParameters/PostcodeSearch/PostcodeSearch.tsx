import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import type { GeocodingResult } from '../../../services/GeocodingService';

interface PostcodeSearchProps {
    inputValue: string;
    setInputValue: (value: string) => void;
    options: GeocodingResult[];
    selected: GeocodingResult | null;
    setSelected: (result: GeocodingResult | null) => void;
    loading: boolean;
}

const PostcodeSearch: React.FC<PostcodeSearchProps> = ({ inputValue, setInputValue, options, selected, setSelected, loading }) => {
    const handleChange = (value: GeocodingResult | null) => {
        setSelected(value);
    };

    const isValid = selected !== null;
    const isError = !loading && !selected && inputValue.trim().length >= 3 && options.length === 0;

    const fieldColor = isValid ? 'success' : 'primary';
    const helperText = isValid
        ? selected.displayName
        : isError
            ? 'No results found — try a postcode or town name'
            : undefined;

    return (
        <Autocomplete
            options={options}
            getOptionLabel={(option) => option.displayName}
            filterOptions={(x) => x}
            loading={loading}
            inputValue={inputValue}
            value={selected}
            onInputChange={(_, value) => {
                setInputValue(value);
                if (!value) handleChange(null);
            }}
            onChange={(_, value) => handleChange(value)}
            noOptionsText={inputValue.length >= 3 ? 'No results found' : 'Type to search...'}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Starting Post Code"
                    placeholder="e.g. SW1A 2AA"
                    color={fieldColor}
                    error={isError}
                    helperText={helperText}
                    slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading && <CircularProgress size={18} />}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        },
                    }}
                />
            )}
        />
    );
};

export default PostcodeSearch;
