import { Navigate, Outlet } from 'react-router-dom';
import MfaGate from '@/components/auth/MfaGate';
import { useAuth } from '@/lib/AuthContext';

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

export default function AdminRoute() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <MfaGate>
      <Outlet />
    </MfaGate>
  );
}