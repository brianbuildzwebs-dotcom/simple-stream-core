import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PLAYER_SETTINGS, fetchPlayerSettings } from '@/lib/player-settings';

export function usePlayerSettings() {
  const [settings, setSettings] = useState(DEFAULT_PLAYER_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await fetchPlayerSettings();
      if (active) {
        setSettings(data);
        setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel('player-settings-home')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_settings' },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}