import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ConnectPage from './pages/ConnectPage'
import RecordingPage from './pages/RecordingPage'
import TranscriptPage from './pages/TranscriptPage'
import AssignmentsPage from './pages/AssignmentsPage'
import ArchivePage from './pages/ArchivePage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/recording" element={<RecordingPage />} />
        <Route path="/transcript" element={<TranscriptPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
