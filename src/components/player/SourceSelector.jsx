import React, { useState, useRef, useEffect } from 'react';
import { Youtube, Radio, Upload, Link, Key, FileVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  buildCustomRtmpSource,
  buildRtmpSource,
  RTMP_SERVER_URL,
  RTMP_STREAM_KEY,
  RTMP_HLS_URL,
  resolveHlsUrl,
  normalizeStreamKey,
  validateStreamKey,
  validateHlsManifestUrl,
  validateRtmpServerUrl,
  validateCustomStreamKey,
  validateGenericHlsUrl,
} from '@/lib/rtmp';
import { isYoutubeLiveUrl } from '@/lib/youtube';

const tabs = [
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'rtmp', label: 'RTMP Stream', icon: Radio },
  { id: 'upload', label: 'Upload', icon: Upload },
];

export default function SourceSelector({ onSourceChange, currentSource }) {
  const [activeTab, setActiveTab] = useState('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  const [rtmpKey, setRtmpKey] = useState(RTMP_STREAM_KEY);
  const [rtmpHlsUrl, setRtmpHlsUrl] = useState(RTMP_HLS_URL);
  const [rtmpMode, setRtmpMode] = useState('cloudflare');
  const [rtmpKeyError, setRtmpKeyError] = useState('');
  const [rtmpHlsError, setRtmpHlsError] = useState('');
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [customStreamKey, setCustomStreamKey] = useState('');
  const [customHlsUrl, setCustomHlsUrl] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customServerError, setCustomServerError] = useState('');
  const [customKeyError, setCustomKeyError] = useState('');
  const [customHlsError, setCustomHlsError] = useState('');
  const fileInputRef = useRef(null);
  const autoConnected = useRef(false);

  useEffect(() => {
    if (currentSource?.type === 'rtmp') {
      setRtmpMode(currentSource.provider === 'custom' ? 'custom' : 'cloudflare');
    }
  }, [currentSource]);

  useEffect(() => {
    if (autoConnected.current || currentSource || rtmpMode !== 'cloudflare') return;
    const keyCheck = validateStreamKey(rtmpKey);
    const hlsCheck = validateHlsManifestUrl(rtmpHlsUrl);
    if (keyCheck.valid && hlsCheck.valid && resolveHlsUrl(keyCheck.key, hlsCheck.url)) {
      autoConnected.current = true;
      onSourceChange(buildRtmpSource(keyCheck.key, hlsCheck.url));
      setActiveTab('rtmp');
    }
  }, [currentSource, onSourceChange, rtmpKey, rtmpHlsUrl, rtmpMode]);

  const extractYoutubeSource = (url) => {
    // Check for playlist
    const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const videoPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    ];
    let videoId = null;
    for (const pattern of videoPatterns) {
      const match = url.match(pattern);
      if (match) { videoId = match[1]; break; }
    }
    if (videoId) {
      return {
        videoId,
        playlistId: playlistMatch?.[1] || null,
        isLive: isYoutubeLiveUrl(url),
      };
    }
    if (playlistMatch) return { videoId: null, playlistId: playlistMatch[1], isLive: false };
    return null;
  };

  const handleYoutubeSubmit = () => {
    setYoutubeError('');
    const trimmed = youtubeUrl.trim();
    const result = extractYoutubeSource(trimmed);
    if (result) {
      onSourceChange({ type: 'youtube', ...result, url: trimmed });
    } else {
      setYoutubeError('Could not find a valid YouTube video or playlist URL.');
    }
  };

  const handleStreamKeyChange = (value) => {
    if (/^rtmps?:\/\//i.test(value.trim())) {
      setRtmpKey(normalizeStreamKey(value));
    } else {
      setRtmpKey(value.replace(/[^a-fA-F0-9kK]/g, '').toLowerCase());
    }
    setRtmpKeyError('');
  };

  const handleRtmpSubmit = () => {
    setRtmpKeyError('');
    setRtmpHlsError('');

    const keyCheck = validateStreamKey(rtmpKey);
    if (!keyCheck.valid) {
      setRtmpKeyError(keyCheck.error);
      return;
    }

    const hlsCheck = validateHlsManifestUrl(rtmpHlsUrl);
    if (!hlsCheck.valid) {
      setRtmpHlsError(hlsCheck.error);
      return;
    }

    if (!resolveHlsUrl(keyCheck.key, hlsCheck.url)) {
      setRtmpHlsError(
        'Add a valid HLS manifest URL, or set VITE_RTMP_HLS_URL / VITE_RTMP_CUSTOMER_CODE in .env.local.'
      );
      return;
    }

    setRtmpKey(keyCheck.key);
    onSourceChange(buildRtmpSource(keyCheck.key, hlsCheck.url));
  };

  const handleCustomRtmpSubmit = () => {
    setCustomServerError('');
    setCustomKeyError('');
    setCustomHlsError('');

    const serverCheck = validateRtmpServerUrl(customServerUrl);
    if (!serverCheck.valid) {
      setCustomServerError(serverCheck.error);
      return;
    }

    const keyCheck = validateCustomStreamKey(customStreamKey);
    if (!keyCheck.valid) {
      setCustomKeyError(keyCheck.error);
      return;
    }

    const hlsCheck = validateGenericHlsUrl(customHlsUrl);
    if (!hlsCheck.valid) {
      setCustomHlsError(hlsCheck.error);
      return;
    }

    onSourceChange(
      buildCustomRtmpSource(
        serverCheck.url,
        keyCheck.key,
        hlsCheck.url,
        customLabel
      )
    );
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onSourceChange({ type: 'file', url, fileName: file.name });
    }
  };

  return (
    <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-4">
      {/* Tab Headers */}
      <div className="flex gap-1 mb-4 bg-secondary/50 rounded-lg p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSourceTab"
                  className="absolute inset-0 bg-primary rounded-md"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'youtube' && (
          <motion.div
            key="youtube"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Paste YouTube video or playlist URL..."
                  value={youtubeUrl}
                  onChange={(e) => { setYoutubeUrl(e.target.value); setYoutubeError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleYoutubeSubmit()}
                  className="pl-10 bg-secondary/50 border-border/50 h-11"
                />
              </div>
              <Button onClick={handleYoutubeSubmit} className="h-11 px-6 bg-primary hover:bg-primary/90">
                Load
              </Button>
            </div>
            {youtubeError && <p className="text-xs text-destructive">{youtubeError}</p>}
          </motion.div>
        )}

        {activeTab === 'rtmp' && (
          <motion.div
            key="rtmp"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="flex gap-1 rounded-lg bg-secondary/40 p-1">
              {[
                { id: 'cloudflare', label: 'Cloudflare' },
                { id: 'custom', label: 'Custom RTMPS' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setRtmpMode(mode.id)}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    rtmpMode === mode.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {rtmpMode === 'cloudflare' ? (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="RTMPS stream key from Cloudflare..."
                      value={rtmpKey}
                      onChange={(e) => handleStreamKeyChange(e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        handleStreamKeyChange(e.clipboardData.getData('text'));
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleRtmpSubmit()}
                      spellCheck={false}
                      autoComplete="off"
                      inputMode="text"
                      className="pl-10 bg-secondary/50 border-border/50 h-11 font-mono text-sm"
                    />
                  </div>
                  <Button onClick={handleRtmpSubmit} className="h-11 px-6 bg-accent hover:bg-accent/90">
                    Connect
                  </Button>
                </div>
                {rtmpKeyError && <p className="text-xs text-destructive">{rtmpKeyError}</p>}
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="HLS Manifest URL (from Cloudflare live input → Playback)..."
                    value={rtmpHlsUrl}
                    onChange={(e) => {
                      setRtmpHlsUrl(e.target.value.trim());
                      setRtmpHlsError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleRtmpSubmit()}
                    spellCheck={false}
                    autoComplete="off"
                    className="pl-10 bg-secondary/50 border-border/50 h-11 font-mono text-xs"
                  />
                </div>
                {rtmpHlsError && <p className="text-xs text-destructive">{rtmpHlsError}</p>}
                <p className="text-xs text-muted-foreground">
                  RTMP Server:{' '}
                  <span className="font-mono text-foreground/70 break-all">{RTMP_SERVER_URL}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Use these in OBS or vMix → Custom RTMP Server.
                </p>
                {!resolveHlsUrl(rtmpKey, rtmpHlsUrl) && (
                  <p className="text-xs text-amber-500/90">
                    Paste the HLS Manifest URL above, or set{' '}
                    <span className="font-mono">VITE_RTMP_HLS_URL</span> in{' '}
                    <span className="font-mono">.env.local</span>.
                  </p>
                )}
                {resolveHlsUrl(rtmpKey, rtmpHlsUrl) && (
                  <p className="text-xs text-muted-foreground">
                    Recording must be <strong>Automatic</strong> on this Cloudflare live input or HLS
                    playback stays empty.
                  </p>
                )}
              </>
            ) : (
              <>
                <Input
                  placeholder="Label (optional) — e.g. YouTube Live, Twitch, Church stream"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="bg-secondary/50 border-border/50 h-11"
                />
                <div className="relative">
                  <Radio className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="RTMPS server URL — e.g. rtmps://live.twitch.tv/app/"
                    value={customServerUrl}
                    onChange={(e) => {
                      setCustomServerUrl(e.target.value);
                      setCustomServerError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomRtmpSubmit()}
                    spellCheck={false}
                    autoComplete="off"
                    className="pl-10 bg-secondary/50 border-border/50 h-11 font-mono text-xs"
                  />
                </div>
                {customServerError && <p className="text-xs text-destructive">{customServerError}</p>}
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Stream key from your provider"
                    value={customStreamKey}
                    onChange={(e) => {
                      setCustomStreamKey(e.target.value);
                      setCustomKeyError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomRtmpSubmit()}
                    spellCheck={false}
                    autoComplete="off"
                    className="pl-10 bg-secondary/50 border-border/50 h-11 font-mono text-sm"
                  />
                </div>
                {customKeyError && <p className="text-xs text-destructive">{customKeyError}</p>}
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="HLS playback URL (https://.../video.m3u8)"
                    value={customHlsUrl}
                    onChange={(e) => {
                      setCustomHlsUrl(e.target.value.trim());
                      setCustomHlsError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomRtmpSubmit()}
                    spellCheck={false}
                    autoComplete="off"
                    className="pl-10 bg-secondary/50 border-border/50 h-11 font-mono text-xs"
                  />
                </div>
                {customHlsError && <p className="text-xs text-destructive">{customHlsError}</p>}
                <Button onClick={handleCustomRtmpSubmit} className="h-11 w-full bg-accent hover:bg-accent/90">
                  Connect Custom RTMPS
                </Button>
                <p className="text-xs text-muted-foreground">
                  RTMPS is for ingest (OBS/vMix). The player watches the <strong>HLS URL</strong> — get
                  that from your provider&apos;s playback or CDN settings.
                </p>
                <p className="text-xs text-muted-foreground">
                  Examples: YouTube <span className="font-mono">rtmps://a.rtmp.youtube.com/live2</span>,
                  Twitch <span className="font-mono">rtmps://live.twitch.tv/app</span>
                </p>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border/50 rounded-lg p-6 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FileVideo className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {currentSource?.type === 'file' ? currentSource.fileName : 'Drop a video file or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">MP4, WebM, OGG supported</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}