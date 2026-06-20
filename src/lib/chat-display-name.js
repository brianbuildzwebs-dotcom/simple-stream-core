export const CHAT_DISPLAY_NAME_KEY = 'simple-streamz-chat-display-name';
export const CHAT_DISPLAY_NAME_MIN = 2;
export const CHAT_DISPLAY_NAME_MAX = 24;

export function normalizeChatDisplayName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_DISPLAY_NAME_MAX);
}

export function isValidChatDisplayName(value) {
  const normalized = normalizeChatDisplayName(value);
  return normalized.length >= CHAT_DISPLAY_NAME_MIN;
}

export function loadChatDisplayName() {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeChatDisplayName(window.localStorage.getItem(CHAT_DISPLAY_NAME_KEY));
  } catch {
    return '';
  }
}

export function saveChatDisplayName(value) {
  const normalized = normalizeChatDisplayName(value);
  if (!isValidChatDisplayName(normalized)) return '';
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CHAT_DISPLAY_NAME_KEY, normalized);
    } catch {
      // ignore storage failures
    }
  }
  return normalized;
}