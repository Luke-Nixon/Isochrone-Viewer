import React, { useState, useMemo, useEffect } from 'react';
import { Paper, Typography, Box, TextField, Button, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import type { ValhallaResponse } from '../../services/IsochroneService';
import { buildRightmoveResult, ringToGeoJSON } from './rightmove';

interface GeoExportProps {
    isochroneResult: ValhallaResponse | null;
    onPolygonChange?: (polygon: GeoJSON.Feature<GeoJSON.Polygon> | null) => void;
}

const GeoExport: React.FC<GeoExportProps> = ({ isochroneResult, onPolygonChange }) => {
    const [copied, setCopied] = useState(false);

    const result = useMemo(
        () => isochroneResult ? buildRightmoveResult(isochroneResult) : null,
        [isochroneResult],
    );

    useEffect(() => {
        onPolygonChange?.(result ? ringToGeoJSON(result.ring) : null);
    }, [result, onPolygonChange]);

    const url = result?.url ?? null;

    const handleCopy = async () => {
        if (!url) return;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpen = () => {
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <Paper
            elevation={3}
            sx={{
                p: 2,
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                    Export for Rightmove
                    {result && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {result.ring.length} pts · {url?.length ?? 0} chars
                        </Typography>
                    )}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Open directly in Rightmove" placement="left">
                        <span>
                            <Button
                                size="small"
                                variant="contained"
                                onClick={handleOpen}
                                disabled={!url}
                                sx={{ minWidth: 80 }}
                            >
                                Open
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'} placement="left">
                        <span>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={handleCopy}
                                disabled={!url}
                                startIcon={copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                                sx={{ minWidth: 110 }}
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </Button>
                        </span>
                    </Tooltip>
                </Box>
            </Box>
            <TextField
                fullWidth
                multiline
                rows={3}
                value={url ?? ''}
                placeholder="Run a search to generate the Rightmove URL..."
                slotProps={{ input: { readOnly: true } }}
                sx={{
                    '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.72rem' },
                }}
            />
        </Paper>
    );
};

export default GeoExport;
