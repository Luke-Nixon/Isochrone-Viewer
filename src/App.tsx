import { ThemeProvider, CssBaseline, Box } from "@mui/material"
import { Routes, Route } from "react-router-dom"
import AnimatedBackground from "./components/AnimatedBackground/AnimatedBackground"
import AppNav from "./components/AppNav/AppNav"
import { glassTheme } from "./theme"
import IsochronePage from "./pages/Isochrone/IsochronePage"
import MeetPage from "./pages/Meet/MeetPage"

function App() {
    return (
        <ThemeProvider theme={glassTheme}>
            <CssBaseline />
            <AnimatedBackground />
            <AppNav />

            <Box
                sx={{
                    height: { xs: 'auto', md: '100vh' },
                    minHeight: { xs: '100vh', md: 'unset' },
                    width: '100vw',
                    position: 'relative',
                    zIndex: 1,
                    p: 3,
                    pt: { xs: 9, md: 9 },
                    boxSizing: 'border-box',
                }}
            >
                <Routes>
                    <Route path="/" element={<IsochronePage />} />
                    <Route path="/meet" element={<MeetPage />} />
                </Routes>
            </Box>
        </ThemeProvider>
    )
}

export default App
