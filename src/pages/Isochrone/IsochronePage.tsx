import { useMemo, useState } from "react"
import { Box } from "@mui/material"
import ProviderConfig from "../../components/ProviderConfig/ProviderConfig"
import SearchParameters from "../../components/SearchParameters/SearchParameters"
import MapView from "../../components/MapView/MapView"
import type { MapMarkerSpec, MapPolygonSpec, MapFocus } from "../../components/MapView/MapView"
import { useAddressSearch } from "../../services/GeocodingService/useAddressSearch"
import type { ValhallaResponse } from "../../services/IsochroneService"
import GeoExport from "../../components/GeoExport/GeoExport"

const ACCENT = { dark: '#7c9fff', light: '#1a56d6' };
const RIGHTMOVE = '#ff8c00';

function IsochronePage() {
    const address = useAddressSearch();
    const [isochroneResult, setIsochroneResult] = useState<ValhallaResponse | null>(null);
    const [rightmovePolygon, setRightmovePolygon] = useState<GeoJSON.Feature<GeoJSON.Polygon> | null>(null);

    const markers: MapMarkerSpec[] = useMemo(() => (
        address.selected
            ? [{ id: 'selected', position: [address.selected.lat, address.selected.lng], color: ACCENT }]
            : []
    ), [address.selected]);

    const polygons: MapPolygonSpec[] = useMemo(() => {
        const out: MapPolygonSpec[] = [];
        if (isochroneResult) {
            out.push({
                id: `iso-${JSON.stringify(isochroneResult)}`,
                data: isochroneResult,
                color: ACCENT,
                fillOpacity: 0.2,
                weight: 2,
            });
        }
        if (rightmovePolygon) {
            out.push({
                id: `rm-${JSON.stringify(rightmovePolygon)}`,
                data: rightmovePolygon,
                color: RIGHTMOVE,
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '6 4',
            });
        }
        return out;
    }, [isochroneResult, rightmovePolygon]);

    const focus: MapFocus | undefined = address.selected
        ? { points: [[address.selected.lat, address.selected.lng]], singlePointZoom: 13 }
        : undefined;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 3,
                height: { xs: 'auto', md: '100%' },
                minHeight: { xs: '100%', md: 'unset' },
                width: '100%',
                boxSizing: 'border-box'
            }}
        >
            {/* Left Column: Configuration Panels */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    flexShrink: 0,
                    width: { xs: '100%', md: '33.333%', lg: '25%' },
                    height: { xs: 'auto', md: '100%' },
                    overflowY: { xs: 'visible', md: 'auto' }
                }}
            >
                <Box sx={{ flexShrink: 0 }}>
                    <ProviderConfig />
                </Box>
                <SearchParameters
                    address={address}
                    onResult={setIsochroneResult}
                    sx={{
                        flexGrow: { xs: 0, md: 1 },
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                />
            </Box>

            {/* Right Column: Map + Export */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1, height: { xs: 500, md: '100%' }, minWidth: 0 }}>
                <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <MapView markers={markers} polygons={polygons} focus={focus} />
                </Box>
                <GeoExport isochroneResult={isochroneResult} onPolygonChange={setRightmovePolygon} />
            </Box>
        </Box>
    )
}

export default IsochronePage
