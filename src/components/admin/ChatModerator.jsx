import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, UserX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatModerator() {
  const [messages, setMessages] = useState([]);
  const [bannedNames, setBannedNames] = useState(new Set());

  const load = async () => {
    const [msgs, bans] = await Promise.all([
      base44.entities.ChatMessage.list('-created_date', 100),
      base44.entities.BannedUser.list(),
    ]);
    setMessages(msgs);
    setBannedNames(new Set(bans.map(b => b.user_name)));
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.ChatMessage.subscribe(() => load());
    return () => unsub();
  }, []);

  const handleDelete = async (id) => {
    await base44.entities.ChatMessage.update(id, { is_deleted: true });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: true } : m));
  };

  const handleBan = async (userName) => {
    if (bannedNames.has(userName)) return;
    await base44.entities.BannedUser.create({ user_name: userName });
    setBannedNames(prev => new Set([...prev, userName]));
    const userMsgs = messages.filter(m => m.user_name === userName && !m.is_deleted);
    await Promise.all(userMsgs.map(m => base44.entities.ChatMessage.update(m.id, { is_deleted: true })));
    setMessages(prev => prev.map(m => m.user_name === userName ? { ...m, is_deleted: true } : m));
  };

  const active = messages.filter(m => !m.is_deleted);
  const deleted = messages.filter(m => m.is_deleted);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Live Chat</h2>
          <p className="text-xs text-muted-foreground">{active.length} active · {deleted.length} deleted</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {active.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground text-sm">No active messages</p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            <AnimatePresence>
              {active.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/20 group transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: msg.user_color || '#60a5fa' }}>
                        {msg.user_name}
                      </span>
                      {msg.is_simulated && (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">simulated</span>
                      )}
                      {bannedNames.has(msg.user_name) && (
                        <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">banned</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80">{msg.content}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => handleDelete(msg.id)}
                      title="Delete message"
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {!bannedNames.has(msg.user_name) && (
                      <button
                        onClick={() => handleBan(msg.user_name)}
                        title="Ban user"
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}