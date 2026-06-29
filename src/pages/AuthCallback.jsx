import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ensureLegalAcceptanceRecorded } from '@/lib/terms-acceptance';

function clearCallbackUrl() {
  window.history.replaceState({}, document.title, '/auth/callback');
}

async function goToDashboard(session) {
  clearCallbackUrl();
  if (session?.user) {
    try {
      await ensureLegalAcceptanceRecorded(session.user);
    } catch {
      // Dashboard still loads; AuthContext will retry audit sync on next session.
    }
  }
  window.location.href = `${window.location.origin}/dashboard`;
}

export default function AuthCallback() {
  const [error, setError] = useState('');
  const [showContinue, setShowContinue] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const redirectIfReady = async () => {
      if (redirectedRef.current || cancelled) return true;

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(sessionError.message);
        return true;
      }

      if (session?.user) {
        redirectedRef.current = true;
        goToDashboard(session);
        return true;
      }

      return false;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !redirectedRef.current && !cancelled) {
        redirectedRef.current = true;
        goToDashboard(session);
      }
    });

    const poll = window.setInterval(() => {
      void redirectIfReady();
    }, 400);

    const continueTimer = window.setTimeout(() => {
      if (!cancelled && !redirectedRef.current) {
        setShowContinue(true);
      }
    }, 2500);

    const timeoutTimer = window.setTimeout(async () => {
      if (cancelled || redirectedRef.current) return;
      if (await redirectIfReady()) return;
      setError('Sign-in is taking longer than expected. Try Continue to dashboard, or log in again.');
    }, 15000);

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const oauthError =
        params.get('error_description') || params.get('error') || hashParams.get('error_description');

      if (oauthError) {
        setError(decodeURIComponent(oauthError.replace(/\+/g, ' ')));
        return;
      }

      if (await redirectIfReady()) return;

      const code = params.get('code');
      if (!code) return;

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (data?.session?.user) {
        redirectedRef.current = true;
        goToDashboard(data.session);
        return;
      }

      if (await redirectIfReady()) return;

      if (exchangeError) {
        const message = exchangeError.message || 'Sign-in failed';
        if (message.toLowerCase().includes('pkce')) {
          setError(
            'This sign-in link was already used or opened in a different browser. ' +
              'Use Login with your email and password, or start Google sign-in again.'
          );
        } else {
          setError(message);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(continueTimer);
      window.clearTimeout(timeoutTimer);
      subscription.unsubscribe();
    };
  }, []);

  const handleContinue = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      redirectedRef.current = true;
      goToDashboard(session);
      return;
    }
    window.location.href = `${window.location.origin}/dashboard`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-destructive text-sm">{error}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleContinue}>Continue to dashboard</Button>
            <Button variant="outline" asChild>
              <Link to="/login">Back to login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 text-muted-foreground px-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">Finishing sign-in...</p>
      {showContinue && (
        <Button variant="outline" onClick={handleContinue}>
          Continue to dashboard
        </Button>
      )}
    </div>
  );
}