import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import AppLogo from '@/components/brand/AppLogo';

const NAV_LINKS = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#features', label: 'Features' },
  { to: '/pricing', label: 'Church plans' },
];

export default function PublicHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="border-b border-border/30 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center min-w-0 max-w-[42%] sm:max-w-[50%] md:max-w-none overflow-hidden pointer-events-auto">
          <AppLogo variant="icon" size="xs" asLink to="/" className="sm:hidden" />
          <AppLogo
            variant="full"
            size="sm"
            asLink
            to="/"
            className="hidden sm:inline-flex md:hidden max-h-14"
          />
          <AppLogo variant="full" size="2xl" asLink to="/" className="hidden md:inline-flex" />
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="relative z-10 flex items-center gap-2 sm:gap-3 shrink-0 touch-manipulation">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-colors whitespace-nowrap"
            >
              Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center justify-center min-h-11 px-3 sm:px-4 py-2.5 rounded-xl border border-border/60 bg-card/80 text-xs sm:text-sm font-medium text-foreground hover:bg-secondary/60 active:scale-[0.98] transition-colors whitespace-nowrap"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center min-h-11 px-3 sm:px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-colors whitespace-nowrap"
              >
                <span className="sm:hidden">Free trial</span>
                <span className="hidden sm:inline">Start Free Trial</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}