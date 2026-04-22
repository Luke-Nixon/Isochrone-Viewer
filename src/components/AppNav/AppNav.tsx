import { Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import GroupsIcon from '@mui/icons-material/Groups';
import { useLocation, useNavigate } from 'react-router-dom';

const AppNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const current = location.pathname.startsWith('/meet') ? '/meet' : '/';

    return (
        <Paper
            elevation={3}
            sx={{
                position: 'fixed',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1100,
                px: 0.5,
                py: 0.5,
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.07)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
        >
            <ToggleButtonGroup
                value={current}
                exclusive
                size="small"
                onChange={(_, next) => { if (next) navigate(next); }}
                sx={{
                    '& .MuiToggleButton-root': {
                        border: 'none',
                        borderRadius: '999px !important',
                        px: 2,
                        color: 'rgba(255,255,255,0.7)',
                        textTransform: 'none',
                        '&.Mui-selected': {
                            background: 'rgba(255,255,255,0.15)',
                            color: '#fff',
                        },
                    },
                }}
            >
                <ToggleButton value="/"><MapIcon fontSize="small" sx={{ mr: 0.75 }} />Isochrone</ToggleButton>
                <ToggleButton value="/meet"><GroupsIcon fontSize="small" sx={{ mr: 0.75 }} />Meeting Point</ToggleButton>
            </ToggleButtonGroup>
        </Paper>
    );
};

export default AppNav;
