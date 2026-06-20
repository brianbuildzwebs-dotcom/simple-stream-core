import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileCheck, RefreshCw, Search, Shield } from 'lucide-react';
import { fetchAdminLegalAcceptance } from '@/lib/admin-api';
import { toast } from '@/components/ui/use-toast';

const STATUS_STYLES = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  anonymized: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  orphaned: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const METHOD_LABELS = {
  email: 'Email signup',
  google: 'Google OAuth',
  oauth: 'OAuth',
  reaccept: 'Re-accepted',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminLegalAcceptance() {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({ returned: 0, active: 0, anonymized: 0 });
  const [status, setStatus] = useState('all');
  const [emailSearch, setEmailSearch] = useState('');
  const [userIdSearch, setUserIdSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const payload = await fetchAdminLegalAcceptance({
        status,
        email: emailSearch.trim(),
        userId: userIdSearch.trim(),
        limit: 200,
      });
      setEvents(payload.events ?? []);
      setSummary(payload.summary ?? { returned: 0, active: 0, anonymized: 0 });
    } catch (error) {
      toast({
        title: 'Failed to load legal acceptance records',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const handleSearch = (event) => {
    event.preventDefault();
    load({ showSpinner: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Legal Acceptance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compliance audit log for Terms and Privacy acceptance. Records persist after account deletion.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ showSpinner: false })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-card text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Returned</span>
            <FileCheck className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{summary.returned}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Active accounts</span>
            <Shield className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{summary.active}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Anonymized</span>
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{summary.anonymized}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            placeholder="Search by email..."
            className="w-full pl-9 pr-3 py-2 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
        </div>
        <input
          value={userIdSearch}
          onChange={(e) => setUserIdSearch(e.target.value)}
          placeholder="User ID (UUID)"
          className="min-w-52 flex-1 px-3 py-2 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 font-mono"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
        >
          <option value="all">All records</option>
          <option value="active">Active accounts only</option>
          <option value="deleted">Anonymized only</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        Email search matches the one-way hash stored in the audit log. Deleted accounts show anonymized
        records without a user ID.
      </p>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
          No legal acceptance records found for this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="bg-card rounded-2xl border border-border/50 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {event.user?.email || 'Anonymized account'}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[event.status] || STATUS_STYLES.orphaned}`}
                    >
                      {event.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                      {METHOD_LABELS[event.acceptance_method] || event.acceptance_method}
                    </span>
                  </div>
                  {event.user?.full_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.user.full_name}</p>
                  )}
                  {event.user_id && (
                    <p className="text-[11px] text-muted-foreground font-mono mt-1 break-all">
                      {event.user_id}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>Accepted {formatDate(event.accepted_at)}</p>
                  {event.account_deleted_at && (
                    <p className="mt-1">Deleted {formatDate(event.account_deleted_at)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-secondary/40 border border-border/40 px-3 py-2">
                  <p className="text-muted-foreground">Terms version</p>
                  <p className="font-mono text-foreground mt-0.5">{event.terms_version}</p>
                </div>
                <div className="rounded-xl bg-secondary/40 border border-border/40 px-3 py-2">
                  <p className="text-muted-foreground">Privacy version</p>
                  <p className="font-mono text-foreground mt-0.5">{event.privacy_version}</p>
                </div>
                <div className="rounded-xl bg-secondary/40 border border-border/40 px-3 py-2">
                  <p className="text-muted-foreground">Email hash</p>
                  <p className="font-mono text-foreground mt-0.5">{event.email_hash_preview}</p>
                </div>
                <div className="rounded-xl bg-secondary/40 border border-border/40 px-3 py-2">
                  <p className="text-muted-foreground">IP hash</p>
                  <p className="font-mono text-foreground mt-0.5">
                    {event.ip_address_hash_preview || '—'}
                  </p>
                </div>
              </div>

              {event.user_agent && (
                <p className="text-[11px] text-muted-foreground break-all">
                  Browser: {event.user_agent}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}