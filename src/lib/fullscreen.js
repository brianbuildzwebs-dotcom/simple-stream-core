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

/**
 * Enter or exit fullscreen with mobile Safari fallbacks (video.webkitEnterFullscreen).
 */
export async function toggleFullscreen({ container, video, iframe } = {}) {
  if (getFullscreenElement()) {
    await exitFullscreen();
    return true;
  }

  if (video?.webkitEnterFullscreen) {
    try {
      video.webkitEnterFullscreen();
      return true;
    } catch {
      // fall through to element fullscreen
    }
  }

  const target = iframe || video || container;
  return requestElementFullscreen(target);
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