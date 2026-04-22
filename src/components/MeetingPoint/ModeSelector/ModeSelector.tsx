import { Box, Chip, FormControlLabel, Radio, RadioGroup, Stack, Switch, Typography } from '@mui/material';
import type { MeetingMode } from '../../../services/MeetingPointService';

interface ModeOption {
    value: MeetingMode;
    label: string;
    description: string;
    enabled: boolean;
}

const MODES: ModeOption[] = [
    { value: 'minimax', label: 'Minimax (egalitarian)', description: 'Minimise the worst travel time. Nobody travels more than the worst case.', enabled: true },
    { value: 'leximin', label: 'Leximin', description: 'Refined minimax: minimise the worst, then second-worst, etc.', enabled: true },
    { value: 'utilitarian', label: 'Utilitarian', description: 'Minimise the total travel time across everyone.', enabled: true },
    { value: 'minVariance', label: 'Equal-effort', description: 'Everyone travels roughly the same time.', enabled: true },
    { value: 'nash', label: 'Nash bargaining', description: 'Principled middle ground between fair and efficient.', enabled: true },
    { value: 'pareto', label: 'Pareto-optimal set', description: 'Show all non-dominated options on the map. Click an alternate to inspect.', enabled: true },
];

interface ModeSelectorProps {
    mode: MeetingMode;
    useWeights: boolean;
    onModeChange: (mode: MeetingMode) => void;
    onUseWeightsChange: (use: boolean) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, useWeights, onModeChange, onUseWeightsChange }) => {
    return (
        <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Fairness mode
            </Typography>
            <RadioGroup
                value={mode}
                onChange={(_, v) => onModeChange(v as MeetingMode)}
            >
                <Stack spacing={0.5}>
                    {MODES.map((opt) => (
                        <Box
                            key={opt.value}
                            sx={{
                                opacity: opt.enabled ? 1 : 0.5,
                                p: 1,
                                borderRadius: 1.5,
                                border: '1px solid rgba(255,255,255,0.05)',
                                background: mode === opt.value ? 'rgba(255,255,255,0.05)' : 'transparent',
                            }}
                        >
                            <FormControlLabel
                                value={opt.value}
                                disabled={!opt.enabled}
                                control={<Radio size="small" />}
                                sx={{ alignItems: 'flex-start', mr: 0, '& .MuiFormControlLabel-label': { width: '100%' } }}
                                label={
                                    <Box sx={{ ml: 0.5 }}>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography variant="body2">{opt.label}</Typography>
                                            {!opt.enabled && <Chip label="soon" size="small" sx={{ height: 18, fontSize: 10 }} />}
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            {opt.description}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </Box>
                    ))}
                </Stack>
            </RadioGroup>

            <FormControlLabel
                control={<Switch size="small" checked={useWeights} onChange={(_, v) => onUseWeightsChange(v)} />}
                label={<Typography variant="body2">Use per-person weights</Typography>}
                sx={{ mt: 1 }}
            />
        </Box>
    );
};

export default ModeSelector;
