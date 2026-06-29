import { DEFAULT_LAUNCH_OFFER, DEFAULT_SIMULCAST } from '@/lib/launch-config';

export async function fetchLaunchConfig() {
  try {
    const response = await fetch('/api/platform/launch');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to load launch config');
    }
    return {
      launchOffer: payload.launchOffer ?? DEFAULT_LAUNCH_OFFER,
      simulcast: payload.simulcast ?? DEFAULT_SIMULCAST,
    };
  } catch {
    return {
      launchOffer: DEFAULT_LAUNCH_OFFER,
      simulcast: DEFAULT_SIMULCAST,
    };
  }
}