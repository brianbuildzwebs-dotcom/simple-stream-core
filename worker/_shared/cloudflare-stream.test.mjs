import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecordingHlsPlaybackUrl,
  pickLatestReadyRecording,
} from './cloudflare-stream.mjs';

test('buildRecordingHlsPlaybackUrl builds customer manifest URL', () => {
  const url = buildRecordingHlsPlaybackUrl('abc123', 'video-uid');
  assert.equal(url, 'https://customer-abc123.cloudflarestream.com/video-uid/manifest/video.m3u8');
});

test('pickLatestReadyRecording returns newest ready video', () => {
  const latest = pickLatestReadyRecording([
    { uid: 'old', status: { state: 'ready' }, created: '2026-06-01T10:00:00Z' },
    { uid: 'pending', status: { state: 'processing' }, created: '2026-06-02T10:00:00Z' },
    { uid: 'new', status: { state: 'ready' }, created: '2026-06-03T10:00:00Z' },
  ]);

  assert.equal(latest?.uid, 'new');
});

test('pickLatestReadyRecording ignores non-ready videos', () => {
  const latest = pickLatestReadyRecording([
    { uid: 'a', status: { state: 'downloading' } },
    { uid: 'b', status: { state: 'error' } },
  ]);

  assert.equal(latest, null);
});