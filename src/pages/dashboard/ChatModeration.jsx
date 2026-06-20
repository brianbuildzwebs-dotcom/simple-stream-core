import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, UserX, Settings2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { fetchUserEmbeds } from '@/lib/subscription';
import { fetchStreamKeys } from '@/lib/stream-keys-api';
import { buildEmbedChatOptions } from '@/lib/embed-source-key';
import { updateEmbedInstance } from '@/lib/embeds';
import ChatModerator from '@/components/chat/ChatModerator';
import OwnerBannedUsersList from '@/components/chat/OwnerBannedUsersList';
import { toast } from '@/components/ui/use-toast';

const TABS = [
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'bans', label: 'Banned viewers', icon: UserX },
  { id: 'settings', label: 'Player chat', icon: Settings2 },
];

export default function ChatModeration() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [embeds, setEmbeds] = useState([]);
  const [streamKeys, setStreamKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('messages');
  const [savingChatToggle, setSavingChatToggle] = useState(false);

  const chatOptions = useMemo(
    () => buildEmbedChatOptions(embeds, streamKeys),
    [embeds, streamKeys]
  );

  const selectedEmbedId = searchParams.get('embed') || chatOptions[0]?.embed?.id || '';
  const selected = chatOptions.find((entry) => entry.embed.id === selectedEmbedId) || chatOptions[0];

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetchUserEmbeds(user.id),
      fetchStreamKeys()
        .then((payload) => payload?.streamKeys ?? [])
        .catch(() => []),
    ])
      .then(([embedRows, keyRows]) => {
        setEmbeds(embedRows);
        setStreamKeys(keyRows);
      })
      .catch(() => {
        setEmbeds([]);
        setStreamKeys([]);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const selectEmbed = (embedId) => {
    const next = new URLSearchParams(searchParams);
    if (embedId) {
      next.set('embed', embedId);
    } else {
      next.delete('embed');
    }
    setSearchParams(next, { replace: true });
  };

  const handleChatToggle = async (enabled) => {
    if (!selected?.embed) return;
    setSavingChatToggle(true);
    try {
      const updated = await updateEmbedInstance(selected.embed.id, { chat_enabled: enabled });
      setEmbeds((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      toast({
        title: enabled ? 'Chat enabled' : 'Chat disabled',
        description: `${selected.label} ${enabled ? 'now shows' : 'no longer shows'} live chat.`,
      });
    } catch (error) {
      toast({
        title: 'Could not update chat',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingChatToggle(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold font-heading text-foreground">Chat Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage live chat on your embed players — delete, edit, ban, or turn chat off per player.
        </p>
      </motion.div>

      {chatOptions.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-3">
          <p className="text-sm text-foreground">
            Create an embed with a configured video or stream source to moderate its chat.
          </p>
          <Link
            to="/dashboard/embeds"
            className="inline-flex text-sm font-medium text-primary hover:underline"
          >
            Open Embed Manager →
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <label htmlFor="chat-embed-select" className="text-sm font-medium text-foreground">
              Player / embed
            </label>
            <select
              id="chat-embed-select"
              value={selected?.embed?.id || ''}
              onChange={(event) => selectEmbed(event.target.value)}
              className="w-full max-w-xl rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {chatOptions.map(({ embed, label }) => (
                <option key={embed.id} value={embed.id}>
                  {label}
                </option>
              ))}
            </select>
            {selected?.sourceKey && (
              <p className="text-[11px] text-muted-foreground font-mono break-all">
                Chat thread: {selected.sourceKey}
              </p>
            )}
          </div>

          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit flex-wrap">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="ownerChatModerationTab"
                      className="absolute inset-0 bg-primary rounded-md"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {activeTab === 'messages' && selected && user?.id && (
            <ChatModerator
              mode="owner"
              ownerUserId={user.id}
              sourceKey={selected.sourceKey}
              embedLabel={selected.label}
            />
          )}

          {activeTab === 'bans' && user?.id && (
            <OwnerBannedUsersList ownerUserId={user.id} sourceKey={selected?.sourceKey || null} />
          )}

          {activeTab === 'settings' && selected && (
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Player chat settings</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Controls chat on <strong className="text-foreground">{selected.label}</strong> only.
                </p>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable live chat</p>
                  <p className="text-xs text-muted-foreground">
                    Viewers can open chat on this embed. Turn off to hide chat entirely.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selected.embed.chat_enabled !== false}
                  disabled={savingChatToggle}
                  onChange={(event) => handleChatToggle(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Platform-wide profanity filtering is managed in Admin → Chat Moderation. Per-player
                bans and message edits are under Messages and Banned viewers.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}