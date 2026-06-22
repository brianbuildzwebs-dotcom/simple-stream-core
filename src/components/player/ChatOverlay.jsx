import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, X, Trash2, ChevronUp, Users, HandHeart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { matchesSourceKey } from '@/lib/source-key';
import {
  CHAT_DISPLAY_NAME_MAX,
  isValidChatDisplayName,
  loadChatDisplayName,
  normalizeChatDisplayName,
  saveChatDisplayName,
} from '@/lib/chat-display-name';

const ACTIVE_CHAT_SOURCE_KEY = 'simple-streams-active-chat-source';

function formatViewerCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

function scopeMessages(rows, sourceKey, legacySourceKey = null) {
  return (rows || []).filter(
    (message) =>
      !message.is_deleted && matchesSourceKey(message.source_key, sourceKey, legacySourceKey)
  );
}

function appendUniqueMessage(prev, message) {
  if (!message?.id) return prev;
  if (prev.some((row) => row.id === message.id)) return prev;
  return [...prev, message];
}

export default function ChatOverlay({
  sourceKey = null,
  legacySourceKey = null,
  chatEpoch = 0,
  viewerCount = 0,
  isAdmin = false,
  chatOwnerId = null,
  embedId = null,
  chatEnabled = true,
  profanityFilter = false,
  embed = false,
  hideViewerBadge = false,
  giveEnabled = false,
  giveUrl = null,
  giveLabel = 'Give',
  dockLayout = false,
  renderDockLayout,
  open: controlledOpen,
  onOpenChange,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setIsOpen = useCallback(
    (value) => {
      const next = typeof value === 'function' ? value(isOpen) : value;
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, isOpen, onOpenChange]
  );

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [displayName, setDisplayName] = useState(() => loadChatDisplayName());
  const [nameDraft, setNameDraft] = useState(() => loadChatDisplayName());
  const [nameError, setNameError] = useState('');
  const [editingName, setEditingName] = useState(() => !loadChatDisplayName());
  const [bannedUsers, setBannedUsers] = useState([]);
  const [sendBlocked, setSendBlocked] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesScrollRef = useRef(null);
  const sendingRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const activeSourceRef = useRef(sourceKey);
  const activeLegacySourceRef = useRef(legacySourceKey);

  const applyMessages = useCallback(
    (updater) => {
      const currentSource = activeSourceRef.current;
      const currentLegacySource = activeLegacySourceRef.current;
      if (!currentSource) {
        setMessages([]);
        return;
      }

      setMessages((prev) => {
        const scopedPrev = scopeMessages(prev, currentSource, currentLegacySource);
        const next = typeof updater === 'function' ? updater(scopedPrev) : updater;
        return scopeMessages(next, currentSource, currentLegacySource).slice(-50);
      });
    },
    []
  );

  useEffect(() => {
    activeSourceRef.current = sourceKey;
    activeLegacySourceRef.current = legacySourceKey;

    if (!chatEnabled || !sourceKey) {
      setMessages([]);
      setInputValue('');
      if (!isControlled) {
        setUncontrolledOpen(false);
      }
      onOpenChange?.(false);
      sessionStorage.removeItem(ACTIVE_CHAT_SOURCE_KEY);
      return undefined;
    }

    const loadGeneration = ++loadGenerationRef.current;
    const sessionStartedAt = Date.now();

    sessionStorage.setItem(ACTIVE_CHAT_SOURCE_KEY, sourceKey);
    setMessages([]);
    setInputValue('');
    if (!isControlled) {
      setUncontrolledOpen(false);
    }
    onOpenChange?.(false);

    for (const existing of supabase.getChannels()) {
      const topic = existing.topic || '';
      if (topic.includes(':chat-')) {
        supabase.removeChannel(existing);
      }
    }

    const isActiveEvent = (row) => {
      if (!row) return false;
      if (sessionStorage.getItem(ACTIVE_CHAT_SOURCE_KEY) !== sourceKey) return false;
      if (activeSourceRef.current !== sourceKey) return false;
      if (!matchesSourceKey(row.source_key, sourceKey, legacySourceKey)) return false;
      if (row.created_at) {
        const createdAt = new Date(row.created_at).getTime();
        if (Number.isFinite(createdAt) && createdAt < sessionStartedAt - 2000) {
          return false;
        }
      }
      return true;
    };

    const channel = supabase
      .channel(`chat-${chatEpoch}-${encodeURIComponent(sourceKey)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (sessionStorage.getItem(ACTIVE_CHAT_SOURCE_KEY) !== sourceKey) return;

          if (payload.eventType === 'INSERT') {
            if (!isActiveEvent(payload.new)) return;
            applyMessages((prev) => appendUniqueMessage(prev, payload.new));
            return;
          }

          if (payload.eventType === 'UPDATE') {
            applyMessages((prev) => {
              const without = prev.filter((message) => message.id !== payload.new.id);
              if (payload.new.is_deleted || !isActiveEvent(payload.new)) return without;
              return [...without, payload.new].sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
              );
            });
            return;
          }

          if (payload.eventType === 'DELETE') {
            applyMessages((prev) => prev.filter((message) => message.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const loadMessages = async () => {
      const sourceKeys = [sourceKey];
      if (legacySourceKey && legacySourceKey !== sourceKey) {
        sourceKeys.push(legacySourceKey);
      }

      let query = supabase
        .from('messages')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(50);

      query =
        sourceKeys.length === 1
          ? query.eq('source_key', sourceKeys[0])
          : query.in('source_key', sourceKeys);

      const { data, error } = await query;

      if (loadGeneration !== loadGenerationRef.current) return;
      if (sessionStorage.getItem(ACTIVE_CHAT_SOURCE_KEY) !== sourceKey) return;
      if (error) {
        console.error('Chat load failed:', error.message);
        setMessages([]);
        return;
      }

      applyMessages(scopeMessages(data, sourceKey, legacySourceKey));
    };

    loadMessages();

    return () => {
      supabase.removeChannel(channel);
      if (sessionStorage.getItem(ACTIVE_CHAT_SOURCE_KEY) === sourceKey) {
        sessionStorage.removeItem(ACTIVE_CHAT_SOURCE_KEY);
      }
    };
  }, [chatEnabled, sourceKey, legacySourceKey, chatEpoch, applyMessages, isControlled, onOpenChange]);

  useEffect(() => {
    if (!chatOwnerId) {
      setBannedUsers([]);
      return undefined;
    }

    const loadBans = async () => {
      const { data, error } = await supabase
        .from('banned_users')
        .select('user_name, source_key, owner_user_id')
        .or(`owner_user_id.is.null,owner_user_id.eq.${chatOwnerId}`);

      if (!error) {
        setBannedUsers(data || []);
      }
    };

    loadBans();

    const channel = supabase
      .channel(`chat-bans-${chatOwnerId}-${sourceKey || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banned_users' }, () => loadBans())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatOwnerId, sourceKey]);

  const scrollMessagesToEnd = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollMessagesToEnd();
    }
  }, [messages, isOpen, scrollMessagesToEnd]);

  const isUserBanned = (userName) =>
    bannedUsers.some(
      (ban) =>
        ban.user_name === userName &&
        (!ban.owner_user_id || ban.owner_user_id === chatOwnerId) &&
        (!ban.source_key || ban.source_key === sourceKey)
    );

  const commitDisplayName = useCallback(() => {
    const next = normalizeChatDisplayName(nameDraft);
    if (!isValidChatDisplayName(next)) {
      setNameError(`Enter a name with at least 2 characters (max ${CHAT_DISPLAY_NAME_MAX}).`);
      return false;
    }
    if (isUserBanned(next)) {
      setNameError('That display name is banned from this chat.');
      return false;
    }
    const saved = saveChatDisplayName(next);
    setDisplayName(saved);
    setNameDraft(saved);
    setNameError('');
    setEditingName(false);
    return true;
  }, [nameDraft, bannedUsers, chatOwnerId, sourceKey]);

  const handleNameSubmit = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      commitDisplayName();
    },
    [commitDisplayName]
  );

  const sendMessage = useCallback(async () => {
    if (sendingRef.current || !inputValue.trim()) return;
    if (!sourceKey) {
      setSendError('Chat is still loading. Wait a moment and try again.');
      return;
    }
    if (!isValidChatDisplayName(displayName)) {
      setEditingName(true);
      setNameError('Choose a display name before sending a message.');
      return;
    }
    sendingRef.current = true;
    setSendError('');

    if (isUserBanned(displayName)) {
      setSendBlocked(true);
      sendingRef.current = false;
      return;
    }

    let content = inputValue.trim();
    if (profanityFilter) {
      content = content.replace(/\b\w+\b/gi, (word) =>
        /^(damn|hell|shit|fuck|ass|bitch)$/i.test(word) ? '***' : word
      );
    }

    const row = {
      source_key: sourceKey,
      user_name: displayName,
      content,
      ...(chatOwnerId ? { owner_user_id: chatOwnerId } : {}),
      ...(embedId ? { embed_id: embedId } : {}),
    };

    let { data, error } = await supabase.from('messages').insert([row]).select().single();

    if (error && (chatOwnerId || embedId)) {
      const fallback = {
        source_key: sourceKey,
        user_name: displayName,
        content,
      };
      ({ data, error } = await supabase.from('messages').insert([fallback]).select().single());
    }

    if (error) {
      console.error('Chat send failed:', error.message);
      setSendError('Message did not send. Tap send again or press Enter.');
      setSendBlocked(false);
      sendingRef.current = false;
      return;
    }

    if (data) {
      applyMessages((prev) => appendUniqueMessage(prev, data));
    }

    setInputValue('');
    setSendBlocked(false);
    sendingRef.current = false;
  }, [
    inputValue,
    displayName,
    sourceKey,
    chatOwnerId,
    embedId,
    profanityFilter,
    applyMessages,
    bannedUsers,
  ]);

  const handleComposerSubmit = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      void sendMessage();
    },
    [sendMessage]
  );

  if (!chatEnabled) {
    return null;
  }

  const visibleMessages = scopeMessages(messages, sourceKey, legacySourceKey);

  const chatBtnClass = embed
    ? 'absolute top-4 right-4 z-20 h-10 w-10 safe-area-pt safe-area-pr'
    : 'absolute top-4 right-4 z-20 w-10 h-10';

  const useDockedPanel = embed && dockLayout;
  const panelClass = useDockedPanel
    ? 'flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/95 pointer-events-auto'
    : embed
      ? 'absolute top-10 right-2 bottom-12 z-30 flex w-[min(280px,42%)] min-w-[200px] flex-col bg-black/90 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden pointer-events-auto shadow-xl'
      : 'absolute top-16 right-4 bottom-16 w-72 max-w-[calc(100%-2rem)] z-10 flex flex-col bg-black/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden pointer-events-auto';

  const tickerClass = embed
    ? 'absolute bottom-12 left-2 right-2 z-10 max-w-[calc(100%-1rem)] sm:bottom-4 sm:left-auto sm:right-3 sm:max-w-[calc(100%-2rem)]'
    : 'absolute bottom-4 right-4 z-10 max-w-[calc(100%-2rem)]';

  const renderPanel = () => {
    const PanelWrapper = useDockedPanel ? 'div' : motion.div;
    const motionProps = useDockedPanel
      ? {}
      : {
          key: 'chat-panel',
          initial: embed ? { opacity: 0, y: 0, x: 12 } : { opacity: 0, x: 20 },
          animate: embed ? { opacity: 1, y: 0, x: 0 } : { opacity: 1, x: 0 },
          exit: embed ? { opacity: 0, y: 0, x: 12 } : { opacity: 0, x: 20 },
          transition: { duration: 0.25 },
        };

    return (
    <PanelWrapper
      {...motionProps}
      className={panelClass}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
        <span className="text-sm font-semibold text-white shrink-0">Live Chat</span>
        <div className="flex items-center gap-2 min-w-0">
          {giveEnabled && giveUrl && (
            <a
              href={giveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 border border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/30 transition-colors touch-manipulation shrink-0"
              aria-label={giveLabel || 'Give'}
            >
              <HandHeart className="w-3.5 h-3.5" />
              <span>{giveLabel || 'Give'}</span>
            </a>
          )}
          <span className="text-xs text-white/40 whitespace-nowrap">
            {visibleMessages.length} messages
          </span>
        </div>
      </div>

      <div
        ref={messagesScrollRef}
        className="relative z-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2 min-h-0"
      >
        {visibleMessages.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/50">No messages yet. Say hello!</p>
        ) : (
          visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-sm flex items-start gap-1 group ${
                (msg.user_name || msg.user) === displayName ? 'bg-primary/10 rounded-lg px-2 py-1' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-primary">
                  {msg.user_name || msg.user || 'User'}
                </span>
                <span className="text-white/70 ml-1.5 break-words">
                  {msg.content || msg.text}
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.from('messages').update({ is_deleted: true }).eq('id', msg.id);
                  }}
                  className="flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all mt-0.5 touch-manipulation"
                  aria-label="Delete message"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>

      {editingName || !isValidChatDisplayName(displayName) ? (
        <form
          onSubmit={handleNameSubmit}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className="relative z-50 shrink-0 border-t border-white/10 bg-card/95 p-3 safe-area-pb pointer-events-auto touch-manipulation"
        >
          <p className="mb-2 text-xs font-medium text-white/80">Choose a display name</p>
          {nameError && (
            <p className="mb-2 text-[11px] text-amber-300">{nameError}</p>
          )}
          <div className="flex gap-2">
            <Input
              value={nameDraft}
              onChange={(e) => {
                setNameDraft(e.target.value);
                if (nameError) setNameError('');
              }}
              maxLength={CHAT_DISPLAY_NAME_MAX}
              autoComplete="nickname"
              enterKeyHint="done"
              placeholder="Your name"
              className="h-11 min-w-0 flex-1 border-white/10 bg-white/5 text-base sm:h-10 sm:text-sm text-white placeholder:text-white/40"
            />
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 touch-manipulation cursor-pointer sm:h-10"
            >
              Join
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleComposerSubmit}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className="relative z-50 shrink-0 border-t border-white/10 bg-card/95 p-3 safe-area-pb pointer-events-auto touch-manipulation"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-white/50">
            <span>
              Posting as{' '}
              <span className="font-medium text-primary">{displayName}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setNameDraft(displayName);
                setEditingName(true);
                setNameError('');
              }}
              className="shrink-0 text-white/60 underline-offset-2 hover:text-white hover:underline touch-manipulation"
            >
              Change
            </button>
          </div>
          {sendBlocked && (
            <p className="mb-2 text-[11px] text-red-300">
              You are banned from this chat.
            </p>
          )}
          {sendError && !sendBlocked && (
            <p className="mb-2 text-[11px] text-amber-300">
              {sendError}
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (sendError) setSendError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              enterKeyHint="send"
              autoComplete="off"
              placeholder="Type a message..."
              className="h-11 min-w-0 flex-1 border-white/10 bg-white/5 text-base sm:h-10 sm:text-sm text-white placeholder:text-white/40"
            />
            <button
              type="submit"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 touch-manipulation cursor-pointer sm:h-10 sm:w-10"
              aria-label="Send message"
            >
              <Send size={16} className="pointer-events-none" />
            </button>
          </div>
        </form>
      )}
    </PanelWrapper>
    );
  };

  const chatChrome = (
    <>
      {!hideViewerBadge && viewerCount > 0 && (
        <div
          className={`absolute z-20 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 pointer-events-none ${
            embed ? 'top-4 left-4 safe-area-pt' : 'top-4 right-14'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90">
            {formatViewerCount(viewerCount)} watching
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`${chatBtnClass} rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all touch-manipulation`}
        aria-label={isOpen ? 'Hide chat' : 'Show chat'}
      >
        {isOpen ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
      </button>

      {!useDockedPanel && (
        <AnimatePresence>
          {isOpen && renderPanel()}
        </AnimatePresence>
      )}

      {!isOpen && visibleMessages.length > 0 && !useDockedPanel && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`${tickerClass} flex items-center gap-2 px-3 py-2.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-xs text-white/80 hover:bg-black/70 transition-all pointer-events-auto touch-manipulation`}
        >
          <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            Latest:{' '}
            <span className="text-white/60">
              {visibleMessages.at(-1)?.user_name || visibleMessages.at(-1)?.user}:
            </span>{' '}
            {visibleMessages.at(-1)?.content || visibleMessages.at(-1)?.text}
          </span>
        </button>
      )}
    </>
  );

  if (useDockedPanel && renderDockLayout) {
    return renderDockLayout({
      chrome: chatChrome,
      dockPanel: isOpen ? renderPanel() : null,
    });
  }

  return chatChrome;
}