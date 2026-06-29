import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { generateUuid } from '@/lib/uuid';

const SESSION_KEY = 'simple-streams-viewer-session';
let memorySessionId = null;

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = generateUuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    if (!memorySessionId) memorySessionId = generateUuid();
    return memorySessionId;
  }
}

/** Track concurrent viewers on this page via Supabase Realtime presence. */
export function useViewerPresence(active) {
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setViewerCount(0);
      return undefined;
    }

    const sessionId = getSessionId();
    const channel = supabase.channel('live-viewers', {
      config: { presence: { key: sessionId } },
    });

    const syncCount = () => {
      const state = channel.presenceState();
      setViewerCount(Object.keys(state).length);
    };

    channel
      .on('presence', { event: 'sync' }, syncCount)
      .on('presence', { event: 'join' }, syncCount)
      .on('presence', { event: 'leave' }, syncCount)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            joined_at: new Date().toISOString(),
            embed: window.self !== window.top,
          });
          syncCount();
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [active]);

  return viewerCount;
}