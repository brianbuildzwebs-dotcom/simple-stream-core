import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, X } from 'lucide-react';
import { getVerifiedTotpFactor, listTotpFactors } from '@/lib/mfa';

const DISMISS_KEY = 'ssz-mfa-banner-dismissed';

export default function MfaEncourageBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    listTotpFactors()
      .then((factors) => {
        const verified = getVerifiedTotpFactor(factors);
        setVisible(!verified);
      })
      .catch(() => setVisible(false));
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-4 mt-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 flex items-start gap-3">
      <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium text-foreground">Protect your church dashboard</p>
        <p className="text-muted-foreground mt-0.5">
          Turn on two-factor authentication so only your team can manage streams and billing.
        </p>
        <Link
          to="/dashboard/profile"
          className="inline-block mt-2 text-primary font-medium hover:underline"
        >
          Set up MFA in Profile →
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setVisible(false);
        }}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss MFA reminder"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}