import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Users, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function ChatOverlay({
  viewerCount,
  isAdmin = false,
  chatEnabled = true,
  profanityFilter = false,
  hasSource = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [bannedNames, setBannedNames] = useState(new Set());
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
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage = {
      id: Date.now(),
      user: 'You',
      text: inputValue.trim(),
      created_at: new Date().toISOString(),
    };

    await supabase.from('messages').insert([newMessage]);
    setInputValue('');
  };

  return (
    <div className="chat-overlay">
      <div className="chat-header">
        <div className="chat-title">
          <MessageCircle className="icon" />
          Live Chat
        </div>

        <div className="chat-meta">
          <Users className="icon" />
          {viewerCount || 0} watching
        </div>

        <button type="button" onClick={() => setIsOpen((open) => !open)}>
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="chat-content"
          >
            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">No messages yet.</div>
              ) : (
                messages.map((msg) => (
                  <div className="message" key={msg.id}>
                    <div className="message-user">{msg.user || 'User'}</div>
                    <div className="message-text">{msg.text}</div>
                    {isAdmin && (
                      <button
                        type="button"
                        className="delete-button"
                        onClick={async () => {
                          await supabase.from('messages').delete().eq('id', msg.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1"
              />
              <button type="button" onClick={sendMessage} className="send-button">
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
