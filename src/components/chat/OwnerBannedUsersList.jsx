import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserCheck, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OwnerBannedUsersList({ ownerUserId, sourceKey = null }) {
  const [bans, setBans] = useState([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('banned_users')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBans(
        data.filter((ban) => !sourceKey || !ban.source_key || ban.source_key === sourceKey)
      );
    }
  }, [ownerUserId, sourceKey]);

  useEffect(() => {
    if (!ownerUserId) return undefined;
    load();

    const channel = supabase
      .channel(`owner-bans-${ownerUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banned_users' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, ownerUserId]);

  const handleUnban = async (id) => {
    await supabase.from('banned_users').delete().eq('id', id);
    setBans((prev) => prev.filter((ban) => ban.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UserX className="w-5 h-5 text-destructive" />
          Banned viewers
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {bans.length} banned on {sourceKey ? 'this player' : 'your players'}
        </p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {bans.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground text-sm">No banned viewers</p>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence>
              {bans.map((ban) => (
                <motion.div
                  key={ban.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{ban.user_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ban.source_key ? 'This player only' : 'All your players'}
                    </p>
                  </div>
                  <button
                    type="button"
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