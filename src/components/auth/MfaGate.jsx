import React, { useCallback, useEffect, useState } from 'react';
import { getMfaAssuranceLevel, needsMfaChallenge } from '@/lib/mfa';
import MfaChallenge from '@/components/auth/MfaChallenge';

const Loading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

export default function MfaGate({ children }) {
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async () => {
    try {
      const level = await getMfaAssuranceLevel();
      setStatus(needsMfaChallenge(level) ? 'challenge' : 'ready');
    } catch {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (status === 'loading') return <Loading />;
  if (status === 'challenge') {
    return <MfaChallenge onVerified={() => refresh()} />;
  }

  return children;
}