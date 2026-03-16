import { useState } from 'react';
import { Paper, Typography, Grid, Button, CircularProgress } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import PostcodeSearch from './PostcodeSearch/PostcodeSearch';
import TravelTime from './TravelTime/TravelTime';
import TravelMode from './TravelMode/TravelMode';
import type { UseAddressSearchResult } from '../../services/GeocodingService/useAddressSearch';
import { getValhallaConfig, getValhallaIsochrone } from '../../services/IsochroneService';
import type { ValhallaCosting, ValhallaResponse } from '../../services/IsochroneService';

const TRAVEL_MODE_TO_COSTING: Record<string, ValhallaCosting> = {
    driving: 'auto',
    walking: 'pedestrian',
    cycling: 'bicycle',
    transit: 'bus',
};

interface SearchParametersProps {
    address: UseAddressSearchResult;
    onResult: (result: ValhallaResponse | null) => void;
    sx?: SxProps<Theme>;
}

const SearchParameters: React.FC<SearchParametersProps> = ({ address, onResult, sx }) => {
    const [travelTime, setTravelTime] = useState(30);
    const [travelMode, setTravelMode] = useState('driving');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!address.selected) return;

        const valhallaConfig = getValhallaConfig();
        if (!valhallaConfig.enabled) {
            setError('No provider enabled. Enable Valhalla in Provider Configuration.');
            return;
        }

        setLoading(true);
        setError(null);
        onResult(null);

        try {
            const result = await getValhallaIsochrone({
                location: address.selected,
                minutes: travelTime,
                costing: TRAVEL_MODE_TO_COSTING[travelMode] ?? 'auto',
                baseUrl: valhallaConfig.url,
            });
            onResult(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper
            elevation={3}
            sx={{
                p: 4,
                width: '100%',
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                ...sx
            }}
        >
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
                Search Parameters
            </Typography>

            <Grid container spacing={4}>
                <Grid size={{ xs: 12 }}>
                    <PostcodeSearch {...address} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <TravelTime value={travelTime} onChange={setTravelTime} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <TravelMode value={travelMode} onChange={setTravelMode} />
                </Grid>

                {error && (
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="error">
                            {error}
                        </Typography>
                    </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleSearch}
                        disabled={!address.selected || loading}
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </Button>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default SearchParameters;
