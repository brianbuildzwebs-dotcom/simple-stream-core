import React, { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve(window.turnstile);
        return;
      }
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve(window.turnstile);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function TurnstileWidget({ siteKey, onVerify, onExpire, onError, className = '' }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState('loading');

  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let cancelled = false;
    setStatus('loading');

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;

        if (widgetIdRef.current != null) {
          turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'flexible',
          callback: (token) => {
            setStatus('ready');
            onVerifyRef.current?.(token);
          },
          'expired-callback': () => {
            setStatus('ready');
            onExpireRef.current?.();
          },
          'error-callback': () => {
            setStatus('error');
            onErrorRef.current?.();
          },
        });
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div
      className={`relative w-full max-w-[304px] min-h-[65px] mx-auto ${className}`}
      aria-live="polite"
    >
      {status === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-border/40 bg-secondary/20 text-xs text-muted-foreground">
          Loading security check…
        </div>
      ) : null}
      <div ref={containerRef} className="min-h-[65px] w-full" />
    </div>
  );
}