import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import VideoPlayer from '@/components/player/VideoPlayer';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { parseEmbedSource } from '@/lib/embed-params';
import { fetchEmbedConfig, logEmbedView, normalizeTrackingCode } from '@/lib/embeds';
import { isEmbedMobileViewport } from '@/lib/embed-resize';

function parseEmbedOptions(search = '', pathCode = '') {
  const params = new URLSearchParams(search);
  const fullscreenMode = params.get('fs') === '1';
  const trackingCode =
    normalizeTrackingCode(pathCode) || normalizeTrackingCode(params.get('code') || '');
  return {
    chatEnabled: !fullscreenMode && params.get('chat') !== '0',
    fullscreenMode,
    trackingCode: trackingCode || null,
  };
}

export default function Embed() {
  const { trackingCode: pathCode = '' } = useParams();
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const embedOptions = useMemo(() => parseEmbedOptions(search, pathCode), [search, pathCode]);
  const [source, setSource] = useState(() => (embedOptions.trackingCode ? null : parseEmbedSource(search)));
  const [watermark, setWatermark] = useState(null);
  const [chatMeta, setChatMeta] = useState(null);
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
        setChatMeta({
          ownerUserId: config.ownerUserId || null,
          embedId: config.embedId || null,
          chatEnabled: config.chatEnabled !== false,
        });
        logEmbedView(embedOptions.trackingCode);
      })
      .catch((error) => {
        if (cancelled) return;
        const codeHint = embedOptions.trackingCode
          ? ` (code: ${embedOptions.trackingCode})`
          : '';
        setLoadError(
          (error.message || 'Failed to load embed') +
            codeHint +
            '. Open Embed Manager, confirm the player exists, and copy a fresh embed code.'
        );
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
    chat_enabled:
      embedOptions.chatEnabled &&
      settings.chat_enabled !== false &&
      (chatMeta?.chatEnabled !== false || !embedOptions.trackingCode),
  };

  useEffect(() => {
    document.documentElement.classList.add('embed-route');
    if (embedOptions.fullscreenMode) {
      document.documentElement.classList.add('embed-fs-mode');
    }

    const syncMobileClass = () => {
      document.documentElement.classList.toggle('embed-mobile', isEmbedMobileViewport());
    };
    syncMobileClass();
    window.addEventListener('resize', syncMobileClass);
    window.addEventListener('orientationchange', syncMobileClass);

    return () => {
      document.documentElement.classList.remove('embed-route');
      document.documentElement.classList.remove('embed-fs-mode');
      document.documentElement.classList.remove('embed-mobile');
      window.removeEventListener('resize', syncMobileClass);
      window.removeEventListener('orientationchange', syncMobileClass);
    };
  }, [embedOptions.fullscreenMode]);

  if (loadingCode) {
    return (
      <div className="embed-player-shell flex w-full aspect-video items-center justify-center bg-black text-white/70 text-sm">
        Loading player…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="embed-player-shell flex w-full aspect-video items-center justify-center bg-black text-red-300 text-sm px-6 text-center">
        {loadError}
      </div>
    );
  }

  return (
    <div className="embed-player-shell w-full min-w-full max-w-full bg-black">
      <VideoPlayer
        source={source}
        embed
        watermark={watermark}
        chatOwnerId={chatMeta?.ownerUserId || null}
        embedId={chatMeta?.embedId || null}
        settings={loading ? { chat_enabled: embedOptions.chatEnabled } : mergedSettings}
      />
    </div>
  );
}