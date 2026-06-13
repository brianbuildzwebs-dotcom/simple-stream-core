import React, { useState, useRef, useEffect } from 'react';
import { Youtube, Radio, Upload, Link, Key, FileVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  buildCustomRtmpSource,
  RTMP_SERVER_URL,
  RTMP_STREAM_KEY,
  RTMP_HLS_URL,
  resolveHlsUrl,
  validateRtmpServerUrl,
  validateCustomStreamKey,
  validateGenericHlsUrl,
} from '@/lib/rtmp';

function resolveRtmpPlayback(hlsInput, streamKey) {
  const trimmed = hlsInput?.trim() || '';
  if (trimmed) {
    const check = validateGenericHlsUrl(trimmed);
    return check.valid ? { valid: true, url: check.url, error: check.error } : check;
  }
  const resolved = resolveHlsUrl(streamKey, '', null);
  if (resolved) return { valid: true, url: resolved, error: '' };
  return {
    valid: false,
    error: 'HLS playback URL is required — browsers cannot play raw RTMPS.',
    url: '',
  };
}
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
  const [rtmpServerUrl, setRtmpServerUrl] = useState(RTMP_SERVER_URL);
  const [rtmpStreamKey, setRtmpStreamKey] = useState(RTMP_STREAM_KEY);
  const [rtmpHlsUrl, setRtmpHlsUrl] = useState(RTMP_HLS_URL);
  const [rtmpLabel, setRtmpLabel] = useState('');
  const [rtmpServerError, setRtmpServerError] = useState('');
  const [rtmpKeyError, setRtmpKeyError] = useState('');
  const [rtmpHlsError, setRtmpHlsError] = useState('');
  const fileInputRef = useRef(null);
  const autoConnected = useRef(false);

  useEffect(() => {
    if (currentSource?.type !== 'rtmp') return;
    if (currentSource.serverUrl) setRtmpServerUrl(currentSource.serverUrl);
    if (currentSource.streamKey) setRtmpStreamKey(currentSource.streamKey);
    if (currentSource.hlsUrl) setRtmpHlsUrl(currentSource.hlsUrl);
    if (currentSource.label) setRtmpLabel(currentSource.label);
  }, [currentSource]);

  useEffect(() => {
    if (autoConnected.current || currentSource) return;

    const serverCheck = validateRtmpServerUrl(rtmpServerUrl);
    const keyCheck = validateCustomStreamKey(rtmpStreamKey);
    const hlsCheck = resolveRtmpPlayback(rtmpHlsUrl, keyCheck.key);

    if (serverCheck.valid && keyCheck.valid && hlsCheck.valid) {
      autoConnected.current = true;
      onSourceChange(
        buildCustomRtmpSource(serverCheck.url, keyCheck.key, hlsCheck.url, rtmpLabel)
      );
      setActiveTab('rtmp');
    }
  }, [currentSource, onSourceChange, rtmpServerUrl, rtmpStreamKey, rtmpHlsUrl, rtmpLabel]);

  const extractYoutubeSource = (url) => {
    const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const videoPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    ];
    let videoId = null;
    for (const pattern of videoPatterns) {
      const match = url.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
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

  const handleRtmpSubmit = () => {
    setRtmpServerError('');
    setRtmpKeyError('');
    setRtmpHlsError('');

    const serverCheck = validateRtmpServerUrl(rtmpServerUrl);
    if (!serverCheck.valid) {
      setRtmpServerError(serverCheck.error);
      return;
    }

    const keyCheck = validateCustomStreamKey(rtmpStreamKey);
    if (!keyCheck.valid) {
      setRtmpKeyError(keyCheck.error);
      return;
    }

    const hlsCheck = resolveRtmpPlayback(rtmpHlsUrl, keyCheck.key);
    if (!hlsCheck.valid) {
      setRtmpHlsError(hlsCheck.error);
      return;
    }

    if (hlsCheck.url !== rtmpHlsUrl) setRtmpHlsUrl(hlsCheck.url);
    onSourceChange(
      buildCustomRtmpSource(serverCheck.url, keyCheck.key, hlsCheck.url, rtmpLabel)
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
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    setYoutubeError('');
                  }}
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
            <Input
              placeholder="Label (optional) — e.g. Church stream, Twitch, Cloudflare"
              value={rtmpLabel}
              onChange={(e) => setRtmpLabel(e.target.value)}
              className="bg-secondary/50 border-border/50 h-11"
            />
            <div className="relative">
              <Radio className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="RTMPS server URL — e.g. rtmps://live.cloudflare.com:443/live/"
                value={rtmpServerUrl}
                onChange={(e) => {
                  setRtmpServerUrl(e.target.value);
                  setRtmpServerError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleRtmpSubmit()}
                spellCheck={false}
                autoComplete="off"
                className="pl-10 bg-secondary/50 border-border/50 h-11 font-mono text-xs"
              />
            </div>
            {rtmpServerError && <p className="text-xs text-destructive">{rtmpServerError}</p>}
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Stream key"
                value={rtmpStreamKey}
                onChange={(e) => {
                  setRtmpStreamKey(e.target.value);
                  setRtmpKeyError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleRtmpSubmit()}
                spellCheck={false}
                autoComplete="off"
                className="pl-10 bg-secondary/50 border-border/50 h-11 font-mono text-sm"
              />
            </div>
            {rtmpKeyError && <p className="text-xs text-destructive">{rtmpKeyError}</p>}
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="HLS playback URL (https://.../video.m3u8)"
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
            <Button onClick={handleRtmpSubmit} className="h-11 w-full bg-accent hover:bg-accent/90">
              Connect
            </Button>
            <p className="text-xs text-muted-foreground">
              RTMPS is for ingest (OBS/vMix). The player watches the <strong>HLS URL</strong> from your
              provider&apos;s playback settings.
            </p>
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