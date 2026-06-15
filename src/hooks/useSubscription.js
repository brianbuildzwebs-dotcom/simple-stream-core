import { useState, useEffect, useCallback } from 'react';
import {
  initUserSubscription,
  getSubscriptionAccess,
} from '@/lib/subscription';

export function useSubscription(user) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sub = await initUserSubscription();
      setSubscription(sub);
    } catch (error) {
      console.warn('Subscription load failed:', error.message);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const { daysLeft, isPaid, isExpired, hasAccess } = getSubscriptionAccess(
    subscription,
    user
  );

  return {
    subscription,
    loading,
    daysLeft,
    isExpired,
    isPaid,
    hasAccess,
    reload: load,
  };
}