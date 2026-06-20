import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Tv } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { APP_NAME } from '@/lib/brand';

const NAV_LINKS = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#features', label: 'Features' },
  { to: '/pricing', label: 'Church plans' },
];

export default function PublicHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="border-b border-border/30 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Tv className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground font-heading">{APP_NAME}</span>
        </Link>

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

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Start Free Trial
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}