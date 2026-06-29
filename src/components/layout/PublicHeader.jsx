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
        <div className="flex items-center min-w-0 shrink">
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

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors px-1.5 sm:px-2 whitespace-nowrap"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-3 sm:px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
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