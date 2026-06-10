import React, { useState, useEffect } from 'react';
import VideoPlayer from '@/components/player/VideoPlayer';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';

export default function Embed() {
  const [source, setSource] = useState(null);
  const { settings } = usePlayerSettings();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('source');
    if (type === 'youtube') {
      const id = params.get('id');
      const list = params.get('list');
      const url = params.get('url') || '';
      const videoId = id && id !== 'null' ? id : null;
      const playlistId = list && list !== 'null' ? list : null;
      if (videoId || playlistId) setSource({ type: 'youtube', videoId, playlistId, url });
    } else if (type === 'file') {
      const url = params.get('url');
      const fileName = params.get('name') || 'Video';
      if (url) setSource({ type: 'file', url, fileName });
    } else if (type === 'rtmp') {
      const streamKey = params.get('key');
      if (streamKey) setSource({ type: 'rtmp', streamKey });
    }
  }, []);

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="w-full h-full">
        <VideoPlayer source={source} embed settings={settings} />
      </div>
    </div>
  );
}