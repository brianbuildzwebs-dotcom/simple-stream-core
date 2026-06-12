import { getLiveInputId } from './rtmp';

export function buildEmbedUrl(source) {
  const base = window.location.origin;
  if (!source) return '';

  if (source.type === 'youtube') {
    let url = `${base}/embed?source=youtube`;
    if (source.videoId) url += `&id=${source.videoId}`;
    if (source.playlistId) url += `&list=${source.playlistId}`;
    if (source.isLive) url += '&live=1';
    url += `&url=${encodeURIComponent(source.url)}`;
    return url;
  }

  if (source.type === 'file') {
    return `${base}/embed?source=file&url=${encodeURIComponent(source.url)}&name=${encodeURIComponent(source.fileName || 'Video')}`;
  }

  if (source.type === 'rtmp') {
    // Always embed the HLS URL in the iframe src so it works on any host.
    if (source.hlsUrl) {
      return `${base}/embed?hls=${encodeURIComponent(source.hlsUrl)}`;
    }
    const inputId = getLiveInputId(source.streamKey);
    if (inputId) {
      return `${base}/embed?input=${encodeURIComponent(inputId)}`;
    }
    return `${base}/embed`;
  }

  return '';
}