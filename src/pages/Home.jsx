import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Shield, Sparkles, Tv } from 'lucide-react';
import VideoPlayer from '@/components/player/VideoPlayer';
import SourceSelector from '@/components/player/SourceSelector';
import EmbedGenerator from '@/components/player/EmbedGenerator';
import ViewerCount from '@/components/player/ViewerCount';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { useAuth } from '@/lib/AuthContext';

const FEATURES = [
  { label: 'YouTube Playback', desc: 'Paste any YouTube URL' },
  { label: 'RTMP Streaming', desc: 'Cloudflare Stream or custom RTMPS feeds' },
  { label: 'File Upload', desc: 'Play local video files' },
  { label: 'Live Chat', desc: 'Real-time chat overlay' },
  { label: 'Embed Code', desc: 'Share via iframe' },
];

function sourceTypeLabel(type) {
  if (type === 'youtube') return 'YouTube';
  if (type === 'rtmp') return 'RTMP';
  return 'File';
}

function sourceTitle(source) {
  if (!source) return '';
  if (source.type === 'youtube') return source.isLive ? 'YouTube Live' : 'YouTube Video';
  if (source.type === 'rtmp') {
    return source.label || (source.provider === 'custom' ? 'Custom RTMPS' : 'RTMP Live Stream');
  }
  return source.fileName || 'Local File';
}

function sourceSubtitle(source) {
  if (!source) return '';
  if (source.type === 'youtube') return source.url;
  if (source.type === 'rtmp') {
    if (source.provider === 'custom') {
      return source.serverUrl || 'Custom RTMPS feed';
    }
    return `Stream Key: ${source.streamKey}`;
  }
  return 'Local File';
}

export default function Home() {
  const [source, setSource] = useState(null);
  const [chatEpoch, setChatEpoch] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);

  const handleSourceChange = (nextSource) => {
    setSource(nextSource);
    setChatEpoch((value) => value + 1);
  };
  const { settings, loading } = usePlayerSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const playerName = loading ? 'Loading...' : settings.player_name;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt=""
                className="w-9 h-9 rounded-lg object-contain"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center"
                style={
                  settings.primary_color
                    ? {
                        background: `linear-gradient(to bottom right, ${settings.primary_color}, hsl(var(--accent)))`,
                      }
                    : undefined
                }
              >
                <Tv className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold tracking-tight">{playerName}</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5 font-medium tracking-wide uppercase">
                Video Player
              </p>
            </div>
          </div>

          {source && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
            >
              <Radio className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">
                {sourceTypeLabel(source.type)} Active
              </span>
            </motion.div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <VideoPlayer
              source={source}
              chatEpoch={chatEpoch}
              settings={settings}
              isAdmin={isAdmin}
              onViewerCountChange={setViewerCount}
            />

            {source && (
              <div className="flex items-center justify-between">
                <ViewerCount count={viewerCount} />
              </div>
            )}

            {source && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      source.type === 'rtmp' ? 'bg-accent animate-pulse' : 'bg-green-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{sourceTitle(source)}</p>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {sourceSubtitle(source)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSource(null);
                    setChatEpoch((value) => value + 1);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 ml-4"
                >
                  Clear
                </button>
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            <SourceSelector currentSource={source} onSourceChange={handleSourceChange} />
            <EmbedGenerator source={source} />

            <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Features</h3>
              <div className="space-y-2.5">
                {FEATURES.map((feature) => (
                  <div key={feature.label} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{feature.label}</p>
                      <p className="text-xs text-muted-foreground">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            &copy; {new Date().getFullYear()} {playerName}. Built for seamless playback.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3" />
              <span>Powered by {playerName}</span>
            </div>
            <Link
              to="/admin"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Shield className="w-3 h-3" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}