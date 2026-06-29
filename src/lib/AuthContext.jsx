import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureLegalAcceptanceRecorded } from '@/lib/terms-acceptance';

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Profile fetch failed:', error.message);
    return null;
  }
  return data;
}

function mapUser(authUser, profile) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    role: profile?.role ?? authUser.user_metadata?.role ?? 'viewer',
    full_name:
      profile?.full_name ??
      authUser.user_metadata?.full_name ??
      authUser.email?.split('@')[0] ??
      'User',
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const applySession = useCallback(async (session) => {
    if (session?.user) {
      const profileData = await fetchProfile(session.user.id);
      setProfile(profileData);
      setUser(mapUser(session.user, profileData));
      setIsAuthenticated(true);
      void ensureLegalAcceptanceRecorded(session.user).catch(() => {});
    } else {
      setProfile(null);
      setUser(null);
      setIsAuthenticated(false);
    }
    setAuthChecked(true);
    setIsLoadingAuth(false);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      await applySession(session);
    } catch (error) {
      console.error('Auth check failed:', error);
      setProfile(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'unknown', message: error.message || 'Authentication failed' });
      setAuthChecked(true);
      setIsLoadingAuth(false);
    }
  }, [applySession]);

  useEffect(() => {
    checkUserAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await applySession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [checkUserAuth, applySession]);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};