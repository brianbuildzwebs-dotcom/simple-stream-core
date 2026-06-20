import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Shield, Ban, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { cancelEnterpriseOffer, fetchAdminUsers, offerEnterpriseUpgrade } from '@/lib/admin-api';
import { needsEnterpriseOfferAttention } from '@/lib/enterprise';
import { toast } from '@/components/ui/use-toast';

const STATUS_COLORS = {
  trial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  subscribed: 'bg-green-500/10 text-green-400 border-green-500/20',
  unpaid_trial_expired: 'bg-red-500/10 text-red-400 border-red-500/20',
  free_admin: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  canceled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function AdminUsers() {
  const { user: adminUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [abuse, setAbuse] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [offerNotes, setOfferNotes] = useState({});
  const [offeringUserId, setOfferingUserId] = useState(null);

  const load = async () => {
    const [payload, tiersResult] = await Promise.all([
      fetchAdminUsers(),
      supabase.from('subscription_tiers').select('*').order('sort_order', { ascending: true }),
    ]);
    if (tiersResult.error) throw tiersResult.error;
    setRows(payload.users ?? []);
    setAbuse(payload.abuse ?? []);
    setTiers(tiersResult.data ?? []);
  };

  useEffect(() => {
    load()
      .catch((error) => toast({ title: 'Failed to load users', description: error.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const updateSub = async (sub, data) => {
    const { error } = await supabase.from('user_subscriptions').update(data).eq('id', sub.id);
    if (error) throw error;
    setRows((prev) =>
      prev.map((row) =>
        row.subscription.id === sub.id
          ? { ...row, subscription: { ...row.subscription, ...data } }
          : row
      )
    );
    toast({ title: 'User updated' });
  };

  const extendTrial = async (sub) => {
    const newEnd = new Date();
    newEnd.setDate(newEnd.getDate() + 10);
    await updateSub(sub, {
      trial_active: true,
      trial_end_date: newEnd.toISOString(),
      payment_status: 'trial',
      is_paid: false,
    });
  };

  const grantFreeAccess = async (sub) => {
    await updateSub(sub, {
      is_paid: true,
      payment_status: 'free_admin',
      payment_method: 'manual_admin',
      trial_active: false,
    });
  };

  const revokeAccess = async (sub) => {
    await updateSub(sub, {
      is_paid: false,
      payment_status: 'unpaid_trial_expired',
      trial_active: false,
    });
  };

  const markPaid = async (sub, tierId, tierName) => {
    await updateSub(sub, {
      is_paid: true,
      payment_status: 'subscribed',
      payment_method: 'manual_admin',
      billing_managed_by: 'manual',
      subscription_tier_id: tierId,
      tier_name: tierName,
      trial_active: false,
    });
  };

  const enterpriseTiers = tiers.filter(
    (tier) => tier.name === 'Enterprise' || (tier.sort_order ?? 0) >= 4
  );
  const defaultEnterpriseTier =
    enterpriseTiers.find((tier) => tier.name === 'Enterprise') || enterpriseTiers[0] || null;

  const sendEnterpriseOffer = async (row) => {
    const sub = row.subscription;
    if (sub.user_id === adminUser?.id) {
      toast({
        title: 'That is your own account',
        description: 'Offer Enterprise to customer accounts who requested an upgrade, not yourself.',
        variant: 'destructive',
      });
      return;
    }

    const tier = defaultEnterpriseTier;
    if (!tier) {
      toast({
        title: 'No Enterprise tier',
        description: 'Create an Enterprise tier in Admin → Subscriptions first.',
        variant: 'destructive',
      });
      return;
    }

    setOfferingUserId(sub.user_id);
    try {
      const result = await offerEnterpriseUpgrade({
        userId: sub.user_id,
        tierId: tier.id,
        note: offerNotes[sub.id] || '',
      });
      setRows((prev) =>
        prev.map((item) =>
          item.subscription.id === sub.id
            ? { ...item, subscription: result.subscription }
            : item
        )
      );
      toast({
        title: 'Enterprise offer sent',
        description: 'The user must accept on their Profile page.',
      });
    } catch (error) {
      toast({ title: 'Offer failed', description: error.message, variant: 'destructive' });
    } finally {
      setOfferingUserId(null);
    }
  };

  const cancelOffer = async (sub) => {
    try {
      const result = await cancelEnterpriseOffer(sub.user_id);
      setRows((prev) =>
        prev.map((row) =>
          row.subscription.id === sub.id
            ? { ...row, subscription: result.subscription }
            : row
        )
      );
      toast({ title: 'Enterprise offer canceled' });
    } catch (error) {
      toast({ title: 'Cancel failed', description: error.message, variant: 'destructive' });
    }
  };

  const isFlagged = (row) => {
    const email = row.profile?.email;
    return abuse.some(
      (item) => item.registration_count > 1 && email && item.email_list?.includes(email)
    );
  };

  const enterpriseRequestRows = rows.filter((row) =>
    needsEnterpriseOfferAttention(row.subscription)
  );

  const filtered = rows
    .filter((row) => {
      const { profile, subscription } = row;
      const matchSearch =
        !search ||
        profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
        profile?.full_name?.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === 'all'
          ? true
          : filter === 'enterprise_requests'
            ? needsEnterpriseOfferAttention(subscription)
            : subscription.payment_status === filter;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const aNeeds = needsEnterpriseOfferAttention(a.subscription) ? 1 : 0;
      const bNeeds = needsEnterpriseOfferAttention(b.subscription) ? 1 : 0;
      return bNeeds - aNeeds;
    });

  const focusUser = (subId) => {
    setFilter('enterprise_requests');
    setExpandedId(subId);
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
        <h1 className="text-2xl font-bold font-heading text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rows.length} total users
          {enterpriseRequestRows.length > 0
            ? ` · ${enterpriseRequestRows.length} Enterprise request${enterpriseRequestRows.length === 1 ? '' : 's'} waiting`
            : ''}
        </p>
      </div>

      {enterpriseRequestRows.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Enterprise upgrade requests</p>
          <p className="text-xs text-muted-foreground">
            These users clicked <strong className="text-foreground">Request Enterprise upgrade</strong>{' '}
            in the app. Send the offer only to them — approval happens on their Profile (no email).
          </p>
          <div className="flex flex-wrap gap-2">
            {enterpriseRequestRows.map((row) => (
              <button
                key={row.subscription.id}
                type="button"
                onClick={() => focusUser(row.subscription.id)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-100 border border-amber-500/30 text-xs font-medium hover:bg-amber-500/30 transition-colors"
              >
                {row.profile?.email || 'Unknown user'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full pl-9 pr-3 py-2 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
        >
          <option value="all">All Status</option>
          <option value="trial">Trial</option>
          <option value="subscribed">Subscribed</option>
          <option value="unpaid_trial_expired">Expired</option>
          <option value="free_admin">Free (Admin)</option>
          <option value="enterprise_requests">Enterprise requests</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((row) => {
          const { profile, subscription: sub } = row;
          const flagged = isFlagged(row);
          const daysLeft = sub.trial_end_date
            ? Math.ceil((new Date(sub.trial_end_date) - Date.now()) / 86400000)
            : null;
          const expanded = expandedId === sub.id;
          const enterpriseRequested = needsEnterpriseOfferAttention(sub);
          const isSelf = sub.user_id === adminUser?.id;
          const showEnterprisePanel =
            sub.enterprise_offer_tier_id || sub.enterprise_requested_at;

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`bg-card rounded-2xl border overflow-hidden ${
                enterpriseRequested
                  ? 'border-amber-500/50 ring-1 ring-amber-500/20'
                  : 'border-border/50'
              }`}
            >
              <div className="p-4 flex items-center gap-3 flex-wrap">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {profile?.full_name?.[0] || profile?.email?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {profile?.full_name || 'Unknown'}
                    </p>
                    {flagged && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        Flagged
                      </span>
                    )}
                    {profile?.role === 'admin' && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {sub.payment_status && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        STATUS_COLORS[sub.payment_status] || ''
                      }`}
                    >
                      {sub.payment_status.replace(/_/g, ' ')}
                      {sub.trial_active && daysLeft !== null ? ` (${daysLeft}d)` : ''}
                    </span>
                  )}
                  {sub.tier_name && (
                    <span className="text-xs text-muted-foreground">{sub.tier_name}</span>
                  )}
                  {enterpriseRequested && !sub.enterprise_offer_tier_id && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Requested Enterprise
                    </span>
                  )}
                  {sub.enterprise_offer_tier_id && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Offer sent — waiting on Profile
                    </span>
                  )}
                  {sub.billing_managed_by === 'manual' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      Manual billing
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : sub.id)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-border/50 p-4 space-y-3">
                  <div className="text-xs text-muted-foreground space-y-1">
                    {sub.trial_end_date && (
                      <p>Trial ends: {new Date(sub.trial_end_date).toLocaleDateString()}</p>
                    )}
                    {sub.admin_notes && <p>Notes: {sub.admin_notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => extendTrial(sub).catch((e) => toast({ title: e.message, variant: 'destructive' }))}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
                    >
                      10 Day Trial
                    </button>
                    <button
                      type="button"
                      onClick={() => grantFreeAccess(sub).catch((e) => toast({ title: e.message, variant: 'destructive' }))}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      <Shield className="w-3 h-3 inline mr-1" />
                      Grant Free Access
                    </button>
                    {tiers
                      .filter((tier) => tier.name !== 'Enterprise' && (tier.sort_order ?? 0) < 4)
                      .map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() =>
                            markPaid(sub, tier.id, tier.name).catch((e) =>
                              toast({ title: e.message, variant: 'destructive' })
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          Set {tier.name}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => revokeAccess(sub).catch((e) => toast({ title: e.message, variant: 'destructive' }))}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors"
                    >
                      <Ban className="w-3 h-3 inline mr-1" />
                      Revoke Access
                    </button>
                  </div>
                  {showEnterprisePanel ? (
                    <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">Enterprise upgrade</p>
                      <p className="text-[11px] text-muted-foreground">
                        Offering to:{' '}
                        <strong className="text-foreground">{profile?.email || 'Unknown'}</strong>
                        {isSelf && (
                          <span className="block mt-1 text-red-300">
                            This is your admin account — offer Enterprise to customer accounts only.
                          </span>
                        )}
                      </p>
                      {sub.enterprise_request_note && (
                        <p className="text-[11px] text-amber-100/80 rounded-lg bg-black/20 px-2 py-1.5">
                          User note: {sub.enterprise_request_note}
                        </p>
                      )}
                      {sub.enterprise_requested_at && !sub.enterprise_offer_tier_id && (
                        <p className="text-[11px] text-muted-foreground">
                          Requested {new Date(sub.enterprise_requested_at).toLocaleString()}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        User accepts on Profile — no email is sent.
                      </p>
                      {sub.enterprise_offer_tier_id ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs text-amber-300">Waiting for user on Profile</span>
                          <button
                            type="button"
                            onClick={() => cancelOffer(sub)}
                            className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                          >
                            Cancel offer
                          </button>
                        </div>
                      ) : enterpriseRequested ? (
                        <>
                          <textarea
                            value={offerNotes[sub.id] || ''}
                            onChange={(e) =>
                              setOfferNotes((prev) => ({ ...prev, [sub.id]: e.target.value }))
                            }
                            placeholder="Optional note for the user (pricing, key limit, invoice details)..."
                            rows={2}
                            className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                          />
                          <button
                            type="button"
                            onClick={() => sendEnterpriseOffer({ subscription: sub, profile })}
                            disabled={
                              offeringUserId === sub.user_id || !defaultEnterpriseTier || isSelf
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-200 border border-amber-500/20 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                          >
                            {offeringUserId === sub.user_id
                              ? 'Sending…'
                              : `Send offer to ${profile?.email || 'user'}`}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      No Enterprise request from this user yet. They must click{' '}
                      <strong className="text-foreground">Request Enterprise upgrade</strong> on
                      Stream Keys first.
                    </p>
                  )}
                  <AdminNotes
                    sub={sub}
                    onSave={(notes) =>
                      updateSub(sub, { admin_notes: notes }).catch((e) =>
                        toast({ title: e.message, variant: 'destructive' })
                      )
                    }
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AdminNotes({ sub, onSave }) {
  const [notes, setNotes] = useState(sub.admin_notes || '');
  const [saved, setSaved] = useState(false);

  const save = () => {
    onSave(notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex gap-2">
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add admin note..."
        className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
      />
      <button
        type="button"
        onClick={save}
        className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}