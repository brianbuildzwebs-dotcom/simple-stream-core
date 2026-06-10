import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import PlayerSettingsForm from '@/components/admin/PlayerSettingsForm';
import ChatModerator from '@/components/admin/ChatModerator';
import BannedUsersList from '@/components/admin/BannedUsersList';
import { Shield, Settings, MessageSquare, UserX, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'settings', label: 'Player Settings', icon: Settings },
  { id: 'chat', label: 'Chat Moderation', icon: MessageSquare },
  { id: 'bans', label: 'Banned Users', icon: UserX },
];

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const [activeTab, setActiveTab] = useState('settings');
  const navigate = useNavigate();

  useEffect(() => {
    if (!authChecked || isLoadingAuth) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'admin') {
      navigate('/');
    }
  }, [authChecked, isLoadingAuth, isAuthenticated, user, navigate]);

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Admin Dashboard</h1>
            <p className="text-[11px] text-muted-foreground -mt-0.5 font-medium">
              Logged in as {user.full_name}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-1 mb-8 bg-secondary/50 rounded-lg p-1 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="adminTab"
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
    </div>
  );
}