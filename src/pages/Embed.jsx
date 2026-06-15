import React, { useState, useMemo, useEffect } from 'react';
import VideoPlayer from '@/components/player/VideoPlayer';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { parseEmbedSource } from '@/lib/embed-params';
import { fetchEmbedConfig, logEmbedView } from '@/lib/embeds';

function parseEmbedOptions(search = '') {
  const params = new URLSearchParams(search);
  const fullscreenMode = params.get('fs') === '1';
  return {
    chatEnabled: !fullscreenMode && params.get('chat') !== '0',
    fullscreenMode,
    trackingCode: params.get('code')?.trim() || null,
  };
}

export default function Embed() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const embedOptions = useMemo(() => parseEmbedOptions(search), [search]);
  const [source, setSource] = useState(() => (embedOptions.trackingCode ? null : parseEmbedSource(search)));
  const [watermark, setWatermark] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadingCode, setLoadingCode] = useState(!!embedOptions.trackingCode);
  const { settings, loading } = usePlayerSettings();

  useEffect(() => {
    if (!embedOptions.trackingCode) return;

    let cancelled = false;
    setLoadingCode(true);
    setLoadError(null);

    fetchEmbedConfig(embedOptions.trackingCode)
      .then((config) => {
        if (cancelled) return;
        setSource(config.source);
        setWatermark(config.watermark?.enabled ? config.watermark : null);
        logEmbedView(embedOptions.trackingCode);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || 'Failed to load embed');
        setSource(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCode(false);
      });

    return () => {
      cancelled = true;
    };
  }, [embedOptions.trackingCode]);

  const mergedSettings = {
    ...settings,
    chat_enabled: embedOptions.chatEnabled && settings.chat_enabled !== false,
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

  if (loadingCode) {
    return (
      <div className="embed-player-shell flex h-[100dvh] w-full items-center justify-center bg-black text-white/70 text-sm">
        Loading player…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="embed-player-shell flex h-[100dvh] w-full items-center justify-center bg-black text-red-300 text-sm px-6 text-center">
        {loadError}
      </div>
    );
  }

  return (
    <div className="embed-player-shell flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-black supports-[min-height:100dvh]:min-h-[100dvh]">
      <VideoPlayer
        source={source}
        embed
        watermark={watermark}
        settings={loading ? { chat_enabled: embedOptions.chatEnabled } : mergedSettings}
      />
    </div>
  );
}