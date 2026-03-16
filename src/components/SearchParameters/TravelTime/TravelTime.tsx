import { Slider, Typography } from '@mui/material';

interface TravelTimeProps {
    value: number;
    onChange: (value: number) => void;
}

const MARKS = [
    { value: 60, label: '1h' },
    { value: 120, label: '2h' },
    { value: 180, label: '3h' },
    { value: 240, label: '4h' },
    { value: 300, label: '5h' },
];

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h} hr ${m} min`;
}

const TravelTime: React.FC<TravelTimeProps> = ({ value, onChange }) => {
    return (
        <>
            <Typography gutterBottom variant="subtitle2" color="text.secondary">
                Travel Time: {formatTime(value)}
            </Typography>
            <Slider
                value={value}
                onChange={(_, val) => onChange(val as number)}
                step={5}
                marks={MARKS}
                min={5}
                max={300}
                valueLabelDisplay="auto"
                valueLabelFormat={formatTime}
                sx={{ mt: 1 }}
            />
        </>
    );
};

export default TravelTime;
