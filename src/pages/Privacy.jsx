import React from 'react';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS } from '@/lib/legal';

export default function Privacy() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      lastUpdated={PRIVACY_LAST_UPDATED}
      sections={PRIVACY_SECTIONS}
      alternate={{ to: '/terms', label: 'Terms of Use' }}
    />
  );
}