import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ScrollToTop from '@/components/ScrollToTop';
import AdminRoute from '@/components/AdminRoute';
import DashboardRoute from '@/components/DashboardRoute';

const Home = lazy(() => import('@/pages/Home'));
const PlayerLab = lazy(() => import('@/pages/PlayerLab'));
const Embed = lazy(() => import('@/pages/Embed'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Paywall = lazy(() => import('@/pages/Paywall'));
const Terms = lazy(() => import('@/pages/Terms'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout'));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
const StreamKeys = lazy(() => import('@/pages/dashboard/StreamKeys'));
const SermonLibrary = lazy(() => import('@/pages/dashboard/SermonLibrary'));
const EmbedManager = lazy(() => import('@/pages/dashboard/EmbedManager'));
const Profile = lazy(() => import('@/pages/dashboard/Profile'));
const ChatModeration = lazy(() => import('@/pages/dashboard/ChatModeration'));
const Support = lazy(() => import('@/pages/dashboard/Support'));
const SuggestFeature = lazy(() => import('@/pages/dashboard/SuggestFeature'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions'));
const AdminWhitelist = lazy(() => import('@/pages/admin/AdminWhitelist'));
const AdminModeration = lazy(() => import('@/pages/admin/AdminModeration'));
const AdminLegalAcceptance = lazy(() => import('@/pages/admin/AdminLegalAcceptance'));
const AdminSupport = lazy(() => import('@/pages/admin/AdminSupport'));
const AdminSuggestions = lazy(() => import('@/pages/admin/AdminSuggestions'));
const PageNotFound = lazy(() => import('@/lib/PageNotFound'));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
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
              <Route path="sermons" element={<SermonLibrary />} />
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
      </Suspense>
    </>
  );
}