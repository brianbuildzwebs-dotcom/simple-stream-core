import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import PlayerSettingsForm from '@/components/admin/PlayerSettingsForm';
import ChatModerator from '@/components/chat/ChatModerator';
import BannedUsersList from '@/components/admin/BannedUsersList';
import { Settings, MessageSquare, UserX } from 'lucide-react';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'settings', label: 'Player Settings', icon: Settings },
  { id: 'chat', label: 'Chat Moderation', icon: MessageSquare },
  { id: 'bans', label: 'Banned Users', icon: UserX },
];

export default function AdminModeration() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Chat Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">Logged in as {user?.full_name}</p>
      </div>

      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="adminModerationTab"
                  className="absolute inset-0 bg-primary rounded-md"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === 'settings' && <PlayerSettingsForm />}
      {activeTab === 'chat' && <ChatModerator />}
      {activeTab === 'bans' && <BannedUsersList />}
    </div>
  );
}