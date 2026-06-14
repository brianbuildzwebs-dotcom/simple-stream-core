export function isInIframe() {
  return typeof window !== 'undefined' && window.self !== window.top;
}

export function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

export async function requestElementFullscreen(element) {
  if (!element) return false;

  const method =
    element.requestFullscreen ||
    element.webkitRequestFullscreen ||
    element.mozRequestFullScreen ||
    element.msRequestFullscreen;

  if (!method) return false;

  try {
    await method.call(element);
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen() {
  if (!getFullscreenElement()) return false;

  const method =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;

  if (!method) return false;

  try {
    await method.call(document);
    return true;
  } catch {
    return false;
  }
}

/** Ask the parent page (e.g. WordPress) to fullscreen this iframe. */
export function requestParentIframeFullscreen() {
  if (!isInIframe()) return false;

  try {
    window.parent.postMessage({ type: 'simple-stream-request-fullscreen' }, '*');
    return true;
  } catch {
    return false;
  }
}

/** Open embed in a new tab. `fs=1` enables dedicated fullscreen-friendly layout. */
export function openEmbedInNewTab(fullscreenMode = false) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (fullscreenMode) {
    url.searchParams.set('fs', '1');
    url.searchParams.set('chat', '0');
  }
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

const PARENT_FS_WAIT_MS = 350;

/**
 * Enter or exit fullscreen. In WordPress iframes, falls back to opening a new tab.
 */
export async function toggleFullscreen({ container, video, iframe, preferNewTab = false } = {}) {
  if (getFullscreenElement()) {
    await exitFullscreen();
    return 'exited';
  }

  if (preferNewTab) {
    openEmbedInNewTab(true);
    return 'newtab';
  }

  if (video?.webkitEnterFullscreen) {
    try {
      video.webkitEnterFullscreen();
      return 'native';
    } catch {
      // continue
    }
  }

  const nativeTargets = [video, container, document.documentElement, iframe].filter(Boolean);
  for (const target of nativeTargets) {
    if (await requestElementFullscreen(target)) {
      return 'native';
    }
  }

  if (isInIframe()) {
    requestParentIframeFullscreen();
    await new Promise((resolve) => setTimeout(resolve, PARENT_FS_WAIT_MS));
    if (getFullscreenElement()) {
      return 'parent';
    }
    openEmbedInNewTab(true);
    return 'newtab';
  }

  return 'failed';
}

export function subscribeFullscreenChange(handler) {
  const events = [
    'fullscreenchange',
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'MSFullscreenChange',
  ];

  events.forEach((event) => document.addEventListener(event, handler));
  return () => events.forEach((event) => document.removeEventListener(event, handler));
}