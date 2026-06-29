import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Crown, AlertTriangle, Radio, Code2, DollarSign, FileCheck } from 'lucide-react';
import { fetchAdminStats } from '@/lib/admin-api';
import PlatformSettingsPanel from '@/components/admin/PlatformSettingsPanel';

export default function AdminOverview() {
  const [stats, setStats] = useState({
    total: 0,
    trial: 0,
    paid: 0,
    expired: 0,
    free_admin: 0,
    flagged: 0,
    streams: 0,
    embeds: 0,
    legal_acceptance_total: 0,
    legal_acceptance_active: 0,
    legal_acceptance_anonymized: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats()
      .then(setStats)
      .catch(() => setStats((s) => s))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.total, icon: Users, color: 'text-blue-400' },
    { label: 'Active Trials', value: stats.trial, icon: Crown, color: 'text-yellow-400' },
    { label: 'Paid Subscribers', value: stats.paid, icon: DollarSign, color: 'text-green-400' },
    { label: 'Trial Expired', value: stats.expired, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Stream Keys', value: stats.streams, icon: Radio, color: 'text-purple-400' },
    { label: 'Embed Players', value: stats.embeds, icon: Code2, color: 'text-cyan-400' },
    { label: 'Abuse Flags', value: stats.flagged, icon: AlertTriangle, color: 'text-orange-400' },
    { label: 'Admin Pass', value: stats.free_admin, icon: Crown, color: 'text-emerald-400' },
    {
      label: 'Legal Acceptances',
      value: stats.legal_acceptance_total,
      icon: FileCheck,
      color: 'text-sky-400',
      href: '/admin/legal',
      detail: `${stats.legal_acceptance_active} active · ${stats.legal_acceptance_anonymized} anonymized`,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Admin Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide stats</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const content = (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{card.label}</span>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              {card.detail && (
                <p className="text-[11px] text-muted-foreground mt-1">{card.detail}</p>
              )}
            </>
          );

          if (card.href) {
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link
                  to={card.href}
                  className="block bg-card rounded-2xl border border-border/50 p-4 hover:border-primary/40 transition-colors"
                >
                  {content}
                </Link>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-card rounded-2xl border border-border/50 p-4"
            >
              {content}
            </motion.div>
          );
        })}
      </div>

      <PlatformSettingsPanel />
    </div>
  );
}