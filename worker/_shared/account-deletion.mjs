import { isUserAdmin } from './admin-access.mjs';
import { deleteCloudflareLiveInput } from './cloudflare-stream.mjs';
import { anonymizeLegalAcceptanceOnAccountDeletion } from './legal-acceptance.mjs';
import { cancelActiveStripeSubscription } from './subscription-billing.mjs';
import { supabaseDelete, supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

function requireSupabaseAdmin(env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Account deletion is not configured on the server');
  }
  return { url, key };
}

async function scrubUserFromTrialAbuse(env, email) {
  if (!email) return;

  const rows = await supabaseSelect(env, 'trial_abuse', 'select=id,email_list');
  for (const row of rows ?? []) {
    if (!Array.isArray(row.email_list) || !row.email_list.includes(email)) continue;
    const nextEmails = row.email_list.filter((value) => value !== email);
    await supabaseUpdate(env, 'trial_abuse', `id=eq.${row.id}`, {
      email_list: nextEmails,
      registration_count: Math.max(0, nextEmails.length),
    });
  }
}

async function deleteAuthUser(env, userId) {
  const { url, key } = requireSupabaseAdmin(env);
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.msg || 'Failed to delete account');
  }
}

export async function deleteUserAccount(user, env) {
  if (!user?.id) {
    throw new Error('Not authenticated');
  }

  if (await isUserAdmin(env, user.id)) {
    throw new Error(
      'Admin accounts cannot be deleted here. Ask another administrator to change your role first.'
    );
  }

  await cancelActiveStripeSubscription(env, user, { immediate: true }).catch(() => null);

  const streamKeys = await supabaseSelect(
    env,
    'stream_keys',
    `user_id=eq.${user.id}&select=id,cloudflare_input_id`
  );

  for (const key of streamKeys ?? []) {
    await deleteCloudflareLiveInput(env, key.cloudflare_input_id);
  }

  await supabaseDelete(env, 'stream_keys', `user_id=eq.${user.id}`);
  await supabaseDelete(env, 'embed_instances', `user_id=eq.${user.id}`);
  await supabaseDelete(env, 'user_subscriptions', `user_id=eq.${user.id}`);
  await scrubUserFromTrialAbuse(env, user.email);
  await anonymizeLegalAcceptanceOnAccountDeletion(env, user.id);
  await supabaseDelete(env, 'profiles', `id=eq.${user.id}`);
  await deleteAuthUser(env, user.id);

  return { deleted: true };
}