import { useEffect, useState } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

/** Only require Turnstile when the Worker has TURNSTILE_SECRET_KEY configured. */
export function useTurnstileGate() {
  const [token, setToken] = useState('');
  const [serverEnabled, setServerEnabled] = useState(SITE_KEY ? null : false);

  useEffect(() => {
    if (!SITE_KEY) return undefined;

    let cancelled = false;
    fetch('/api/health')
      .then((response) => response.json())
      .then((health) => {
        if (!cancelled) setServerEnabled(Boolean(health.turnstile));
      })
      .catch(() => {
        if (!cancelled) setServerEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const required = Boolean(SITE_KEY) && serverEnabled === true;
  const ready = !required || Boolean(token);

  return {
    siteKey: SITE_KEY,
    required,
    ready,
    token,
    setToken,
    checking: Boolean(SITE_KEY) && serverEnabled === null,
  };
}