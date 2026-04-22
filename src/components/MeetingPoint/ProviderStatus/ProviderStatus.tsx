import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getValhallaConfig, setValhallaConfig } from '../../../services/IsochroneService';

interface ProviderStatusProps {
    onChange?: () => void;
}

const ProviderStatus: React.FC<ProviderStatusProps> = ({ onChange }) => {
    const [enabled, setEnabled] = useState(() => getValhallaConfig().enabled);

    useEffect(() => {
        const onStorage = () => setEnabled(getValhallaConfig().enabled);
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const enable = () => {
        const cfg = getValhallaConfig();
        setValhallaConfig({ ...cfg, enabled: true });
        setEnabled(true);
        onChange?.();
    };

    if (enabled) {
        return (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                    label="Valhalla enabled"
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ height: 22, fontSize: 11 }}
                />
            </Stack>
        );
    }

    return (
        <Alert severity="warning" variant="outlined" sx={{ mb: 1, py: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2">Valhalla is disabled</Typography>
                    <Typography variant="caption" color="text.secondary">
                        Enable to compute meeting points (uses the public OSM instance, no key needed).
                    </Typography>
                </Box>
                <Button size="small" variant="contained" onClick={enable}>
                    Enable
                </Button>
            </Stack>
        </Alert>
    );
};

export default ProviderStatus;
