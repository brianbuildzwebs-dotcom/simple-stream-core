import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Send, X, Trash2, ChevronUp, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { matchesSourceKey } from '@/lib/source-key';

const ACTIVE_CHAT_SOURCE_KEY = 'simple-streams-active-chat-source';

function formatViewerCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

function scopeMessages(rows, sourceKey) {
  return (rows || []).filter(
    (message) => !message.is_deleted && matchesSourceKey(message.source_key, sourceKey)
  );
}

export default function ChatOverlay({
  sourceKey = null,
  chatEpoch = 0,
  viewerCount = 0,
  isAdmin = false,
  chatEnabled = true,
  profanityFilter = false,
  embed = false,
  hideViewerBadge = false,
  dockTarget = null,
  onOpenChange,
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const activeSourceRef = useRef(sourceKey);

  const applyMessages = useCallback(
    (updater) => {
      const currentSource = activeSourceRef.current;
      if (!currentSource) {
        setMessages([]);
        return;
      }

      setMessages((prev) => {
        const scopedPrev = scopeMessages(prev, currentSource);
        const next = typeof updater === 'function' ? updater(scopedPrev) : updater;
        return scopeMessages(next, currentSource).slice(-50);
      });
    },
    []
  );

  useEffect(() => {
    activeSourceRef.current = sourceKey;

    if (!chatEnabled || !sourceKey) {
      setMessages([]);
      setInputValue('');
      setIsOpen(false);
      sessionStorage.removeItem(ACTIVE_CHAT_SOURCE_KEY);
      return undefined;
    }

    const loadGeneration = ++loadGenerationRef.current;
    const sessionStartedAt = Date.now();

    sessionStorage.setItem(ACTIVE_CHAT_SOURCE_KEY, sourceKey);
    setMessages([]);
    setInputValue('');
    setIsOpen(false);

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
      if (!matchesSourceKey(row.source_key, sourceKey)) return false;
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
            applyMessages((prev) => [...prev, payload.new]);
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
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('is_deleted', false)
        .eq('source_key', sourceKey)
        .order('created_at', { ascending: true })
        .limit(50);

      if (loadGeneration !== loadGenerationRef.current) return;
      if (sessionStorage.getItem(ACTIVE_CHAT_SOURCE_KEY) !== sourceKey) return;
      if (error) {
        console.error('Chat load failed:', error.message);
        setMessages([]);
        return;
      }

      applyMessages(scopeMessages(data, sourceKey));
    };

    loadMessages();

    return () => {
      supabase.removeChannel(channel);
      if (sessionStorage.getItem(ACTIVE_CHAT_SOURCE_KEY) === sourceKey) {
        sessionStorage.removeItem(ACTIVE_CHAT_SOURCE_KEY);
      }
    };
  }, [chatEnabled, sourceKey, chatEpoch, applyMessages]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !sourceKey) return;

    let content = inputValue.trim();
    if (profanityFilter) {
      content = content.replace(/\b\w+\b/gi, (word) =>
        /^(damn|hell|shit|fuck|ass|bitch)$/i.test(word) ? '***' : word
      );
    }

    const row = {
      source_key: sourceKey,
      user_name: 'You',
      content,
      user: 'You',
      text: content,
    };

    const { error } = await supabase.from('messages').insert([row]);
    if (error) {
      console.error('Chat send failed:', error.message);
    }
    setInputValue('');
  };

  if (!chatEnabled) {
    return null;
  }

  const visibleMessages = scopeMessages(messages, sourceKey);

  const chatBtnClass = embed
    ? 'absolute top-2 right-2 z-20 h-10 w-10 safe-area-pt safe-area-pr'
    : 'absolute top-4 right-4 z-20 w-10 h-10';

  const useDockedPanel = embed && dockTarget;
  const panelClass = useDockedPanel
    ? 'flex h-full min-h-0 flex-col bg-black/95 overflow-hidden pointer-events-auto'
    : embed
      ? 'absolute top-10 right-2 bottom-12 z-30 flex w-[min(240px,40%)] min-w-[180px] flex-col bg-black/90 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden pointer-events-auto shadow-xl'
      : 'absolute top-16 right-4 bottom-16 w-72 max-w-[calc(100%-2rem)] z-10 flex flex-col bg-black/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden pointer-events-auto';

  const tickerClass = embed
    ? 'absolute bottom-12 left-2 right-2 z-10 max-w-[calc(100%-1rem)] sm:bottom-4 sm:left-auto sm:right-3 sm:max-w-[calc(100%-2rem)]'
    : 'absolute bottom-4 right-4 z-10 max-w-[calc(100%-2rem)]';

  const renderPanel = () => (
    <motion.div
      key="chat-panel"
      initial={embed ? { opacity: 0, y: useDockedPanel ? 16 : 0, x: useDockedPanel ? 0 : 12 } : { opacity: 0, x: 20 }}
      animate={embed ? { opacity: 1, y: 0, x: 0 } : { opacity: 1, x: 0 }}
      exit={embed ? { opacity: 0, y: useDockedPanel ? 16 : 0, x: useDockedPanel ? 0 : 12 } : { opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className={panelClass}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-semibold text-white">Live Chat</span>
        <span className="text-xs text-white/40">{visibleMessages.length} messages</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2 min-h-0">
        {visibleMessages.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/50">No messages yet. Say hello!</p>
        ) : (
          visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-sm flex items-start gap-1 group ${
                (msg.user_name || msg.user) === 'You' ? 'bg-primary/10 rounded-lg px-2 py-1' : ''
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
                    await supabase.from('messages').delete().eq('id', msg.id);
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
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-2 border-t border-white/10 p-3 flex-shrink-0 safe-area-pb">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="h-10 sm:h-9 flex-1 border-white/10 bg-white/5 text-base sm:text-sm text-white placeholder:text-white/40"
        />
        <button
          type="button"
          onClick={sendMessage}
          className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 flex-shrink-0 touch-manipulation"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </div>
    </motion.div>
  );

  return (
    <>
      {!hideViewerBadge && viewerCount > 0 && (
        <div
          className={`absolute z-20 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 pointer-events-none ${
            embed ? 'top-2 left-2 safe-area-pt' : 'top-4 right-14'
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

      <AnimatePresence>
        {isOpen &&
          (useDockedPanel
            ? createPortal(renderPanel(), dockTarget)
            : renderPanel())}
      </AnimatePresence>

      {!isOpen && visibleMessages.length > 0 && (
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
}