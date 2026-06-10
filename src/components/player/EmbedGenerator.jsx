import React, { useState } from 'react';
import { Code, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

function buildEmbedUrl(source) {
  const APP_BASE_URL = window.location.origin;
  if (!source) return '';
  if (source.type === 'youtube') {
    let url = `${APP_BASE_URL}/embed?source=youtube`;
    if (source.videoId) url += `&id=${source.videoId}`;
    if (source.playlistId) url += `&list=${source.playlistId}`;
    url += `&url=${encodeURIComponent(source.url)}`;
    return url;
  }
  if (source.type === 'file') {
    return `${APP_BASE_URL}/embed?source=file&url=${encodeURIComponent(source.url)}&name=${encodeURIComponent(source.fileName || 'Video')}`;
  }
  if (source.type === 'rtmp') {
    return `${APP_BASE_URL}/embed?source=rtmp&key=${encodeURIComponent(source.streamKey)}`;
  }
  return '';
}

export default function EmbedGenerator({ source }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState('800');
  const [height, setHeight] = useState('450');

  const embedUrl = buildEmbedUrl(source);

  const embedCode = source
    ? `<iframe\n  width="${width}"\n  height="${height}"\n  src="${embedUrl}"\n  frameborder="0"\n  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"\n  allowfullscreen\n  style="border-radius: 12px; border: 1px solid #1e293b;"\n></iframe>`
    : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Embed Player</p>
            <p className="text-xs text-muted-foreground">Get embeddable HTML code</p>
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {!source ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Load a video source first to generate embed code
                </p>
              ) : (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1.5 block">Width (px)</label>
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border/50 text-sm font-mono text-foreground"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1.5 block">Height (px)</label>
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border/50 text-sm font-mono text-foreground"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <pre className="bg-secondary/50 border border-border/50 rounded-lg p-4 overflow-x-auto">
                      <code className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
                        {embedCode}
                      </code>
                    </pre>
                    <Button
                      size="sm"
                      onClick={handleCopy}
                      className="absolute top-2 right-2 h-8 px-3 gap-1.5 bg-primary/90 hover:bg-primary text-xs"
                    >
                      {copied ? (
                        <><Check className="w-3 h-3" />Copied!</>
                      ) : (
                        <><Copy className="w-3 h-3" />Copy</>
                      )}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Embed size: {width} × {height}px
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}