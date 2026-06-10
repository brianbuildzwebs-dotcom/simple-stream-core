import { supabase } from '@/lib/supabase';

export const DEFAULT_PLAYER_SETTINGS = {
  player_name: 'Simple Streams',
  logo_url: null,
  primary_color: '#3b82f6',
  chat_enabled: true,
  profanity_filter: false,
};

export async function fetchPlayerSettings() {
  const { data, error } = await supabase
    .from('player_settings')
    .select('player_name, logo_url, primary_color, chat_enabled, profanity_filter')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load player settings:', error.message);
    return { ...DEFAULT_PLAYER_SETTINGS };
  }

  if (!data) {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }

  return {
    player_name: data.player_name ?? DEFAULT_PLAYER_SETTINGS.player_name,
    logo_url: data.logo_url ?? null,
    primary_color: data.primary_color ?? DEFAULT_PLAYER_SETTINGS.primary_color,
    chat_enabled: data.chat_enabled ?? DEFAULT_PLAYER_SETTINGS.chat_enabled,
    profanity_filter: data.profanity_filter ?? DEFAULT_PLAYER_SETTINGS.profanity_filter,
  };
}