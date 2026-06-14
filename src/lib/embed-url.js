import { getLiveInputId } from './rtmp';

function withEmbedDefaults(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}chat=0`;
}

export function buildEmbedUrl(source) {
  const base = window.location.origin;
  if (!source) return '';

  if (source.type === 'youtube') {
    let url = `${base}/embed?source=youtube`;
    if (source.videoId) url += `&id=${source.videoId}`;
    if (source.playlistId) url += `&list=${source.playlistId}`;
    if (source.isLive) url += '&live=1';
    url += `&url=${encodeURIComponent(source.url)}`;
    return withEmbedDefaults(url);
  }

  if (source.type === 'file') {
    return withEmbedDefaults(
      `${base}/embed?source=file&url=${encodeURIComponent(source.url)}&name=${encodeURIComponent(source.fileName || 'Video')}`
    );
  }

  if (source.type === 'rtmp') {
    if (source.serverUrl && source.streamKey && source.hlsUrl) {
      let url = `${base}/embed?source=rtmp&provider=custom`;
      url += `&server=${encodeURIComponent(source.serverUrl)}`;
      url += `&key=${encodeURIComponent(source.streamKey)}`;
      url += `&hls=${encodeURIComponent(source.hlsUrl)}`;
      if (source.label) url += `&label=${encodeURIComponent(source.label)}`;
      return withEmbedDefaults(url);
    }

    // Always embed the HLS URL in the iframe src so it works on any host.
    if (source.hlsUrl) {
      return withEmbedDefaults(`${base}/embed?hls=${encodeURIComponent(source.hlsUrl)}`);
    }
    const inputId = getLiveInputId(source.streamKey);
    if (inputId) {
      return withEmbedDefaults(`${base}/embed?input=${encodeURIComponent(inputId)}`);
    }
    return withEmbedDefaults(`${base}/embed`);
  }

  return '';
}