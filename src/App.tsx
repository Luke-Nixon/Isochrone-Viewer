import { useState } from "react"
import { ThemeProvider, CssBaseline, Box } from "@mui/material"
import AnimatedBackground from "./components/AnimatedBackground/AnimatedBackground"
import { glassTheme } from "./theme"
import ProviderConfig from "./components/ProviderConfig/ProviderConfig"
import SearchParameters from "./components/SearchParameters/SearchParameters"
import MapView from "./components/MapView/MapView"
import { useAddressSearch } from "./services/GeocodingService/useAddressSearch"
import type { ValhallaResponse } from "./services/IsochroneService"
import GeoExport from "./components/GeoExport/GeoExport"

function App() {
    const address = useAddressSearch();
    const [isochroneResult, setIsochroneResult] = useState<ValhallaResponse | null>(null);
    const [rightmovePolygon, setRightmovePolygon] = useState<GeoJSON.Feature<GeoJSON.Polygon> | null>(null);

    return (
        <ThemeProvider theme={glassTheme}>
            <CssBaseline />
            <AnimatedBackground />

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 3,
                    height: { xs: 'auto', md: '100vh' },
                    minHeight: { xs: '100vh', md: 'unset' },
                    width: '100vw',
                    position: 'relative',
                    zIndex: 1,
                    p: 3,
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
                        <MapView selected={address.selected} isochroneResult={isochroneResult} rightmovePolygon={rightmovePolygon} />
                    </Box>
                    <GeoExport isochroneResult={isochroneResult} onPolygonChange={setRightmovePolygon} />
                </Box>
            </Box>
        </ThemeProvider>
    )
}

export default App
