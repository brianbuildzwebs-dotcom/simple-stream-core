import React, { useState } from 'react';
import VideoPlayer from '@/components/player/VideoPlayer';
import SourceSelector from '@/components/player/SourceSelector';
import { Tv } from 'lucide-react';

export default function Home() {
  const [source, setSource] = useState(null);

  const handleSourceChange = (newSource) => {
    setSource(newSource);
  };

  const settings = {
    player_name: 'Simple Streams',
    chat_enabled: true,
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 flex items-center gap-3">
          <Tv className="h-8 w-8 text-cyan-400" />
          <div>
            <h1 className="text-3xl font-semibold">{settings.player_name}</h1>
            <p className="text-sm text-slate-400">Stream, select sources, and enjoy.</p>
          </div>
        </header>

        <section className="mb-6">
          <VideoPlayer source={source} settings={settings} />
        </section>

        <section>
          <SourceSelector selectedSource={source} onSourceChange={handleSourceChange} />
        </section>
      </div>
    </main>
  );
}
