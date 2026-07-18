import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { ProjectsPage } from './pages/ProjectsPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { ProjectBoardPage } from './pages/ProjectBoardPage'
import { SettingsPage } from './pages/SettingsPage'
import { InvitePage } from './pages/InvitePage'
import { RequireAuth } from './components/layout/RequireAuth'
import { useAuth } from './hooks/useAuth'

/**
 * App router — multi-page platform (not a single HTML monolith).
 */
export function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/"
        element={
          !loading && user ? <Navigate to="/app" replace /> : <LandingPage />
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <ProjectsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/new"
        element={
          <RequireAuth>
            <NewProjectPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/projects/:projectId"
        element={
          <RequireAuth>
            <ProjectBoardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
