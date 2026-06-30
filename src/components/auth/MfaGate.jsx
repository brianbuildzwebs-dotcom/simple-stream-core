import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMfaAssuranceLevel, needsMfaChallenge } from '@/lib/mfa';
import MfaChallenge from '@/components/auth/MfaChallenge';
import { Button } from '@/components/ui/button';
import { withTimeout } from '@/lib/with-timeout';

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

export default function MfaGate({ children }) {
  const [status, setStatus] = useState('loading');
  const [gateError, setGateError] = useState('');

  const refresh = useCallback(async () => {
    setGateError('');
    setStatus('loading');
    try {
      const level = await withTimeout(
        getMfaAssuranceLevel(),
        10000,
        'Security check timed out. Check your connection and try again.'
      );
      setStatus(needsMfaChallenge(level) ? 'challenge' : 'ready');
    } catch (error) {
      setGateError(error.message || 'Security check failed');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (status === 'loading') return <Loading />;

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-8 space-y-4 text-center">
          <p className="text-sm text-destructive">{gateError}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={refresh}>Retry security check</Button>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Sign in again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'challenge') {
    return <MfaChallenge onVerified={() => refresh()} />;
  }

  return children;
}