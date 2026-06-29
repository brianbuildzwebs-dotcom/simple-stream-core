import React, { useCallback, useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function SermonPlayer({ hlsUrl, title }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return undefined;

    destroyHls();

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => {});
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      void video.play().catch(() => {});
    }

    return destroyHls;
  }, [destroyHls, hlsUrl]);

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50 bg-black aspect-video">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
        title={title}
      />
    </div>
  );
}