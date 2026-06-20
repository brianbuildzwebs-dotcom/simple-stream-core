import { useState, useEffect, useCallback } from 'react';
import {
  initUserSubscription,
  getSubscriptionAccess,
  fetchPlanForSubscription,
  getPlanLabel,
} from '@/lib/subscription';
import { syncStripeSubscription } from '@/lib/stripe';

function needsStripeReconcile(subscription, access, user) {
  if (subscription?.payment_status === 'canceled') return false;
  if (!access.isPaid && user?.role !== 'admin') return true;
  return !subscription?.tier_name || !subscription?.subscription_tier_id;
}

export function useSubscription(user) {
  const [subscription, setSubscription] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setPlan(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      let sub = await initUserSubscription();
      let access = getSubscriptionAccess(sub, user);

      if (needsStripeReconcile(sub, access, user)) {
        try {
          const sync = await syncStripeSubscription();
          if (sync.synced) {
            sub = await initUserSubscription();
            access = getSubscriptionAccess(sub, user);
          }
        } catch (error) {
          console.warn('Stripe subscription sync skipped:', error.message);
        }
      }

      const planRow = await fetchPlanForSubscription(sub);
      setSubscription(sub);
      setPlan(planRow);
      return sub;
    } catch (error) {
      console.warn('Subscription load failed:', error.message);
      setSubscription(null);
      setPlan(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const { daysLeft, isPaid, isExpired, hasAccess } = getSubscriptionAccess(
    subscription,
    user
  );

  const planLabel = getPlanLabel(subscription, user, plan);

  return {
    subscription,
    plan,
    planLabel,
    loading,
    daysLeft,
    isExpired,
    isPaid,
    hasAccess,
    reload: load,
  };
}