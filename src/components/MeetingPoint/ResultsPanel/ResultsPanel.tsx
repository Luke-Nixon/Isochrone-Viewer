import { Alert, Box, Chip, CircularProgress, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaceIcon from '@mui/icons-material/Place';
import type { Candidate, MeetingMode, MeetingResult, Person } from '../../../services/MeetingPointService';
import { useReverseGeocode } from '../../../services/GeocodingService/useReverseGeocode';

interface ResultsPanelProps {
    result: MeetingResult;
    people: Person[];
    mode: MeetingMode;
    useWeights: boolean;
    selectedIndex: number; // -1 = primary, 0..n = alternates index
    onSelectIndex: (index: number) => void;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ result, people, mode, useWeights, selectedIndex, onSelectIndex }) => {
    const active: Candidate = selectedIndex < 0 ? result.primary : result.alternates[selectedIndex];
    const [lng, lat] = active.point;
    const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const reverse = useReverseGeocode(lat, lng);

    const placeLabel = reverse.data
        ? formatPlace(reverse.data)
        : reverse.error
            ? null
            : null;
    const placeFull = reverse.data?.displayName ?? null;

    const rawAggregate = aggregateOf(active.times);
    const weights = result.perPerson.map(p => p.weight);
    const showWeighted = useWeights && weights.some(w => w !== 1);
    const weightedTimes = active.times.map((t, i) => t * weights[i]);
    const weightedAgg = showWeighted ? aggregateOf(weightedTimes) : null;

    const hasAlternates = result.alternates.length > 0;
    const isPareto = mode === 'pareto';
    const paretoTotal = result.paretoFrontSize ?? (result.alternates.length + 1);
    const paretoCapHit = isPareto && paretoTotal > result.alternates.length + 1;

    const headerLabel = hasAlternates
        ? (selectedIndex < 0 ? (isPareto ? 'Best (by utilitarian)' : 'Best meeting point') : `Alternate ${selectedIndex + 1}`)
        : 'Meeting point';

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {headerLabel}
                </Typography>
            </Stack>

            {result.coverageNotice && (
                <Alert severity="info" variant="outlined" sx={{ mb: 1.5, py: 0.5, fontSize: 12 }}>
                    {result.coverageNotice}
                </Alert>
            )}

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
                    {coords}
                </Typography>
                <Tooltip title="Copy coordinates">
                    <IconButton size="small" onClick={() => navigator.clipboard.writeText(coords)}>
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5, minHeight: 22 }}>
                <PlaceIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                {reverse.loading && <CircularProgress size={12} thickness={5} sx={{ color: 'text.secondary' }} />}
                {placeLabel && (
                    <Tooltip title={placeFull ?? ''} placement="top">
                        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, cursor: placeFull ? 'help' : 'default' }}>
                            {placeLabel}
                        </Typography>
                    </Tooltip>
                )}
                {reverse.error && (
                    <Typography variant="caption" color="text.secondary">Address lookup failed</Typography>
                )}
                {placeLabel && (
                    <Tooltip title="Copy address">
                        <IconButton size="small" onClick={() => navigator.clipboard.writeText(placeFull ?? placeLabel)}>
                            <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>

            <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />

            <Stack spacing={1.5}>
                <StatRow label={showWeighted ? 'Actual' : ''} aggregate={rawAggregate} />
                {weightedAgg && <StatRow label="Weighted" aggregate={weightedAgg} accent />}
            </Stack>

            <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />

            <Typography variant="caption" color="text.secondary">Per person</Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {people.map((p, i) => {
                    const t = active.times[i];
                    const w = weights[i] ?? 1;
                    const wt = t * w;
                    return (
                        <Stack key={p.id} direction="row" alignItems="center" spacing={1}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                            <Typography variant="body2" sx={{ flexGrow: 1 }}>{p.label}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {t.toFixed(0)} min
                                {showWeighted && (
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                                        × {w.toFixed(1)} = {wt.toFixed(0)}
                                    </Typography>
                                )}
                            </Typography>
                        </Stack>
                    );
                })}
            </Stack>

            {hasAlternates && (
                <>
                    <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {isPareto
                            ? (paretoCapHit
                                ? `Showing ${result.alternates.length + 1} of ${paretoTotal} Pareto points (trade-off curve trimmed for clarity).`
                                : `Pareto front (${paretoTotal} options)`)
                            : `Pareto front (${result.alternates.length + 1} options)`}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip
                            label="Best"
                            size="small"
                            color={selectedIndex < 0 ? 'primary' : 'default'}
                            variant={selectedIndex < 0 ? 'filled' : 'outlined'}
                            onClick={() => onSelectIndex(-1)}
                            sx={{ height: 22 }}
                        />
                        {result.alternates.map((_, i) => (
                            <Chip
                                key={i}
                                label={i + 1}
                                size="small"
                                color={selectedIndex === i ? 'primary' : 'default'}
                                variant={selectedIndex === i ? 'filled' : 'outlined'}
                                onClick={() => onSelectIndex(i)}
                                sx={{ height: 22, minWidth: 32 }}
                            />
                        ))}
                    </Stack>
                </>
            )}
        </Box>
    );
};

interface AggregateView {
    max: number;
    mean: number;
    total: number;
    variance: number;
}

function formatPlace(r: { road?: string; locality?: string; postcode?: string; displayName?: string }): string {
    const parts: string[] = [];
    if (r.postcode) parts.push(r.postcode);
    if (r.locality) parts.push(r.locality);
    else if (r.road) parts.push(r.road);
    if (parts.length > 0) return parts.join(' · ');
    return r.displayName ? r.displayName.split(',').slice(0, 2).join(',').trim() : 'Unknown location';
}

function aggregateOf(times: number[]): AggregateView {
    const total = times.reduce((s, t) => s + t, 0);
    const mean = total / times.length;
    const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
    const max = Math.max(...times);
    return { total, mean, variance, max };
}

const StatRow: React.FC<{ label: string; aggregate: AggregateView; accent?: boolean }> = ({ label, aggregate, accent }) => (
    <Stack direction="row" spacing={2} alignItems="center">
        {label && (
            <Typography variant="caption" color={accent ? 'primary.light' : 'text.secondary'} sx={{ width: 60, flexShrink: 0 }}>
                {label}
            </Typography>
        )}
        <Stat label="Worst" value={`${aggregate.max.toFixed(0)}m`} />
        <Stat label="Mean" value={`${aggregate.mean.toFixed(0)}m`} />
        <Stat label="Total" value={`${aggregate.total.toFixed(0)}m`} />
        <Stat label="σ²" value={aggregate.variance.toFixed(1)} />
    </Stack>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <Box sx={{ flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{value}</Typography>
    </Box>
);

export default ResultsPanel;
