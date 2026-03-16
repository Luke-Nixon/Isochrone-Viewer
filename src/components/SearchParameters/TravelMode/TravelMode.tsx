import { TextField, MenuItem } from '@mui/material';

const travelModes = [
    { value: 'driving', label: 'Driving' },
    { value: 'walking', label: 'Walking' },
    { value: 'cycling', label: 'Cycling' },
    { value: 'transit', label: 'Public Transit' },
];

interface TravelModeProps {
    value: string;
    onChange: (value: string) => void;
}

const TravelMode: React.FC<TravelModeProps> = ({ value, onChange }) => {
    return (
        <TextField
            fullWidth
            select
            label="Travel Mode"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {travelModes.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                    {option.label}
                </MenuItem>
            ))}
        </TextField>
    );
};

export default TravelMode;
