import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, useMap } from 'react-leaflet';
import { IconButton, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import type { GeocodingResult } from '../../services/GeocodingService';
import type { ValhallaResponse } from '../../services/IsochroneService';
import './MapView.css';

const UK_CENTER: [number, number] = [52.5, -1.5];
const DEFAULT_ZOOM = 7;

const TILES = {
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        markerColor: '#7c9fff',
    },
    light: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        markerColor: '#1a56d6',
    },
};

interface FlyToProps {
    selected: GeocodingResult | null;
}

const FlyTo: React.FC<FlyToProps> = ({ selected }) => {
    const map = useMap();

    useEffect(() => {
        if (selected) {
            map.flyTo([selected.lat, selected.lng], 13, { duration: 1.2 });
        }
    }, [selected, map]);

    return null;
};

interface MapViewProps {
    selected: GeocodingResult | null;
    isochroneResult: ValhallaResponse | null;
    rightmovePolygon: GeoJSON.Feature<GeoJSON.Polygon> | null;
}

const MapView: React.FC<MapViewProps> = ({ selected, isochroneResult, rightmovePolygon }) => {
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const tiles = TILES[theme];

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <MapContainer
                center={UK_CENTER}
                zoom={DEFAULT_ZOOM}
                style={{ width: '100%', height: '100%', borderRadius: 16 }}
            >
                <TileLayer url={tiles.url} attribution={tiles.attribution} />
                <FlyTo selected={selected} />
                {isochroneResult && (
                    <GeoJSON
                        key={JSON.stringify(isochroneResult)}
                        data={isochroneResult}
                        style={{ color: tiles.markerColor, fillColor: tiles.markerColor, fillOpacity: 0.2, weight: 2 }}
                    />
                )}
                {rightmovePolygon && (
                    <GeoJSON
                        key={JSON.stringify(rightmovePolygon)}
                        data={rightmovePolygon}
                        style={{ color: '#ff8c00', fillColor: '#ff8c00', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
                    />
                )}
                {selected && (
                    <CircleMarker
                        center={[selected.lat, selected.lng]}
                        radius={8}
                        pathOptions={{ color: tiles.markerColor, fillColor: tiles.markerColor, fillOpacity: 1, weight: 2 }}
                    />
                )}
            </MapContainer>

            <Tooltip title={theme === 'dark' ? 'Switch to light map' : 'Switch to dark map'} placement="left">
                <IconButton
                    onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 80,
                        left: 10,
                        zIndex: 1000,
                        background: 'rgba(255, 255, 255, 0.07)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        '&:hover': {
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                    }}
                >
                    {theme === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </IconButton>
            </Tooltip>
        </div>
    );
};

export default MapView;
