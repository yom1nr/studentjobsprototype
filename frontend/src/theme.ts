import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0B3D91',        // Navy blue (Sidebar, buttons)
      light: '#1565C0',
      dark: '#072A68',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0056D2',        // Bright blue (accent, active state)
      contrastText: '#ffffff',
    },
    background: {
      default: '#F4F7F9',     // Light grey page background
      paper: '#ffffff',
    },
    text: {
      primary: '#1A2332',
      secondary: '#6B7280',
    },
    error: {
      main: '#EF4444',
    },
    success: {
      main: '#22C55E',
    },
    warning: {
      main: '#F59E0B',
      contrastText: '#ffffff',
    },
    info: {
      main: '#3B82F6',
    },
    divider: '#E5E7EB',
  },
  typography: {
    fontFamily: '"Prompt", "Noto Sans Thai", "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    body1: { fontWeight: 400, lineHeight: 1.7 },
    body2: { fontWeight: 400, lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          padding: '8px 20px',
          '&:hover': { boxShadow: 'none' },
        },
        contained: {
          '&:hover': { opacity: 0.92 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)',
          border: '1px solid #E5E7EB',
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#ffffff',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(0, 86, 210, 0.12)',
            color: '#0056D2',
            '&:hover': { backgroundColor: 'rgba(0, 86, 210, 0.18)' },
            '& .MuiListItemIcon-root': { color: '#0056D2' },
          },
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
        },
      },
    },
  },
})
