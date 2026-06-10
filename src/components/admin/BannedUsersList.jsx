import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { UserCheck, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BannedUsersList() {
  const [bans, setBans] = useState([]);

  const load = async () => {
    const list = await base44.entities.BannedUser.list();
    setBans(list);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.BannedUser.subscribe(() => load());
    return () => unsub();
  }, []);

  const handleUnban = async (id) => {
    await base44.entities.BannedUser.delete(id);
    setBans(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UserX className="w-5 h-5 text-destructive" />
          Banned Users
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{bans.length} user{bans.length !== 1 ? 's' : ''} banned</p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {bans.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground text-sm">No banned users</p>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence>
              {bans.map(ban => (
                <motion.div
                  key={ban.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{ban.user_name}</p>
                    {ban.reason && <p className="text-xs text-muted-foreground">{ban.reason}</p>}
                  </div>
                  <button
                    onClick={() => handleUnban(ban.id)}
                    className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-green-400/10"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Unban
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}