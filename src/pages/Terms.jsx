import React from 'react';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '@/lib/legal';

export default function Terms() {
  return (
    <LegalDocumentPage
      title="Terms of Use"
      lastUpdated={TERMS_LAST_UPDATED}
      sections={TERMS_SECTIONS}
      alternate={{ to: '/privacy', label: 'Privacy Policy' }}
    />
  );
}