export const EMBED_RESIZE_MESSAGE = 'simple-streamz:resize';
export const EMBED_REMEASURE_MESSAGE = 'simple-streamz:remeasure';
export const EMBED_MOBILE_MAX_WIDTH = 767;
export const EMBED_DESKTOP_CHAT_DOCK_HEIGHT = 260;
export const EMBED_MOBILE_CHAT_DOCK_HEIGHT = 340;

function getPhoneScreenEdge() {
  if (typeof window === 'undefined') return Number.POSITIVE_INFINITY;
  return Math.min(window.screen.width, window.screen.height);
}

export function isEmbedMobileViewport() {
  if (typeof window === 'undefined') return true;
  const phoneScreen = getPhoneScreenEdge() <= 520;
  const touchLike = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (touchLike && phoneScreen) return true;
  return window.innerWidth <= EMBED_MOBILE_MAX_WIDTH;
}

export function measureEmbedShellHeight(root, { chatDockOpen = false } = {}) {
  if (!root) return 0;

  const width = root.clientWidth || root.getBoundingClientRect().width || 0;
  const videoHeight = Math.max(0, Math.ceil((width * 9) / 16));

  if (!chatDockOpen) {
    return videoHeight;
  }

  const mobile = isEmbedMobileViewport();
  const chatHeight = mobile
    ? Math.min(EMBED_MOBILE_CHAT_DOCK_HEIGHT, Math.ceil((window.innerHeight || 600) * 0.52))
    : Math.min(EMBED_DESKTOP_CHAT_DOCK_HEIGHT, Math.ceil((window.innerHeight || 600) * 0.42));
  return videoHeight + chatHeight;
}

export function subscribeEmbedRemeasure(onRemeasure) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => {
    if (event.data?.type === EMBED_REMEASURE_MESSAGE) {
      onRemeasure();
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

let lastPostedKey = '';
let postTimer = null;

/** Tell the parent page how tall the iframe should be (requires listener in embed snippet). */
export function postEmbedHeight(height, { collapsed = false } = {}) {
  if (typeof window === 'undefined' || window.parent === window) return;

  const next = Math.max(120, Math.ceil(height));
  const stateKey = collapsed ? `collapsed:${next}` : `open:${next}`;

  if (stateKey === lastPostedKey) return;

  if (postTimer) window.clearTimeout(postTimer);
  postTimer = window.setTimeout(() => {
    postTimer = null;
    if (stateKey === lastPostedKey) return;
    lastPostedKey = stateKey;
    window.parent.postMessage(
      { type: EMBED_RESIZE_MESSAGE, height: next, collapsed },
      '*'
    );
  }, collapsed ? 60 : 180);
}

export function resetEmbedHeightState() {
  lastPostedKey = '';
  if (postTimer) {
    window.clearTimeout(postTimer);
    postTimer = null;
  }
}