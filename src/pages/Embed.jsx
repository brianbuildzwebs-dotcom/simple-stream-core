import React, { useState, useMemo, useEffect } from 'react';
import VideoPlayer from '@/components/player/VideoPlayer';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { parseEmbedSource } from '@/lib/embed-params';

function parseEmbedOptions(search = '') {
  const params = new URLSearchParams(search);
  const fullscreenMode = params.get('fs') === '1';
  return {
    chatEnabled: !fullscreenMode && params.get('chat') !== '0',
    fullscreenMode,
  };
}

export default function Embed() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const [source] = useState(() => parseEmbedSource(search));
  const embedOptions = useMemo(() => parseEmbedOptions(search), [search]);
  const { settings, loading } = usePlayerSettings();

  const mergedSettings = {
    ...settings,
    // Chat disabled on embed until docked layout is stable on mobile.
    chat_enabled: false,
  };

  useEffect(() => {
    document.documentElement.classList.add('embed-route');
    if (embedOptions.fullscreenMode) {
      document.documentElement.classList.add('embed-fs-mode');
    }
    return () => {
      document.documentElement.classList.remove('embed-route');
      document.documentElement.classList.remove('embed-fs-mode');
    };
  }, [embedOptions.fullscreenMode]);

  return (
    <div className="embed-player-shell flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-black supports-[min-height:100dvh]:min-h-[100dvh]">
      <VideoPlayer
        source={source}
        embed
        settings={loading ? { chat_enabled: false } : mergedSettings}
      />
    </div>
  );
}