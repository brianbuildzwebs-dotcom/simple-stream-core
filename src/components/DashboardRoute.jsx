import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import MfaGate from '@/components/auth/MfaGate';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

export default function DashboardRoute() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const { hasAccess, isExpired, loading, reload } = useSubscription(user);
  const [subscriptionTimedOut, setSubscriptionTimedOut] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !loading) {
      setSubscriptionTimedOut(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSubscriptionTimedOut(true);
      reload().catch(() => null);
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, loading, reload]);

  if (isLoadingAuth || !authChecked) {
    return <Loading />;
  }

  if (isAuthenticated && loading && !subscriptionTimedOut) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isExpired && !hasAccess && user?.role !== 'admin') {
    return <Navigate to="/paywall" replace />;
  }

  return (
    <MfaGate>
      <Outlet />
    </MfaGate>
  );
}