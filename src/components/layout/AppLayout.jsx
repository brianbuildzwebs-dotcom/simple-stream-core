import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  Code2,
  Crown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Menu,
  MessageSquare,
  User,
  LifeBuoy,
  Lightbulb,
  Archive,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { isPlatformAdmin } from '@/lib/subscription';
import { hasPendingEnterpriseOffer } from '@/lib/enterprise';
import AppLogo from '@/components/brand/AppLogo';
import StreamAlertsBanner from '@/components/dashboard/StreamAlertsBanner';
import MfaEncourageBanner from '@/components/dashboard/MfaEncourageBanner';
import usePageMeta from '@/hooks/usePageMeta';
import { APP_NAME } from '@/lib/brand';

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/dashboard/streams', label: 'Stream Keys', icon: Radio },
  { path: '/dashboard/sermons', label: 'Sermon Library', icon: Archive },
  { path: '/dashboard/embeds', label: 'Embed Manager', icon: Code2 },
  { path: '/dashboard/chat', label: 'Chat Moderation', icon: MessageSquare },
  { path: '/dashboard/support', label: 'Support', icon: LifeBuoy },
  { path: '/dashboard/suggest', label: 'Suggest Feature', icon: Lightbulb },
  { path: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function AppLayout() {
  usePageMeta({
    title: `Dashboard — ${APP_NAME}`,
    description: `Manage church live streams, embeds, chat moderation, and sermon recordings in ${APP_NAME}.`,
    path: '/dashboard',
    noindex: true,
  });

  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { daysLeft, subscription, isPaid, planLabel, plan } = useSubscription(user);
  const enterpriseOfferPending = hasPendingEnterpriseOffer(subscription);
  const onProfilePage = location.pathname === '/dashboard/profile';

  const isActive = (path, exact) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const SidebarInner = () => (
    <>
      <div className="flex items-center justify-center px-2 py-6 border-b border-border/50 shrink-0">
        <AppLogo
          variant={collapsed ? 'icon' : 'full'}
          size={collapsed ? 'lg' : '2xl'}
          asLink
          to="/dashboard"
          className="w-full justify-center"
        />
      </div>

      {!collapsed && enterpriseOfferPending && !onProfilePage && (
        <Link
          to="/dashboard/profile"
          className="mx-3 mt-3 block px-3 py-2 rounded-lg text-xs font-medium border bg-amber-500/10 text-amber-200 border-amber-500/20 hover:bg-amber-500/15 transition-colors"
        >
          <p className="font-semibold text-foreground">Enterprise upgrade ready</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Review on Profile</p>
        </Link>
      )}

      {!collapsed && (isPaid || isPlatformAdmin(user, subscription)) && planLabel && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg text-xs font-medium border bg-green-500/10 text-green-300 border-green-500/20">
          <p className="font-semibold text-foreground">
            {planLabel} plan
            {isPlatformAdmin(user, subscription) && planLabel !== 'Admin' ? (
              <span className="text-[10px] text-muted-foreground font-normal"> · Admin</span>
            ) : null}
          </p>
          {plan?.monthly_price != null && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ${Number(plan.monthly_price).toFixed(2)}/mo
              {plan?.max_stream_keys ? ` · ${plan.max_stream_keys} stream keys` : ''}
            </p>
          )}
        </div>
      )}

      {!collapsed &&
        !isPlatformAdmin(user, subscription) &&
        !isPaid &&
        subscription?.trial_active &&
        daysLeft !== null &&
        daysLeft <= 7 && (
        <div
          className={`mx-3 mt-3 px-3 py-2 rounded-lg text-xs font-medium border ${
            daysLeft <= 2
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
          }`}
        >
          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in trial
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              isActive(item.path, item.exact)
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
        {user?.role === 'admin' && (
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              location.pathname.startsWith('/admin')
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </Link>
        )}
      </nav>

      <div className="p-3 border-t border-border/50 space-y-1 shrink-0">
        {!isPlatformAdmin(user, subscription) &&
          !isPaid &&
          subscription?.payment_status !== 'free_admin' && (
          <Link
            to="/pricing"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-yellow-400 hover:bg-yellow-400/10 transition-all"
          >
            <Crown className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Upgrade Plan</span>}
          </Link>
        )}
        <button
          type="button"
          onClick={() => logout('/')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-border/50 bg-card transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarInner />
      </aside>

      <aside
        className={`relative hidden lg:flex flex-col border-r border-border/50 bg-card transition-all duration-300 ${
          collapsed ? 'w-[4.5rem]' : 'w-72'
        }`}
      >
        <SidebarInner />
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card shrink-0">
          <button type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <AppLogo variant="icon" size="md" asLink to="/dashboard" />
          <span className="text-sm font-semibold text-foreground/90">Menu</span>
        </div>
        <main className="flex-1 overflow-auto">
          <MfaEncourageBanner />
          <StreamAlertsBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}