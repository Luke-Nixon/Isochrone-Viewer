import { Alert, Slider, Stack, Typography } from '@mui/material';

interface MaxTimeProps {
    value: number;
    onChange: (value: number) => void;
}

// Above this, the public OSM Valhalla often fails (504 Gateway Timeout) because
// computing such large isochrones from urban-area postcodes is too expensive.
// A self-hosted instance can usually handle the full 100 min per Valhalla's API limit.
const PUBLIC_VALHALLA_RELIABLE_MAX = 75;

const MARKS = [
    { value: 30, label: '30m' },
    { value: 60, label: '1h' },
    { value: 75, label: '1h15' },
    { value: 100, label: '1h40' },
];

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h}h ${m}m`;
}

const MaxTime: React.FC<MaxTimeProps> = ({ value, onChange }) => {
    const overReliable = value > PUBLIC_VALHALLA_RELIABLE_MAX;

    return (
        <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
                Max travel time: {formatTime(value)}
            </Typography>
            <Slider
                value={value}
                onChange={(_, val) => onChange(val as number)}
                step={5}
                marks={MARKS}
                min={15}
                max={100}
                valueLabelDisplay="auto"
                valueLabelFormat={formatTime}
                // Tint the track red above the reliable threshold to hint at the danger zone.
                sx={{
                    mt: 1,
                    ...(overReliable && {
                        color: 'warning.main',
                        '& .MuiSlider-track': { backgroundColor: 'warning.main' },
                    }),
                }}
            />
            {overReliable && (
                <Alert severity="warning" variant="outlined" sx={{ py: 0.5, fontSize: 12 }}>
                    Above {formatTime(PUBLIC_VALHALLA_RELIABLE_MAX)}, the public OSM Valhalla often
                    times out — large isochrones from urban areas are expensive to compute.
                    Use a self-hosted Valhalla URL for reliable results.
                </Alert>
            )}
        </Stack>
    );
};

export default MaxTime;
