import React, { useState, useMemo } from 'react';
import VideoPlayer from '@/components/player/VideoPlayer';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { parseEmbedSource } from '@/lib/embed-params';

function parseEmbedOptions(search = '') {
  const params = new URLSearchParams(search);
  return {
    chatEnabled: params.get('chat') !== '0',
  };
}

export default function Embed() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const [source] = useState(() => parseEmbedSource(search));
  const embedOptions = useMemo(() => parseEmbedOptions(search), [search]);
  const { settings, loading } = usePlayerSettings();

  const mergedSettings = {
    ...settings,
    chat_enabled: embedOptions.chatEnabled && settings.chat_enabled !== false,
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-black supports-[min-height:100dvh]:min-h-[100dvh]">
      <VideoPlayer
        source={source}
        embed
        settings={loading ? { chat_enabled: embedOptions.chatEnabled } : mergedSettings}
      />
    </div>
  );
}