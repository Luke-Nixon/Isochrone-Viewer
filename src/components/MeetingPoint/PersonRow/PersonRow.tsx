import { Box, IconButton, Slider, Stack, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PostcodeSearch from '../../SearchParameters/PostcodeSearch/PostcodeSearch';
import TravelMode from '../../SearchParameters/TravelMode/TravelMode';
import { useAddressSearch } from '../../../services/GeocodingService/useAddressSearch';
import type { Person } from '../../../services/MeetingPointService';
import type { ValhallaCosting } from '../../../services/IsochroneService';
import { useEffect } from 'react';

const COSTING_TO_MODE: Record<ValhallaCosting, string> = {
    auto: 'driving',
    pedestrian: 'walking',
    bicycle: 'cycling',
    bus: 'transit',
};
const MODE_TO_COSTING: Record<string, ValhallaCosting> = {
    driving: 'auto',
    walking: 'pedestrian',
    cycling: 'bicycle',
    transit: 'bus',
};

interface PersonRowProps {
    person: Person;
    showWeight: boolean;
    canRemove: boolean;
    onChange: (next: Person) => void;
    onRemove: () => void;
}

const PersonRow: React.FC<PersonRowProps> = ({ person, showWeight, canRemove, onChange, onRemove }) => {
    const address = useAddressSearch(person.address);

    useEffect(() => {
        if (address.selected !== person.address) {
            onChange({ ...person, address: address.selected });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address.selected]);

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Box
                    sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: person.color,
                        boxShadow: `0 0 8px ${person.color}80`,
                        flexShrink: 0,
                    }}
                />
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{person.label}</Typography>
                <Tooltip title={canRemove ? 'Remove person' : 'At least 2 people required'}>
                    <span>
                        <IconButton size="small" onClick={onRemove} disabled={!canRemove}>
                            <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>

            <Stack spacing={2}>
                <PostcodeSearch {...address} />
                <TravelMode
                    value={COSTING_TO_MODE[person.mode] ?? 'driving'}
                    onChange={(m) => onChange({ ...person, mode: MODE_TO_COSTING[m] ?? 'auto' })}
                />
                {showWeight && (
                    <Box>
                        <Typography variant="caption" color="text.secondary">
                            Weight: {person.weight.toFixed(1)}
                        </Typography>
                        <Slider
                            value={person.weight}
                            onChange={(_, v) => onChange({ ...person, weight: v as number })}
                            step={0.1}
                            min={0.1}
                            max={3}
                            size="small"
                        />
                    </Box>
                )}
            </Stack>
        </Box>
    );
};

export default PersonRow;
