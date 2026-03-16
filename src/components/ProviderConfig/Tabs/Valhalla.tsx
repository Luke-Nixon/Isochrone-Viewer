import React, { useState } from 'react';
import { TextField, Box, Grid, Switch, FormControlLabel, Typography } from '@mui/material';
import { getValhallaConfig, setValhallaConfig } from '../../../services/IsochroneService';

export const Valhalla: React.FC = () => {
    const [config, setConfig] = useState(() => getValhallaConfig());

    const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const updated = { ...config, url: event.target.value };
        setConfig(updated);
        setValhallaConfig(updated);
    };

    const handleEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const updated = { ...config, enabled: event.target.checked };
        setConfig(updated);
        setValhallaConfig(updated);
    };

    return (
        <Box sx={{ p: 2 }}>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }} display="flex" justifyContent="space-between" alignItems="center">
                    <FormControlLabel
                        control={<Switch checked={config.enabled} onChange={handleEnabledChange} color="primary" />}
                        label="Enable Valhalla"
                    />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextField
                        fullWidth
                        label="Valhalla API URL"
                        placeholder="https://valhalla1.openstreetmap.de"
                        variant="outlined"
                        value={config.url}
                        onChange={handleUrlChange}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Defaults to the public OSM Valhalla instance. No API key required.
                    </Typography>
                </Grid>
            </Grid>
        </Box>
    );
};
