import React, { useState } from 'react';
import { Code, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { buildEmbedUrl } from '@/lib/embed-url';

export default function EmbedGenerator({ source }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const embedUrl = buildEmbedUrl(source);

  const wordpressSiteScript = `<script>
window.addEventListener('message',function(e){if(!e.data||e.data.type!=='simple-stream-request-fullscreen')return;var f=e.source&&e.source.frameElement;if(!f)return;var r=f.requestFullscreen||f.webkitRequestFullscreen;if(r)r.call(f);});
</script>`;

  const embedCode = source
    ? `<div style="position:relative;width:100%;max-width:100%;margin:0 auto;padding-bottom:56.25%;height:0;overflow:hidden;background:#000;border-radius:12px;box-sizing:border-box;">
  <iframe
    title="Live stream player"
    src="${embedUrl}"
    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;display:block;"
    allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
    allowfullscreen
    webkitallowfullscreen
    mozallowfullscreen
    loading="lazy"
  ></iframe>
</div>
${wordpressSiteScript}`
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
            <p className="text-xs text-muted-foreground">Responsive code with chat & viewers</p>
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

                  <div className="text-xs text-muted-foreground space-y-1.5">
                    <p className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                      Responsive 16:9 — scales on mobile and landscape
                    </p>
                    <p>Live chat is temporarily disabled on embed while we stabilize the mobile player.</p>
                    <p>
                      <span className="font-semibold text-foreground/90">WordPress:</span> use a{' '}
                      <span className="font-mono">Custom HTML</span> block (not the Embed block).
                    </p>
                    <p>
                      If WordPress strips the script, add it once under{' '}
                      <span className="font-mono">Appearance → Theme File Editor → footer.php</span> (before{' '}
                      <span className="font-mono">&lt;/body&gt;</span>), or use an &quot;Insert Headers and Footers&quot; plugin.
                    </p>
                    <p>On mobile, rotate your phone to landscape — the player resizes automatically.</p>
                  </div>
                  {source.type === 'rtmp' && !source.hlsUrl && (
                    <p className="text-xs text-amber-500/90">
                      Connect with an HLS URL first, then copy this embed code again.
                    </p>
                  )}
                  {source.type === 'rtmp' && source.hlsUrl && (
                    <>
                      <p className="text-xs text-amber-500/90">
                        Deploy to HTTPS (Cloudflare Pages) before using on a live website — replace
                        localhost with your production domain in the iframe <span className="font-mono">src</span>.
                      </p>
                      <a
                        href={embedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Preview embed in new tab
                      </a>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}