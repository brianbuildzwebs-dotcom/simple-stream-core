import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Check } from 'lucide-react';

const DEFAULT_SETTINGS = {
  player_name: 'Simple Streams',
  primary_color: '#3b82f6',
  chat_enabled: true,
  profanity_filter: false,
};

export default function PlayerSettingsForm() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('player_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Failed to load settings:', error.message);
        setSettings({ ...DEFAULT_SETTINGS });
        return;
      }

      if (data) {
        setSettings(data);
      } else {
        const { data: created, error: createError } = await supabase
          .from('player_settings')
          .insert(DEFAULT_SETTINGS)
          .select()
          .single();

        if (createError) {
          console.warn('Failed to create settings:', createError.message);
          setSettings({ ...DEFAULT_SETTINGS });
        } else {
          setSettings(created);
        }
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);

    const payload = {
      player_name: settings.player_name,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      chat_enabled: settings.chat_enabled,
      profanity_filter: settings.profanity_filter,
    };

    if (settings.id) {
      await supabase.from('player_settings').update(payload).eq('id', settings.id);
    } else {
      const { data } = await supabase.from('player_settings').insert(payload).select().single();
      if (data) setSettings(data);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!settings) return <p className="text-muted-foreground text-sm">Loading settings...</p>;

  return (
    <div className="bg-card border border-border/50 rounded-xl p-6 space-y-6 max-w-lg">
      <h2 className="text-lg font-semibold">Player Branding</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium">Player Name</label>
        <Input
          value={settings.player_name || ''}
          onChange={(e) => setSettings({ ...settings, player_name: e.target.value })}
          placeholder="Simple Streams"
          className="bg-secondary/50 border-border/50"
        />
        <p className="text-xs text-muted-foreground">Displayed in the player header, footer, and embed</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Logo URL</label>
        <Input
          value={settings.logo_url || ''}
          onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
          placeholder="https://example.com/logo.png"
          className="bg-secondary/50 border-border/50"
        />
        {settings.logo_url && (
          <img src={settings.logo_url} alt="Logo preview" className="h-8 mt-1 rounded object-contain" />
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Primary Color</label>
        <div className="flex gap-3 items-center">
          <input
            type="color"
            value={settings.primary_color || '#3b82f6'}
            onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
            className="w-12 h-10 rounded-lg cursor-pointer border border-border/50 bg-secondary/50 p-1"
          />
          <Input
            value={settings.primary_color || ''}
            onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
            placeholder="#3b82f6"
            className="bg-secondary/50 border-border/50 font-mono max-w-36"
          />
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-border/30">
        <h3 className="text-sm font-semibold">Chat Settings</h3>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.chat_enabled ?? true}
            onChange={(e) => setSettings({ ...settings, chat_enabled: e.target.checked })}
            className="w-4 h-4 rounded accent-primary"
          />
          <div>
            <p className="text-sm font-medium">Enable Live Chat</p>
            <p className="text-xs text-muted-foreground">Show the chat overlay on the player</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.profanity_filter ?? false}
            onChange={(e) => setSettings({ ...settings, profanity_filter: e.target.checked })}
            className="w-4 h-4 rounded accent-primary"
          />
          <div>
            <p className="text-sm font-medium">Profanity Filter</p>
            <p className="text-xs text-muted-foreground">Auto-replace offensive words with ***</p>
          </div>
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Settings Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}