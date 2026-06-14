import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import 'dayjs/locale/ru'
import App from './App'
import { theme } from './theme'
import { MeetingProvider } from './store/MeetingContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
        <MeetingProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MeetingProvider>
      </LocalizationProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
