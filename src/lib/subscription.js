import { supabase } from '@/lib/supabase';

export async function initUserSubscription() {
  const { data, error } = await supabase.rpc('init_user_subscription');
  if (error) throw error;
  return data;
}

export async function fetchActiveTiers() {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchUserStreamKeys(userId) {
  const { data, error } = await supabase
    .from('stream_keys')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function fetchUserEmbeds(userId) {
  const { data, error } = await supabase
    .from('embed_instances')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export function computeTrialDaysLeft(subscription) {
  if (!subscription?.trial_active || !subscription?.trial_end_date) return null;
  const remaining = Math.ceil(
    (new Date(subscription.trial_end_date).getTime() - Date.now()) / 86400000
  );
  return Math.max(0, remaining);
}

export function getSubscriptionAccess(subscription, user) {
  const daysLeft = computeTrialDaysLeft(subscription);
  const isPaid =
    subscription?.is_paid ||
    subscription?.payment_status === 'free_admin' ||
    subscription?.payment_status === 'subscribed';
  const isExpired =
    subscription?.payment_status === 'unpaid_trial_expired' ||
    (!isPaid && subscription?.trial_active === false);
  const hasAccess =
    isPaid ||
    user?.role === 'admin' ||
    (subscription?.trial_active && daysLeft > 0);

  return { daysLeft, isPaid, isExpired, hasAccess };
}