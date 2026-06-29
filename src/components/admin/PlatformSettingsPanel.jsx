import React, { useEffect, useState } from 'react';
import { Check, Radio, Sparkles } from 'lucide-react';
import { SIMULCAST_STATUSES } from '@/lib/launch-config';
import { fetchAdminPlatformSettings, updateAdminPlatformSettings } from '@/lib/admin-api';
import { toast } from '@/components/ui/use-toast';

export default function PlatformSettingsPanel() {
  const [launchOffer, setLaunchOffer] = useState(null);
  const [simulcastStatus, setSimulcastStatus] = useState('coming_soon');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchAdminPlatformSettings()
      .then((payload) => {
        setLaunchOffer(payload.launchOffer);
        setSimulcastStatus(payload.simulcast?.status || 'coming_soon');
        setLoadFailed(false);
      })
      .catch((error) => {
        setLoadFailed(true);
        toast({
          title: 'Could not load platform settings',
          description: error.message,
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = await updateAdminPlatformSettings({
        simulcast: { status: simulcastStatus },
        launch_offer: { active: launchOffer?.active !== false },
      });
      setLaunchOffer(payload.launchOffer);
      setSimulcastStatus(payload.simulcast?.status || simulcastStatus);
      setSaved(true);
      toast({ title: 'Platform settings saved' });
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="h-5 w-48 bg-secondary/60 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Launch controls</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Flip simulcast visibility when you are ready. Launch pricing copy uses defaults until you
            edit future prices in the database.
          </p>
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-xs text-destructive-foreground leading-relaxed">
            Launch controls could not be loaded. Hard-refresh and try again. If this persists after
            saving, contact support.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-muted-foreground" />
            Simulcast dashboard teaser
          </label>
          <select
            value={simulcastStatus}
            onChange={(event) => setSimulcastStatus(event.target.value)}
            className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground"
          >
            {SIMULCAST_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/20 px-3 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={launchOffer?.active !== false}
            onChange={(event) =>
              setLaunchOffer((prev) => ({ ...prev, active: event.target.checked }))
            }
            className="mt-0.5"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Show launch pricing offer</span> on the
            public pricing page (strikethrough future prices + grandfather note).
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || loadFailed || !launchOffer}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save launch controls'}
      </button>
    </div>
  );
}