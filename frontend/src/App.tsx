import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ConnectPage from './pages/ConnectPage'
import RecordingPage from './pages/RecordingPage'
import TranscriptPage from './pages/TranscriptPage'
import AssignmentsPage from './pages/AssignmentsPage'
import ArchivePage from './pages/ArchivePage'
import UsersPage from './pages/UsersPage'
import UploadPage from './pages/UploadPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/recording" element={<RecordingPage />} />
          <Route path="/transcript" element={<TranscriptPage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
