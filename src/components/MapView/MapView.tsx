import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, useMap, Tooltip as LeafletTooltip } from 'react-leaflet';
import { IconButton, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import bbox from '@turf/bbox';
import { featureCollection, point as turfPoint } from '@turf/helpers';
import { resolveColor } from './MapView.types';
import type { MapFocus, MapMarkerSpec, MapPolygonSpec, MapTheme } from './MapView.types';
import './MapView.css';

const UK_CENTER: [number, number] = [52.5, -1.5];
const DEFAULT_ZOOM = 7;

const TILES = {
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    light: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
};

const FocusEffect: React.FC<{ focus?: MapFocus }> = ({ focus }) => {
    const map = useMap();
    const focusKey = focus ? JSON.stringify(focus.points) : '';

    useEffect(() => {
        if (!focus || focus.points.length === 0) return;
        if (focus.points.length === 1) {
            const [lat, lng] = focus.points[0];
            map.flyTo([lat, lng], focus.singlePointZoom ?? 13, { duration: 1.0 });
            return;
        }
        const fc = featureCollection(focus.points.map(([lat, lng]) => turfPoint([lng, lat])));
        const [minLng, minLat, maxLng, maxLat] = bbox(fc);
        const pad = focus.fitPadding ?? 40;
        map.flyToBounds([[minLat, minLng], [maxLat, maxLng]], {
            padding: [pad, pad],
            duration: 1.0,
        });
        // focusKey captures the position list as a single string dep
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusKey, map]);

    return null;
};

interface MapViewProps {
    markers?: MapMarkerSpec[];
    polygons?: MapPolygonSpec[];
    focus?: MapFocus;
}

const MapView: React.FC<MapViewProps> = ({ markers = [], polygons = [], focus }) => {
    const [theme, setTheme] = useState<MapTheme>('dark');
    const tiles = TILES[theme];

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <MapContainer
                center={UK_CENTER}
                zoom={DEFAULT_ZOOM}
                style={{ width: '100%', height: '100%', borderRadius: 16 }}
            >
                <TileLayer url={tiles.url} attribution={tiles.attribution} />
                <FocusEffect focus={focus} />

                {polygons.map(p => {
                    const color = resolveColor(p.color, theme);
                    const fillColor = resolveColor(p.fillColor ?? p.color, theme);
                    return (
                        <GeoJSON
                            key={p.id}
                            data={p.data}
                            style={{
                                color,
                                fillColor,
                                fillOpacity: p.fillOpacity ?? 0.2,
                                weight: p.weight ?? 2,
                                ...(p.dashArray ? { dashArray: p.dashArray } : {}),
                            }}
                        />
                    );
                })}

                {markers.map(m => {
                    const color = resolveColor(m.color, theme);
                    return (
                        <CircleMarker
                            key={m.id}
                            center={m.position}
                            radius={m.radius ?? 8}
                            pathOptions={{
                                color,
                                fillColor: color,
                                fillOpacity: m.fillOpacity ?? 1,
                                weight: m.weight ?? 2,
                            }}
                            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
                        >
                            {m.label && (
                                <LeafletTooltip
                                    permanent={m.labelPermanent}
                                    direction="top"
                                    offset={[0, m.labelPermanent ? -14 : -8]}
                                >
                                    {m.label}
                                </LeafletTooltip>
                            )}
                        </CircleMarker>
                    );
                })}
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
export type { MapMarkerSpec, MapPolygonSpec, MapFocus, ColorSpec, MapTheme } from './MapView.types';
