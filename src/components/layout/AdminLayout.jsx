import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Globe,
  ArrowLeft,
  Shield,
  MessageSquare,
  FileCheck,
} from 'lucide-react';

const ADMIN_NAV = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { path: '/admin/legal', label: 'Legal Acceptance', icon: FileCheck },
  { path: '/admin/whitelist', label: 'Domain Whitelist', icon: Globe },
];

export default function AdminLayout() {
  const location = useLocation();

  const isActive = (path, exact) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-56 flex flex-col border-r border-border/50 bg-card shrink-0">
        <div className="flex items-center gap-3 p-4 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground font-heading text-sm">Admin Panel</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                isActive(item.path, item.exact)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          <Link
            to="/admin/moderation"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              location.pathname.startsWith('/admin/moderation')
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            Chat Moderation
          </Link>
        </nav>
        <div className="p-3 border-t border-border/50">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}