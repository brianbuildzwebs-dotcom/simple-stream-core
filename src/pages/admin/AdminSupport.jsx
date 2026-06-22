import React, { useEffect, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { fetchAdminSupportRequests, updateSupportRequest } from '@/lib/feedback';
import { toast } from '@/components/ui/use-toast';

const STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed'];

export default function AdminSupport() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});

  const load = async () => {
    const data = await fetchAdminSupportRequests({ status: filter });
    setRows(data);
  };

  useEffect(() => {
    load()
      .catch((error) => toast({ title: 'Failed to load support', description: error.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      const updated = await updateSupportRequest(id, { status });
      setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
      toast({ title: 'Status updated' });
    } catch (error) {
      toast({ title: error.message, variant: 'destructive' });
    }
  };

  const saveNotes = async (id) => {
    try {
      const updated = await updateSupportRequest(id, { admin_notes: notesDraft[id] || '' });
      setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
      toast({ title: 'Notes saved' });
    } catch (error) {
      toast({ title: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-primary" />
          Support requests
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          User-reported problems with structured details for faster fixes.
        </p>
      </div>

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm"
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status === 'all' ? 'All statuses' : status.replace(/_/g, ' ')}
          </option>
        ))}
      </select>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No support requests in this filter.</p>
        ) : (
          rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <div key={row.id} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-secondary/20 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{row.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {row.user_email || 'No email'} · {row.category} · {row.severity} ·{' '}
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase shrink-0">
                    {row.status.replace(/_/g, ' ')}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-border/50 p-4 space-y-3 text-sm">
                    <p className="text-foreground whitespace-pre-wrap">{row.description}</p>
                    {row.steps_tried && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Tried:</strong> {row.steps_tried}
                      </p>
                    )}
                    {row.browser_device && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Device:</strong> {row.browser_device}
                      </p>
                    )}
                    {row.page_url && (
                      <p className="text-xs text-muted-foreground break-all">
                        <strong className="text-foreground">URL:</strong> {row.page_url}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.filter((s) => s !== 'all').map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateStatus(row.id, status)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            row.status === status
                              ? 'bg-primary/15 border-primary/40 text-primary'
                              : 'border-border/50 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {status.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={notesDraft[row.id] ?? row.admin_notes ?? ''}
                        onChange={(e) =>
                          setNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        placeholder="Internal notes…"
                        className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveNotes(row.id)}
                        className="px-3 py-2 rounded-lg bg-secondary text-xs font-medium"
                      >
                        Save notes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}