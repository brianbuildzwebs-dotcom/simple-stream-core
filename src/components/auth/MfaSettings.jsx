import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  buildTotpUri,
  clearUnverifiedTotpFactors,
  createMfaQrDataUrl,
  formatTotpSecret,
  getUnverifiedTotpFactors,
  getVerifiedTotpFactor,
  formatMfaError,
  listTotpFactors,
  verifyTotpCode,
} from '@/lib/mfa';
import { toast } from '@/components/ui/use-toast';

export default function MfaSettings({ emphasizeAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState(null);
  const [pendingFactors, setPendingFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qrPng, setQrPng] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadFactors = useCallback(async () => {
    setLoading(true);
    try {
      const factors = await listTotpFactors();
      setVerifiedFactor(getVerifiedTotpFactor(factors));
      setPendingFactors(getUnverifiedTotpFactors(factors));
    } catch (loadError) {
      toast({
        title: 'Could not load MFA status',
        description: formatMfaError(loadError),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const resetIncompleteSetup = async () => {
    setError('');
    setBusy(true);
    try {
      await clearUnverifiedTotpFactors();
      await loadFactors();
      toast({
        title: 'Incomplete MFA setup removed',
        description: 'You can enable authenticator app again.',
      });
    } catch (resetError) {
      setError(formatMfaError(resetError));
    } finally {
      setBusy(false);
    }
  };

  const startEnroll = async () => {
    setError('');
    setBusy(true);
    try {
      await clearUnverifiedTotpFactors();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Simple Streamz authenticator',
        issuer: 'Simple Streamz',
      });
      if (enrollError) throw enrollError;

      const totpUri =
        data.totp.uri ||
        buildTotpUri({
          secret: data.totp.secret,
          accountName: user?.email ?? 'account',
        });

      setFactorId(data.id);
      setSecret(data.totp.secret ?? '');
      setQrPng(await createMfaQrDataUrl(totpUri));
      setVerifyCode('');
      setEnrolling(true);
    } catch (enrollError) {
      setError(formatMfaError(enrollError));
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = () => {
    if (factorId) {
      void supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    }
    setEnrolling(false);
    setFactorId('');
    setQrPng('');
    setSecret('');
    setVerifyCode('');
    setError('');
    void loadFactors();
  };

  const completeEnroll = async () => {
    if (!factorId || verifyCode.length < 6) return;
    setError('');
    setBusy(true);
    try {
      await verifyTotpCode({ factorId, code: verifyCode });

      setEnrolling(false);
      setVerifyCode('');
      await loadFactors();
      toast({
        title: 'Two-factor authentication enabled',
        description: 'You will be asked for a code the next time you sign in.',
      });
    } catch (verifyError) {
      setError(formatMfaError(verifyError));
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async () => {
    if (!verifiedFactor) return;
    if (!window.confirm('Disable two-factor authentication for this account?')) return;

    setBusy(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });
      if (unenrollError) throw unenrollError;
      await loadFactors();
      toast({ title: 'Two-factor authentication disabled' });
    } catch (unenrollError) {
      toast({
        title: 'Could not disable MFA',
        description: unenrollError.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading security settings...
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          {verifiedFactor ? (
            <ShieldCheck className="w-4 h-4 text-green-400" />
          ) : (
            <Shield className="w-4 h-4 text-primary" />
          )}
          Two-factor authentication
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {verifiedFactor
            ? 'Your account requires a code from your authenticator app when you sign in.'
            : 'Add Google Authenticator, Microsoft Authenticator, or Authy. Requires TOTP enabled in Supabase Authentication → Multi-Factor.'}
        </p>
        {emphasizeAdmin && !verifiedFactor && (
          <p className="text-xs text-amber-300/90 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Recommended for administrator accounts.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {verifiedFactor && !enrolling && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
            Enabled
          </span>
          <Button variant="outline" size="sm" onClick={disableMfa} disabled={busy}>
            Disable MFA
          </Button>
        </div>
      )}

      {!verifiedFactor && pendingFactors.length > 0 && !enrolling && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 space-y-2">
          <p className="text-xs text-foreground">
            A previous MFA setup was started but not finished. Remove it before trying again.
          </p>
          <Button variant="outline" size="sm" onClick={resetIncompleteSetup} disabled={busy}>
            Remove incomplete setup
          </Button>
        </div>
      )}

      {!verifiedFactor && !enrolling && (
        <Button onClick={startEnroll} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            'Enable authenticator app'
          )}
        </Button>
      )}

      {enrolling && (
        <div className="space-y-4 rounded-xl border border-border/50 bg-secondary/20 p-4">
          <p className="text-sm text-foreground">
            1. Scan this QR code with Google Authenticator, Microsoft Authenticator, or Authy.
          </p>
          {qrPng ? (
            <div className="flex justify-center rounded-xl bg-white p-4 w-fit mx-auto shadow-sm">
              <img
                src={qrPng}
                alt="MFA QR code"
                width={280}
                height={280}
                className="block"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          ) : (
            <p className="text-xs text-amber-300/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              QR code is loading. If it does not appear, use the manual setup key below.
            </p>
          )}
          {secret && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                QR not scanning? In your authenticator app tap <strong className="text-foreground">Enter setup key</strong>,
                choose <strong className="text-foreground">Time based</strong>, and use:
              </p>
              <div className="rounded-lg bg-secondary/40 px-3 py-3 border border-border/50 space-y-2 text-xs">
                <p>
                  <span className="text-muted-foreground">Account:</span>{' '}
                  <span className="text-foreground">Simple Streamz</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Key:</span>{' '}
                  <span className="font-mono text-foreground break-all">{formatTotpSecret(secret)}</span>
                </p>
              </div>
            </div>
          )}
          <p className="text-sm text-foreground">2. Enter the 6-digit code from your app.</p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode} autoComplete="one-time-code">
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={completeEnroll} disabled={busy || verifyCode.length < 6}>
              {busy ? 'Verifying...' : 'Verify and enable'}
            </Button>
            <Button variant="outline" onClick={cancelEnroll} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}