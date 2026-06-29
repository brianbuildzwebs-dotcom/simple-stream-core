import React from 'react';
import VideoPlayer from '@/components/player/VideoPlayer';
import { APP_NAME } from '@/lib/brand';

const DEMO_SOURCE = {
  type: 'file',
  url: '/demo-stream.mp4',
  fileName: 'hero-embed-preview',
};

const DEMO_SETTINGS = {
  chat_enabled: true,
  profanity_filter: false,
  give_enabled: true,
  give_url: '#',
  give_label: 'Give',
};

const DEMO_WATERMARK = {
  enabled: true,
  text: `© ${APP_NAME}`,
  position: 'bottom_right',
  size: 'medium',
  opacity: 0.75,
};

/**
 * Marketing hero uses the same VideoPlayer shell as /embed (chat dock, embed controls).
 */
export default function HeroEmbedPreview() {
  return (
    <div className="hero-embed-preview w-full bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-primary/10">
      <div className="px-3 py-1.5 bg-card/90 border-b border-white/10 text-center text-[10px] text-muted-foreground font-medium">
        DEMO — Same embed your church uses (video, chat, and optional Give button)
      </div>
      <VideoPlayer
        source={DEMO_SOURCE}
        embed
        embedId="hero-preview"
        watermark={DEMO_WATERMARK}
        settings={DEMO_SETTINGS}
        autoPlayLoop
        chatEpoch={0}
      />
    </div>
  );
}