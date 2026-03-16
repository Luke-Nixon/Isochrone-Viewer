import React, { useState } from 'react';
import { TextField, Box, Grid, Switch, FormControlLabel, InputAdornment, IconButton, Alert } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { getMapboxConfig, setMapboxConfig } from '../../../services/IsochroneService';

export const Mapbox: React.FC = () => {
    const [config, setConfig] = useState(() => getMapboxConfig());
    const [showPassword, setShowPassword] = useState(false);

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const handleKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const updated = { ...config, apiKey: event.target.value };
        setConfig(updated);
        setMapboxConfig(updated);
    };

    const handleEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const updated = { ...config, enabled: event.target.checked };
        setConfig(updated);
        setMapboxConfig(updated);
    };

    return (
        <Box sx={{ p: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>Not yet implemented — configuration is saved but searches will not run.</Alert>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }} display="flex" justifyContent="space-between" alignItems="center">
                    <FormControlLabel
                        control={<Switch checked={config.enabled} onChange={handleEnabledChange} color="primary" />}
                        label="Enable Mapbox"
                    />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextField
                        fullWidth
                        label="Mapbox API Key"
                        placeholder="pk.eyJ1I..."
                        type={showPassword ? 'text' : 'password'}
                        variant="outlined"
                        value={config.apiKey}
                        onChange={handleKeyChange}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle Mapbox API key visibility"
                                            onClick={handleClickShowPassword}
                                            onMouseDown={handleMouseDownPassword}
                                            edge="end"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }
                        }}
                    />
                </Grid>
            </Grid>
        </Box>
    );
};
