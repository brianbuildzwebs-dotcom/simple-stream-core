import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

export default function DashboardRoute() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const { hasAccess, isExpired, loading } = useSubscription(user);

  if (isLoadingAuth || !authChecked || (isAuthenticated && loading)) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isExpired && !hasAccess && user?.role !== 'admin') {
    return <Navigate to="/paywall" replace />;
  }

  return <Outlet />;
}