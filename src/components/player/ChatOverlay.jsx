import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Trash2, ChevronUp, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

function formatViewerCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

export default function ChatOverlay({
  sourceKey = null,
  viewerCount = 0,
  isAdmin = false,
  chatEnabled = true,
  profanityFilter = false,
  embed = false,
  hideViewerBadge = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!chatEnabled || !sourceKey) return undefined;

    setMessages([]);
    setInputValue('');

    const belongsToSource = (row) => row?.source_key === sourceKey;

    const channel = supabase
      .channel(`chat-messages:${sourceKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `source_key=eq.${sourceKey}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (!belongsToSource(payload.new)) return;
            setMessages((prev) => [...prev.slice(-49), payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            if (!belongsToSource(payload.new)) {
              setMessages((prev) => prev.filter((m) => m.id !== payload.new.id));
              return;
            }
            setMessages((prev) =>
              payload.new.is_deleted
                ? prev.filter((m) => m.id !== payload.new.id)
                : prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('is_deleted', false)
        .eq('source_key', sourceKey)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) setMessages(data);
    };

    loadMessages();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatEnabled, sourceKey]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    let content = inputValue.trim();
    if (profanityFilter) {
      content = content.replace(/\b\w+\b/gi, (word) =>
        /^(damn|hell|shit|fuck|ass|bitch)$/i.test(word) ? '***' : word
      );
    }

    if (!sourceKey) return;

    const row = {
      source_key: sourceKey,
      user_name: 'You',
      content,
      // Legacy schemas used `user` + `text` (both NOT NULL) before migrations 00004.
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

  const visibleMessages = messages.filter((m) => !m.is_deleted);
  const chatBtnClass = embed
    ? 'absolute top-3 right-3 z-20 w-11 h-11 sm:w-10 sm:h-10'
    : 'absolute top-4 right-4 z-20 w-10 h-10';

  const panelClass = embed
    ? 'absolute inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-14 sm:right-3 sm:left-auto z-30 flex flex-col bg-black/85 backdrop-blur-md rounded-t-2xl sm:rounded-xl border border-white/10 overflow-hidden pointer-events-auto max-h-[50vh] sm:max-h-none sm:w-80 sm:max-w-[calc(100%-1.5rem)] sm:h-[min(320px,calc(100%-5rem))]'
    : 'absolute top-16 right-4 bottom-16 w-72 max-w-[calc(100%-2rem)] z-10 flex flex-col bg-black/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden pointer-events-auto';

  const tickerClass = embed
    ? 'absolute bottom-16 sm:bottom-4 right-3 left-3 sm:left-auto z-10 max-w-none sm:max-w-[calc(100%-2rem)]'
    : 'absolute bottom-4 right-4 z-10 max-w-[calc(100%-2rem)]';

  return (
    <>
      {!hideViewerBadge && viewerCount > 0 && (
        <div
          className={`absolute z-20 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 pointer-events-none ${
            embed ? 'top-3 right-14' : 'top-4 right-14'
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
        {isOpen && (
          <motion.div
            initial={embed ? { opacity: 0, y: 40 } : { opacity: 0, x: 20 }}
            animate={embed ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
            exit={embed ? { opacity: 0, y: 40 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
            className={panelClass}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-semibold text-white">Live Chat</span>
              <span className="text-xs text-white/40">{visibleMessages.length} messages</span>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2 min-h-[120px] sm:min-h-0">
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
        )}
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