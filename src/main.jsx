import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AppProviders from './app/providers.jsx';
import { initSentry, Sentry } from '@/lib/sentry';
import './index.css';

initSentry();

function SentryFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please refresh the page.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <AppProviders>
        <App />
      </AppProviders>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);