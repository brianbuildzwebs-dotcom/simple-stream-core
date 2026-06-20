import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

export async function getMfaAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

export function needsMfaChallenge(level) {
  return level?.nextLevel === 'aal2' && level?.currentLevel !== 'aal2';
}

export async function listTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data?.totp ?? [];
}

export function getVerifiedTotpFactor(factors) {
  return (factors ?? []).find((factor) => factor.status === 'verified') ?? null;
}

export function getUnverifiedTotpFactors(factors) {
  return (factors ?? []).filter((factor) => factor.status !== 'verified');
}

export async function clearUnverifiedTotpFactors() {
  const factors = await listTotpFactors();
  const stale = getUnverifiedTotpFactors(factors);

  for (const factor of stale) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw error;
  }

  return stale.length;
}

export function normalizeQrCodeSrc(qrCode) {
  if (!qrCode) return '';

  // Supabase client may already prefix the SVG as a data URL.
  if (qrCode.startsWith('data:image')) {
    return qrCode;
  }

  if (qrCode.trim().startsWith('<svg')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
  }

  return qrCode;
}

const MFA_ISSUER = 'Simple Streamz';

export function buildTotpUri({ secret, accountName, issuer = MFA_ISSUER }) {
  if (!secret) return '';

  const normalizedSecret = secret.replace(/\s+/g, '');
  const label = encodeURIComponent(`${issuer}:${accountName || 'account'}`);
  const params = new URLSearchParams({
    secret: normalizedSecret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

export function formatTotpSecret(secret) {
  return (secret ?? '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

export async function createMfaQrDataUrl(uri) {
  if (!uri) return '';
  return QRCode.toDataURL(uri, {
    width: 320,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

export function extractQrSvgMarkup(qrCode) {
  if (!qrCode) return '';

  if (qrCode.trim().startsWith('<svg')) {
    return qrCode;
  }

  const prefixes = [
    'data:image/svg+xml;charset=utf-8,',
    'data:image/svg+xml;utf-8,',
  ];

  for (const prefix of prefixes) {
    if (qrCode.startsWith(prefix)) {
      try {
        return decodeURIComponent(qrCode.slice(prefix.length));
      } catch {
        return qrCode.slice(prefix.length);
      }
    }
  }

  return '';
}