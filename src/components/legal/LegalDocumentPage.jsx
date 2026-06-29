import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PublicHeader from '@/components/layout/PublicHeader';
import { APP_NAME } from '@/lib/brand';
import usePageMeta from '@/hooks/usePageMeta';

export default function LegalDocumentPage({ title, lastUpdated, sections, alternate }) {
  const location = useLocation();

  usePageMeta({
    title: `${title} — ${APP_NAME}`,
    description: `${title} for ${APP_NAME}, church live streaming on your website.`,
    path: location.pathname,
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="mb-8">
          <p className="text-sm text-primary font-medium">{APP_NAME}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold font-heading text-foreground">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          {alternate ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Also see{' '}
              <Link to={alternate.to} className="text-primary hover:underline">
                {alternate.label}
              </Link>
              .
            </p>
          ) : null}
        </div>

        <div className="space-y-8 rounded-2xl border border-border/50 bg-card p-6 sm:p-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground leading-relaxed">
          This document is provided for operational clarity before launch. It is not legal advice.
          Have a qualified attorney review these policies for your business before relying on them in
          court or regulatory matters.
        </p>
      </main>
    </div>
  );
}