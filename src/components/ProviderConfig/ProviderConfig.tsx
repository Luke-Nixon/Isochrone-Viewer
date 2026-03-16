import React, { useState } from 'react';
import { Paper, Box, Typography, Tabs, Tab } from '@mui/material';
import { Mapbox } from './Tabs/Mapbox';
import { OpenRoute } from './Tabs/OpenRoute';
import { Valhalla } from './Tabs/Valhalla';

const ProviderConfig: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    return (
        <Paper
            elevation={5}
            sx={{
                width: '100%',
                borderRadius: 4,
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
        >
            <Box sx={{ p: 3, pb: 0 }}>
                <Typography variant="h5" component="h1" gutterBottom align="center" fontWeight="bold">
                    Provider Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                    Configure your isochrone provider.
                </Typography>
            </Box>

            <Box sx={{ px: 3, minHeight: 250 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                        aria-label="Isochrone provider selection"
                    >
                        <Tab label="Valhalla" id="tabview-tab-0" aria-controls="tabview-panel-0" />
                        <Tab label="Mapbox" id="tabview-tab-1" aria-controls="tabview-panel-1" />
                        <Tab label="OpenRoute" id="tabview-tab-2" aria-controls="tabview-panel-2" />
                    </Tabs>
                </Box>
                <Box sx={{ py: 2 }} role="tabpanel" id={`tabview-panel-${activeTab}`} aria-labelledby={`tabview-tab-${activeTab}`}>
                    {activeTab === 0 && <Valhalla />}
                    {activeTab === 1 && <Mapbox />}
                    {activeTab === 2 && <OpenRoute />}
                </Box>
            </Box>
        </Paper>
    );
};

export default ProviderConfig;
