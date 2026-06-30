import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { formatMfaError, listTotpFactors } from '@/lib/mfa';

export default function MfaChallenge({ onVerified }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [booting, setBooting] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    listTotpFactors()
      .then((factors) => {
        const verified = factors.find((factor) => factor.status === 'verified');
        if (!verified) {
          setError('No authenticator is enrolled for this account.');
          return;
        }
        setFactorId(verified.id);
      })
      .catch((bootError) => setError(formatMfaError(bootError)))
      .finally(() => setBooting(false));
  }, []);

  const handleVerify = async () => {
    if (!factorId || code.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;

      setRedirecting(true);
      await onVerified?.();
    } catch (verifyError) {
      setRedirecting(false);
      setError(formatMfaError(verifyError));
    } finally {
      setLoading(false);
    }
  };

  if (booting || redirecting) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        {redirecting ? (
          <p className="text-sm text-muted-foreground">Signed in — opening dashboard…</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Two-factor verification</h1>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode} autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button className="w-full h-11" onClick={handleVerify} disabled={loading || code.length < 6 || !factorId}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify and continue'
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Lost access to your authenticator?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in again
          </Link>
        </p>
      </div>
    </div>
  );
}