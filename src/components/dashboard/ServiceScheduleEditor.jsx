import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { fetchServiceSchedule, saveServiceSchedule } from '@/lib/service-schedule-api';
import {
  buildScheduleHoldingLine,
  COMMON_TIMEZONES,
  getNextServiceSlot,
  SERVICE_DAY_OPTIONS,
} from '@/lib/service-schedule';

function emptySlot() {
  return { dayOfWeek: 0, timeLocal: '10:30', label: '' };
}

export default function ServiceScheduleEditor() {
  const [timezone, setTimezone] = useState('America/New_York');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const schedulePreview = useMemo(() => {
    if (!slots.length) return null;
    const schedule = { timezone, slots: slots.filter((slot) => slot.timeLocal) };
    const next = getNextServiceSlot(schedule);
    const holding = buildScheduleHoldingLine(schedule);
    return { next, holding };
  }, [slots, timezone]);

  useEffect(() => {
    fetchServiceSchedule()
      .then((payload) => {
        setTimezone(payload.timezone || 'America/New_York');
        setSlots(payload.slots?.length ? payload.slots : [emptySlot()]);
      })
      .catch((error) => {
        toast({
          title: 'Could not load service schedule',
          description: error.message,
          variant: 'destructive',
        });
        setSlots([emptySlot()]);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateSlot = (index, patch) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const removeSlot = (index) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = await saveServiceSchedule({
        timezone,
        slots: slots.filter((slot) => slot.timeLocal),
      });
      setTimezone(payload.timezone || timezone);
      setSlots(payload.slots?.length ? payload.slots : [emptySlot()]);
      setSaved(true);
      toast({ title: 'Service schedule saved' });
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast({
        title: 'Could not save schedule',
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
        <div className="h-5 w-40 bg-secondary/60 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarClock className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Weekly service schedule</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Set once — each day and time repeats every week until you change or remove it. Applies to
            every embed. Viewers see the next service date, time, and countdown while they wait.
            Custom holding messages are still edited per embed below.
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-foreground">Church timezone</label>
        <select
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="mt-1 w-full max-w-sm rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground"
        >
          {COMMON_TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {slots.map((slot, index) => (
          <div
            key={`${index}-${slot.id || 'new'}`}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-end"
          >
            <div>
              <label className="text-[11px] text-muted-foreground">Day</label>
              <select
                value={slot.dayOfWeek}
                onChange={(event) => updateSlot(index, { dayOfWeek: Number(event.target.value) })}
                className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm"
              >
                {SERVICE_DAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Time</label>
              <input
                type="time"
                value={slot.timeLocal}
                onChange={(event) => updateSlot(index, { timeLocal: event.target.value })}
                className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Label (optional)</label>
              <input
                value={slot.label || ''}
                onChange={(event) => updateSlot(index, { label: event.target.value })}
                placeholder="Morning Worship"
                className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => removeSlot(index)}
              disabled={slots.length === 1}
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
              title="Remove time"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {schedulePreview?.holding && (
        <div className="rounded-xl border border-border/40 bg-secondary/30 p-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            What viewers see while waiting
          </p>
          <p className="text-sm font-medium text-foreground">{schedulePreview.holding.headline}</p>
          {schedulePreview.holding.countdown && (
            <p className="text-xs text-primary font-mono">Countdown: {schedulePreview.holding.countdown}</p>
          )}
          <p className="text-xs text-muted-foreground">{schedulePreview.holding.detail}</p>
          <p className="text-[11px] text-muted-foreground pt-1">
            When OBS is live, video plays immediately — the schedule only affects the waiting screen.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSlots((prev) => [...prev, emptySlot()])}
          disabled={slots.length >= 12}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/50 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add service time
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save schedule'}
        </button>
      </div>
    </div>
  );
}