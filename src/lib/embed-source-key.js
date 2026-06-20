import { getSourceKey } from '@/lib/source-key';
import { parseYoutubeUrl } from '@/lib/youtube-url';

function normalizeStreamKeys(streamKeys) {
  if (Array.isArray(streamKeys)) return streamKeys;
  if (streamKeys?.streamKeys && Array.isArray(streamKeys.streamKeys)) {
    return streamKeys.streamKeys;
  }
  return [];
}

export function resolveEmbedPlayerSource(embed, streamKeys = []) {
  if (!embed) return null;

  const keys = normalizeStreamKeys(streamKeys);

  if (embed.video_source_type === 'youtube' && embed.video_source_url) {
    return parseYoutubeUrl(embed.video_source_url);
  }

  if (embed.video_source_type === 'rtmp' && embed.stream_key_id) {
    const key = keys.find((row) => row.id === embed.stream_key_id);
    if (!key) return null;
    const hlsUrl = key.hls_playback_url;
    if (!hlsUrl || !key.key_value) return null;
    return {
      type: 'rtmp',
      streamKey: key.key_value,
      hlsUrl,
      url: hlsUrl,
    };
  }

  if (embed.video_source_type === 'upload' && embed.video_source_url) {
    return {
      type: 'file',
      url: embed.video_source_url,
      fileName: embed.name || 'Video',
    };
  }

  return null;
}

export function resolveEmbedSourceKey(embed, streamKeys = []) {
  if (embed?.id) return `embed:${embed.id}`;
  return getSourceKey(resolveEmbedPlayerSource(embed, streamKeys));
}

export function buildEmbedChatOptions(embeds = [], streamKeys = []) {
  const keys = normalizeStreamKeys(streamKeys);
  return embeds
    .map((embed) => {
      const sourceKey = resolveEmbedSourceKey(embed, keys);
      return {
        embed,
        sourceKey,
        label: embed.name || embed.tracking_code || 'Untitled embed',
      };
    })
    .filter((entry) => entry.sourceKey);
}