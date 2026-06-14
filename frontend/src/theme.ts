import { createTheme } from '@mui/material/styles'
import { ruRU } from '@mui/material/locale'

// Фирменный красный РЖД
export const RZD_RED = '#E21A1A'
export const RZD_DARK = '#1A1A2E'

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: {
        main: RZD_RED,
        dark: '#B71414',
        light: '#FF5A4D',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#2C3E73',
        contrastText: '#FFFFFF',
      },
      success: { main: '#2E7D32' },
      warning: { main: '#ED6C02' },
      background: {
        default: '#F4F5F7',
        paper: '#FFFFFF',
      },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: 'Roboto, "Segoe UI", Arial, sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.06)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: { root: { boxShadow: 'none' } },
      },
    },
  },
  ruRU,
)
