import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Users, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function ChatOverlay({
  viewerCount,
  isAdmin = false,
  chatEnabled = true,
  profanityFilter = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!chatEnabled) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
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
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) setMessages(data);
    };

    loadMessages();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatEnabled]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    await supabase.from('messages').insert([{
      user_name: 'You',
      content: inputValue.trim(),
    }]);
    setInputValue('');
  };

  if (!chatEnabled) return null;

  return (
    <div
      className="absolute top-3 right-3 z-30 flex w-72 max-w-[calc(100%-1.5rem)] flex-col pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <MessageCircle className="h-4 w-4 text-primary" />
          Live Chat
        </div>

        <div className="flex items-center gap-2 text-xs text-white/70">
          <Users className="h-3.5 w-3.5" />
          {viewerCount || 0}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/75 backdrop-blur-md"
          >
            <div className="max-h-48 overflow-y-auto px-3 py-2">
              {messages.length === 0 ? (
                <p className="py-4 text-center text-xs text-white/50">No messages yet.</p>
              ) : (
                messages
                  .filter((m) => !m.is_deleted)
                  .map((msg) => (
                    <div key={msg.id} className="group mb-2 flex gap-2 last:mb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-primary">
                          {msg.user_name || 'User'}
                        </p>
                        <p className="text-sm text-white/90 break-words">{msg.content}</p>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          className="opacity-0 transition-opacity group-hover:opacity-100 text-white/50 hover:text-destructive"
                          onClick={async () => {
                            await supabase.from('messages').delete().eq('id', msg.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 border-t border-white/10 p-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="h-8 flex-1 border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40"
              />
              <button
                type="button"
                onClick={sendMessage}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}