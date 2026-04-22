import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import PeopleList from '../../components/MeetingPoint/PeopleList/PeopleList';
import ModeSelector from '../../components/MeetingPoint/ModeSelector/ModeSelector';
import ResultsPanel from '../../components/MeetingPoint/ResultsPanel/ResultsPanel';
import MeetMapView from '../../components/MeetingPoint/MeetMapView/MeetMapView';
import MaxTime from '../../components/MeetingPoint/MaxTime/MaxTime';
import ProviderStatus from '../../components/MeetingPoint/ProviderStatus/ProviderStatus';
import { nextPersonColor, PERSON_PALETTE } from '../../components/MeetingPoint/colors';
import { solve, MeetingPointError } from '../../services/MeetingPointService';
import type { MeetingMode, MeetingResult, Person, ProgressEvent } from '../../services/MeetingPointService';

const STORAGE_KEY = 'meetingPoint:state';
const DEFAULT_MAX_MINUTES = 60;
const BAND_STEP_MINUTES = 5;

interface PersistedState {
    people: Person[];
    mode: MeetingMode;
    useWeights: boolean;
    maxMinutes: number;
}

function makeDefaultPeople(): Person[] {
    return [
        { id: crypto.randomUUID(), label: 'Person 1', address: null, mode: 'auto', weight: 1.0, color: PERSON_PALETTE[0] },
        { id: crypto.randomUUID(), label: 'Person 2', address: null, mode: 'auto', weight: 1.0, color: PERSON_PALETTE[1] },
    ];
}

function loadInitialState(): PersistedState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { people: makeDefaultPeople(), mode: 'minimax', useWeights: false, maxMinutes: DEFAULT_MAX_MINUTES };
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        const people = Array.isArray(parsed.people) && parsed.people.length >= 2
            ? parsed.people.map((p, i) => ({
                id: p.id ?? crypto.randomUUID(),
                label: p.label ?? `Person ${i + 1}`,
                address: p.address ?? null,
                mode: p.mode ?? 'auto',
                weight: typeof p.weight === 'number' ? p.weight : 1.0,
                color: p.color ?? nextPersonColor([]),
            } as Person))
            : makeDefaultPeople();
        return {
            people,
            mode: parsed.mode ?? 'minimax',
            useWeights: parsed.useWeights ?? false,
            maxMinutes: parsed.maxMinutes ?? DEFAULT_MAX_MINUTES,
        };
    } catch {
        return { people: makeDefaultPeople(), mode: 'minimax', useWeights: false, maxMinutes: DEFAULT_MAX_MINUTES };
    }
}

function progressLabel(p: ProgressEvent): string {
    if (p.phase === 'computing') return 'Computing meeting point…';
    const idx = (p.personIndex ?? 0) + 1;
    const total = p.total ?? 0;
    if (p.phase === 'retrying') {
        return `Server ${p.retryReason ?? 'busy'}, retrying ${p.personLabel ?? 'person'} (attempt ${p.retryAttempt ?? '?'}/${p.retryMax ?? '?'})…`;
    }
    return `Fetching bands for ${p.personLabel ?? 'person'} (${idx} of ${total})…`;
}

const MeetPage: React.FC = () => {
    const initial = loadInitialState();
    const [people, setPeople] = useState<Person[]>(initial.people);
    const [mode, setMode] = useState<MeetingMode>(initial.mode);
    const [useWeights, setUseWeights] = useState(initial.useWeights);
    const [maxMinutes, setMaxMinutes] = useState(initial.maxMinutes);
    const [result, setResult] = useState<MeetingResult | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    const [computing, setComputing] = useState(false);
    const [progress, setProgress] = useState<ProgressEvent | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Persist on edit (debounced).
    useEffect(() => {
        const id = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ people, mode, useWeights, maxMinutes }));
            } catch {
                // localStorage may be full or disabled — non-fatal
            }
        }, 200);
        return () => clearTimeout(id);
    }, [people, mode, useWeights, maxMinutes]);

    // Clear stale result whenever inputs change so the map doesn't lie.
    // Skip first render so we don't wipe an empty result on mount.
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        setResult(null);
        setSelectedIndex(-1);
        setError(null);
    }, [people, mode, useWeights, maxMinutes]);

    const validCount = people.filter(p => p.address !== null).length;
    const canCompute = validCount >= 2 && !computing;

    // Bring the result/error into view when one appears — otherwise it can sit
    // below the fold of a long sidebar and look like nothing happened.
    const outcomeRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (result || error) {
            outcomeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [result, error]);

    const handleCompute = async () => {
        setComputing(true);
        setError(null);
        setResult(null);
        setSelectedIndex(-1);
        setProgress({ phase: 'fetching', personIndex: 0, total: validCount, personLabel: '…' });
        try {
            const r = await solve(people, {
                mode,
                useWeights,
                maxMinutes,
                bandStepMinutes: BAND_STEP_MINUTES,
                onProgress: setProgress,
            });
            setResult(r);
        } catch (e) {
            if (e instanceof MeetingPointError) {
                setError(e.message);
            } else {
                setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            }
        } finally {
            setComputing(false);
            setProgress(null);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 3,
                height: { xs: 'auto', md: '100%' },
                minHeight: { xs: '100%', md: 'unset' },
                width: '100%',
                boxSizing: 'border-box',
            }}
        >
            {/* Left: Configuration */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    flexShrink: 0,
                    width: { xs: '100%', md: '40%', lg: '32%' },
                    height: { xs: 'auto', md: '100%' },
                    overflowY: { xs: 'visible', md: 'auto' },
                }}
            >
                <Paper elevation={3} sx={{ p: 3, borderRadius: 4 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                        <PlaceIcon fontSize="small" />
                        <Typography variant="h6" fontWeight="bold">Fair meeting point</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Find the fairest place for everyone to meet, based on travel time isochrones.
                    </Typography>

                    <ProviderStatus />

                    <ModeSelector
                        mode={mode}
                        useWeights={useWeights}
                        onModeChange={setMode}
                        onUseWeightsChange={setUseWeights}
                    />

                    <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

                    <MaxTime value={maxMinutes} onChange={setMaxMinutes} />
                </Paper>

                <Paper elevation={3} sx={{ p: 3, borderRadius: 4 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        People ({people.length})
                    </Typography>
                    <PeopleList people={people} showWeights={useWeights} onChange={setPeople} />
                </Paper>

                <Stack spacing={1.5} ref={outcomeRef}>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleCompute}
                        disabled={!canCompute}
                        startIcon={computing ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {computing ? 'Computing…' : `Find meeting point (${validCount} ready)`}
                    </Button>

                    {progress && (
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                            {progressLabel(progress)}
                        </Typography>
                    )}

                    {error && <Alert severity="error" variant="outlined">{error}</Alert>}

                    {result && (
                        <ResultsPanel
                            result={result}
                            people={people.filter(p => p.address !== null)}
                            mode={mode}
                            useWeights={useWeights}
                            selectedIndex={selectedIndex}
                            onSelectIndex={setSelectedIndex}
                        />
                    )}
                </Stack>
            </Box>

            {/* Right: Map */}
            <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: { xs: 500, md: '100%' }, minWidth: 0 }}>
                <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <MeetMapView
                        people={people}
                        result={result}
                        selectedIndex={selectedIndex}
                        onSelectIndex={setSelectedIndex}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default MeetPage;
