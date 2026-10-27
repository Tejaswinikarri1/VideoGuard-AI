import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import AnalysesList from './pages/AnalysesList';
import AnalysisPage from './pages/AnalysisPage';
import AuditLogs from './pages/AuditLogs';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Login from './pages/Login';
import PendingReviews from './pages/PendingReviews';
import Register from './pages/Register';
import Settings from './pages/Settings';
import SystemOperations from './pages/SystemOperations';
import Upload from './pages/Upload';
import UserManagement from './pages/UserManagement';
import VideoDetail from './pages/VideoDetail';
import ZoneEditor from './pages/ZoneEditor';

function Protected({ children, role }: { children: ReactElement; role?: string }) {
  const { authenticated, loading, has } = useAuth();
  if (loading) return <Spinner />;
  if (!authenticated) return <Navigate to="/login" replace />;
  if (role && !has(role)) return <div className="state state--err" role="alert">You do not have permission to view this page.</div>;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/videos" element={<Library />} />
        <Route path="/videos/upload" element={<Upload />} />
        <Route path="/videos/:id" element={<VideoDetail />} />
        <Route path="/videos/:id/zones" element={<ZoneEditor />} />
        <Route path="/analyses" element={<AnalysesList />} />
        <Route path="/analyses/:id" element={<AnalysisPage />} />
        <Route path="/reviews" element={<PendingReviews />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin/users" element={<Protected role="ADMIN"><UserManagement /></Protected>} />
        <Route path="/admin/audit-logs" element={<Protected role="ADMIN"><AuditLogs /></Protected>} />
        <Route path="/admin/system" element={<Protected role="ADMIN"><SystemOperations /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
