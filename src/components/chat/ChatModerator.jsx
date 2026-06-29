import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trash2,
  UserX,
  RefreshCw,
  Pencil,
  Check,
  X,
  Eraser,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui/use-toast';

function banAppliesToThread(ban, sourceKey) {
  if (!ban.source_key) return true;
  return ban.source_key === sourceKey;
}

export default function ChatModerator({
  mode = 'admin',
  ownerUserId = null,
  sourceKey = null,
  embedLabel = null,
}) {
  const [messages, setMessages] = useState([]);
  const [bannedNames, setBannedNames] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [clearing, setClearing] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const isOwnerMode = mode === 'owner' && ownerUserId;

  const load = useCallback(async () => {
    let messageQuery = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (isOwnerMode) {
      messageQuery = messageQuery.eq('owner_user_id', ownerUserId);
      if (sourceKey) {
        messageQuery = messageQuery.eq('source_key', sourceKey);
      }
    }

    let banQuery = supabase.from('banned_users').select('*').order('created_at', { ascending: false });

    if (isOwnerMode) {
      banQuery = banQuery.eq('owner_user_id', ownerUserId);
    } else {
      banQuery = banQuery.is('owner_user_id', null);
    }

    const [msgsResult, bansResult] = await Promise.all([messageQuery, banQuery]);

    if (!msgsResult.error && msgsResult.data) setMessages(msgsResult.data);
    if (!bansResult.error && bansResult.data) {
      const names = bansResult.data
        .filter((ban) => !sourceKey || banAppliesToThread(ban, sourceKey))
        .map((ban) => ban.user_name);
      setBannedNames(new Set(names));
    }
  }, [isOwnerMode, ownerUserId, sourceKey]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`chat-moderator-${mode}-${ownerUserId || 'admin'}-${sourceKey || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banned_users' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, mode, ownerUserId, sourceKey]);

  const markDeleted = async (ids) => {
    const results = await Promise.all(
      ids.map((id) => supabase.from('messages').update({ is_deleted: true }).eq('id', id))
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      toast({
        title: 'Could not delete message',
        description: failed.error.message,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleDelete = async (id) => {
    const ok = await markDeleted([id]);
    if (!ok) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_deleted: true } : m))
    );
  };

  const handleRestore = async (id) => {
    const { error } = await supabase.from('messages').update({ is_deleted: false }).eq('id', id);
    if (error) {
      toast({
        title: 'Could not restore message',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_deleted: false } : m)));
  };

  const startEdit = (message) => {
    setEditingId(message.id);
    setEditContent(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (id) => {
    const content = editContent.trim();
    if (!content) return;
    await supabase.from('messages').update({ content }).eq('id', id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
    cancelEdit();
  };

  const handleBan = async (userName) => {
    if (bannedNames.has(userName)) return;

    const row = isOwnerMode
      ? { user_name: userName, owner_user_id: ownerUserId, source_key: sourceKey || null }
      : { user_name: userName };

    await supabase.from('banned_users').insert(row);
    setBannedNames((prev) => new Set([...prev, userName]));

    const userMsgs = messages.filter(
      (m) => m.user_name === userName && !m.is_deleted && (!sourceKey || m.source_key === sourceKey)
    );
    const ids = userMsgs.map((m) => m.id);
    const ok = await markDeleted(ids);
    if (!ok) return;
    setMessages((prev) =>
      prev.map((m) =>
        ids.includes(m.id) ? { ...m, is_deleted: true } : m
      )
    );
  };

  const handleClearChat = async () => {
    if (!sourceKey) return;
    const label = embedLabel || 'this player';
    if (
      !window.confirm(
        `Clear all active chat messages for ${label}? They will disappear from live chat and this list.`
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const activeIds = messages
        .filter((m) => !m.is_deleted && m.source_key === sourceKey)
        .map((m) => m.id);

      const ok = await markDeleted(activeIds);
      if (!ok) return;
      setMessages((prev) =>
        prev.map((m) => (activeIds.includes(m.id) ? { ...m, is_deleted: true } : m))
      );
    } finally {
      setClearing(false);
    }
  };

  const active = messages.filter((m) => !m.is_deleted);
  const deleted = messages.filter((m) => m.is_deleted);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Live Chat</h2>
          <p className="text-xs text-muted-foreground">
            {embedLabel ? `${embedLabel} · ` : ''}
            {active.length} message{active.length === 1 ? '' : 's'}
            {deleted.length > 0 ? ` · ${deleted.length} deleted` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {deleted.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleted((value) => !value)}
              className="text-xs"
            >
              {showDeleted ? 'Hide deleted' : `Show deleted (${deleted.length})`}
            </Button>
          )}
          {isOwnerMode && sourceKey && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={clearing || active.length === 0}
              className="gap-2"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear chat
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {active.length === 0 && (!showDeleted || deleted.length === 0) ? (
          <p className="p-8 text-center text-muted-foreground text-sm">
            {sourceKey ? 'No messages for this player yet.' : 'No messages yet.'}
          </p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            <AnimatePresence>
              {[...(showDeleted ? deleted : []), ...active].map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary/20 group transition-colors ${
                    msg.is_deleted ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: msg.user_color || '#60a5fa' }}
                      >
                        {msg.user_name}
                      </span>
                      {msg.is_deleted && (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                          deleted
                        </span>
                      )}
                      {msg.is_simulated && (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                          simulated
                        </span>
                      )}
                      {bannedNames.has(msg.user_name) && (
                        <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                          banned
                        </span>
                      )}
                    </div>
                    {editingId === msg.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={editContent}
                          onChange={(event) => setEditContent(event.target.value)}
                          className="h-8 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(msg.id)}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary"
                          title="Save edit"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
                          title="Cancel edit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/80">{msg.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {!msg.is_deleted ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(msg)}
                          title="Edit message"
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          title="Delete message"
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {!bannedNames.has(msg.user_name) && (
                          <button
                            type="button"
                            onClick={() => handleBan(msg.user_name)}
                            title="Ban user"
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestore(msg.id)}
                        title="Restore message"
                        className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors text-xs"
                      >
                        Restore
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