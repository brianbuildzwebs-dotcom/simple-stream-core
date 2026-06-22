import { supabase } from '@/lib/supabase';

export async function submitSupportRequest({
  userId,
  userEmail,
  category,
  severity,
  subject,
  description,
  stepsTried,
  browserDevice,
  pageUrl,
}) {
  const { data, error } = await supabase
    .from('support_requests')
    .insert({
      user_id: userId,
      user_email: userEmail || null,
      category,
      severity,
      subject: subject.trim(),
      description: description.trim(),
      steps_tried: stepsTried?.trim() || null,
      browser_device: browserDevice?.trim() || null,
      page_url: pageUrl?.trim() || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMySupportRequests(userId) {
  const { data, error } = await supabase
    .from('support_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function submitFeatureSuggestion({
  userId,
  userEmail,
  title,
  description,
  useCase,
  priority,
}) {
  const { data, error } = await supabase
    .from('feature_suggestions')
    .insert({
      user_id: userId,
      user_email: userEmail || null,
      title: title.trim(),
      description: description.trim(),
      use_case: useCase?.trim() || null,
      priority,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMyFeatureSuggestions(userId) {
  const { data, error } = await supabase
    .from('feature_suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchAdminSupportRequests({ status = 'all' } = {}) {
  let query = supabase
    .from('support_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateSupportRequest(id, patch) {
  const { data, error } = await supabase
    .from('support_requests')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAdminFeatureSuggestions({ status = 'all' } = {}) {
  let query = supabase
    .from('feature_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateFeatureSuggestion(id, patch) {
  const { data, error } = await supabase
    .from('feature_suggestions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}