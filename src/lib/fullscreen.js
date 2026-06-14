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

/** Ask the parent page (e.g. WordPress) to fullscreen this iframe. Parent must listen for the message. */
export function requestParentIframeFullscreen() {
  if (!isInIframe()) return false;

  try {
    window.parent.postMessage({ type: 'simple-stream-request-fullscreen' }, '*');
    return true;
  } catch {
    return false;
  }
}

/** Open the embed page in a new browser tab — works when iframe fullscreen is blocked. */
export function openEmbedInNewTab() {
  if (typeof window === 'undefined') return;
  window.open(window.location.href, '_blank', 'noopener,noreferrer');
}

const PARENT_FS_WAIT_MS = 400;

/**
 * Enter or exit fullscreen with mobile / WordPress iframe fallbacks.
 * Returns: 'exited' | 'native' | 'parent' | 'pseudo' | 'failed'
 */
export async function toggleFullscreen({
  container,
  video,
  iframe,
  isPseudoExpanded = false,
  onPseudoExpandedChange,
} = {}) {
  if (getFullscreenElement() || isPseudoExpanded) {
    await exitFullscreen();
    onPseudoExpandedChange?.(false);
    return 'exited';
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
  }

  onPseudoExpandedChange?.(true);
  return 'pseudo';
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