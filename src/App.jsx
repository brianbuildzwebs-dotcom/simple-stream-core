import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ScrollToTop from '@/components/ScrollToTop';
import AdminRoute from '@/components/AdminRoute';
import DashboardRoute from '@/components/DashboardRoute';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import PlayerLab from '@/pages/PlayerLab';
import Embed from '@/pages/Embed';
import Pricing from '@/pages/Pricing';
import Paywall from '@/pages/Paywall';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminSubscriptions from '@/pages/admin/AdminSubscriptions';
import AdminWhitelist from '@/pages/admin/AdminWhitelist';
import AdminModeration from '@/pages/admin/AdminModeration';
import AdminLegalAcceptance from '@/pages/admin/AdminLegalAcceptance';
import AdminSupport from '@/pages/admin/AdminSupport';
import AdminSuggestions from '@/pages/admin/AdminSuggestions';
import Dashboard from '@/pages/dashboard/Dashboard';
import StreamKeys from '@/pages/dashboard/StreamKeys';
import EmbedManager from '@/pages/dashboard/EmbedManager';
import Profile from '@/pages/dashboard/Profile';
import ChatModeration from '@/pages/dashboard/ChatModeration';
import Support from '@/pages/dashboard/Support';
import SuggestFeature from '@/pages/dashboard/SuggestFeature';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import AuthCallback from '@/pages/AuthCallback';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import PageNotFound from '@/lib/PageNotFound';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<PlayerLab />} />
        <Route path="/embed/c/:trackingCode" element={<Embed />} />
        <Route path="/embed" element={<Embed />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/paywall" element={<Paywall />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<DashboardRoute />}>
          <Route path="/dashboard" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="streams" element={<StreamKeys />} />
            <Route path="embeds" element={<EmbedManager />} />
            <Route path="profile" element={<Profile />} />
            <Route path="chat" element={<ChatModeration />} />
            <Route path="support" element={<Support />} />
            <Route path="suggest" element={<SuggestFeature />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="legal" element={<AdminLegalAcceptance />} />
            <Route path="whitelist" element={<AdminWhitelist />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="suggestions" element={<AdminSuggestions />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}