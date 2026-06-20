import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYoutubeUrl } from './youtube-url.mjs';

test('parseYoutubeUrl handles watch URLs with playlist', () => {
  const result = parseYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123');
  assert.equal(result.videoId, 'dQw4w9WgXcQ');
  assert.equal(result.playlistId, 'PLtest123');
});

test('parseYoutubeUrl handles playlist-only URLs', () => {
  const result = parseYoutubeUrl('https://www.youtube.com/playlist?list=PLtest123');
  assert.equal(result.videoId, null);
  assert.equal(result.playlistId, 'PLtest123');
});

test('parseYoutubeUrl handles youtu.be links', () => {
  const result = parseYoutubeUrl('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(result.videoId, 'dQw4w9WgXcQ');
});