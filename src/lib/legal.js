import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand';

export const LEGAL_VERSION = '2026-06-19';
export const TERMS_LAST_UPDATED = 'June 19, 2026';
export const PRIVACY_LAST_UPDATED = 'June 19, 2026';

export const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of these Terms',
    body: [
      'These Terms of Use ("Terms") govern your access to and use of ' +
        APP_NAME +
        ' (the "Service"). By creating an account, starting a free trial, or using the Service, you agree to these Terms and our Privacy Policy.',
      'If you do not agree, do not create an account or use the Service.',
    ],
  },
  {
    title: '2. The Service',
    body: [
      APP_NAME +
        ' provides live and on-demand video streaming tools, including RTMP ingest, embeddable players, chat, and related hosting features. We may change, suspend, or discontinue features at any time.',
      'We do not produce, edit, or control the content you stream through the Service.',
    ],
  },
  {
    title: '3. Your responsibility for streamed content',
    body: [
      'You are solely responsible for all video, audio, images, text, music, and other material you stream, upload, embed, or make available through the Service ("Your Content").',
      'You represent that you own Your Content or have all rights, licenses, and permissions needed to stream and distribute it, including public performance, synchronization, and rebroadcast rights where applicable.',
      APP_NAME +
        ' is a technology platform. We do not review or approve Your Content before it goes live. You are responsible for what you broadcast, not ' +
        APP_NAME +
        '.',
    ],
  },
  {
    title: '4. Copyright and intellectual property',
    body: [
      'You may not use the Service to infringe copyrights, trademarks, or other intellectual property rights.',
      'If you stream copyrighted material without authorization, including music, sermons, films, sports, or third-party broadcasts, you do so at your own risk.',
      APP_NAME +
        ' does not assume liability for copyright infringement committed by users. To the fullest extent permitted by law, we disclaim responsibility for Your Content and any claims arising from it.',
      'If we receive a valid copyright complaint or become aware of unauthorized use, we may remove content, disable streams, suspend accounts, or terminate access. Repeat infringers may be permanently banned.',
      'Copyright notices may be sent to ' + SUPPORT_EMAIL + '. Include sufficient detail for us to locate the material and contact the account holder.',
    ],
  },
  {
    title: '5. Prohibited uses',
    body: [
      'You agree not to use the Service to:',
      'Stream content you do not have the right to distribute',
      'Harass, threaten, defame, or endanger others',
      'Distribute malware, spam, or unlawful material',
      'Attempt to bypass security, quotas, billing, or access controls',
      'Resell or sublicense the Service except as expressly allowed by your plan',
    ],
  },
  {
    title: '6. Accounts, trials, and billing',
    body: [
      'You must provide accurate registration information and keep your credentials secure.',
      'Free trials and paid plans are described on our Pricing page. Fees are billed through our payment provider unless you are on an Enterprise arrangement.',
      'We may limit trials or accounts to prevent abuse, including duplicate free trials from the same person, household, or organization.',
    ],
  },
  {
    title: '7. Disclaimer of warranties',
    body: [
      'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, ' +
        APP_NAME.toUpperCase() +
        ' DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
      'We do not guarantee uninterrupted, error-free, or perfectly synchronized streams.',
    ],
  },
  {
    title: '8. Limitation of liability',
    body: [
      'TO THE FULLEST EXTENT PERMITTED BY LAW, ' +
        APP_NAME.toUpperCase() +
        ' AND ITS OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING FROM YOUR USE OF THE SERVICE OR YOUR CONTENT.',
      'Our total liability for any claim relating to the Service will not exceed the greater of (a) the amount you paid us in the twelve months before the claim or (b) fifty U.S. dollars ($50).',
    ],
  },
  {
    title: '9. Indemnification',
    body: [
      'You agree to defend, indemnify, and hold harmless ' +
        APP_NAME +
        ' and its operators from claims, damages, losses, and expenses (including reasonable legal fees) arising from Your Content, your streaming activity, your violation of these Terms, or your violation of any law or third-party right.',
    ],
  },
  {
    title: '10. Termination',
    body: [
      'You may stop using the Service at any time. We may suspend or terminate your account if you violate these Terms, create risk for us or other users, or as required by law.',
      'Sections that by their nature should survive termination, including content responsibility, disclaimers, limitation of liability, and indemnification, will survive.',
    ],
  },
  {
    title: '11. Changes',
    body: [
      'We may update these Terms from time to time. We will post the revised Terms with a new "Last updated" date. Material changes may require renewed acceptance before continued use of the Service.',
    ],
  },
  {
    title: '12. Contact',
    body: ['Questions about these Terms: ' + SUPPORT_EMAIL],
  },
];

export const PRIVACY_SECTIONS = [
  {
    title: '1. Overview',
    body: [
      'This Privacy Policy explains how ' +
        APP_NAME +
        ' ("we," "us") collects, uses, and shares information when you use our website, dashboard, embed players, and related services.',
    ],
  },
  {
    title: '2. Information we collect',
    body: [
      'Account information: email address, authentication identifiers, and profile details you provide.',
      'Billing information: processed by our payment provider (for example, Stripe). We do not store full payment card numbers on our servers.',
      'Usage information: stream keys created, embed views, chat messages, moderation actions, and product settings needed to operate the Service.',
      'Technical information: IP address, browser type, device information, and logs used for security, abuse prevention, and troubleshooting.',
      'Chat display names and messages submitted by viewers on embed players.',
    ],
  },
  {
    title: '3. How we use information',
    body: [
      'Provide, secure, and improve the Service',
      'Authenticate users and enforce plan limits',
      'Process subscriptions and support requests',
      'Detect abuse, including duplicate free trials or policy violations',
      'Comply with law and respond to lawful requests',
    ],
  },
  {
    title: '4. How we share information',
    body: [
      'We use service providers that help us run the Service, such as hosting, database, streaming, analytics, and payment processors. They process data only to perform services for us.',
      'We may disclose information if required by law, to protect rights and safety, or in connection with a merger or sale of assets.',
      'We do not sell your personal information.',
    ],
  },
  {
    title: '5. Cookies and local storage',
    body: [
      'We use cookies and browser storage for sign-in sessions, preferences, and chat display names on embeds.',
      'You can control cookies through your browser settings, but some features may not work without them.',
    ],
  },
  {
    title: '6. Data retention',
    body: [
      'We retain account and billing records as long as your account is active and as needed for legal, tax, and security obligations.',
      'When you accept our Terms of Use and Privacy Policy, we record a compliance audit entry that includes the document versions accepted, the time of acceptance, a one-way hash of your email address, a hash of your IP address, and a truncated browser identifier. This record is kept to demonstrate lawful consent and to defend legal claims.',
      'If you delete your account, we remove your profile and authentication data, but we retain the compliance audit entry in anonymized form (without your user ID) for up to seven (7) years, or longer if required by law.',
      'Chat messages and operational logs may be retained for moderation and service reliability, then deleted or anonymized according to our retention practices.',
    ],
  },
  {
    title: '7. Your choices',
    body: [
      'You may update profile information in the dashboard.',
      'You may request account deletion from your Profile settings, subject to legal retention requirements.',
      'Viewers can clear locally stored chat display names by clearing site data in their browser.',
    ],
  },
  {
    title: '8. Children',
    body: [
      'The Service is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
    ],
  },
  {
    title: '9. Security',
    body: [
      'We use reasonable administrative, technical, and organizational safeguards. No method of transmission or storage is completely secure.',
    ],
  },
  {
    title: '10. Changes',
    body: [
      'We may update this Privacy Policy from time to time. We will post the revised policy with a new "Last updated" date.',
    ],
  },
  {
    title: '11. Contact',
    body: ['Privacy questions: ' + SUPPORT_EMAIL],
  },
];