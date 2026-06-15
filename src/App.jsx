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
import AdminDashboard from '@/pages/AdminDashboard';
import Dashboard from '@/pages/dashboard/Dashboard';
import ComingSoon from '@/pages/dashboard/ComingSoon';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PageNotFound from '@/lib/PageNotFound';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<PlayerLab />} />
        <Route path="/embed" element={<Embed />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/paywall" element={<Paywall />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<DashboardRoute />}>
          <Route path="/dashboard" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route
              path="streams"
              element={
                <ComingSoon
                  title="Stream Keys"
                  description="RTMP key generation and Cloudflare Stream integration ship in Phase 2."
                />
              }
            />
            <Route
              path="embeds"
              element={
                <ComingSoon
                  title="Embed Manager"
                  description="Tracked embed codes pointing at the Simple Streamz player ship in Phase 2."
                />
              }
            />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}