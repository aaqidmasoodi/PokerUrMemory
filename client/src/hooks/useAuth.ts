import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase, type Profile } from '../lib/supabase';
import { setCachedProfile } from '../lib/profileCache';

export type AuthState = 'loading' | 'landing' | 'onboarding' | 'ready';

// On native (Capacitor) the app is served from https://localhost, which Google can't
// redirect back to. Instead we redirect to a custom scheme that Android routes back
// into the app, where the appUrlOpen listener below picks up the tokens.
const isNative = Capacitor.isNativePlatform();
const NATIVE_REDIRECT = 'com.pokerurmemory.app://login-callback';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function fetchProfile(userId: string): Promise<boolean> {
    // Verify the session has a valid access token before hitting the DB
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[fetchProfile] no access token — skipping');
      setAuthState('landing');
      return false;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      setCachedProfile(data);
      setAuthState('ready');
      return true;
    }

    // PGRST116 = no rows returned (profile doesn't exist yet — show onboarding)
    if (error && error.code !== 'PGRST116') {
      console.error('[fetchProfile] unexpected error:', error.code, error.message);
    }
    setAuthState('onboarding');
    return false;
  }

  useEffect(() => {
    let lastUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Guard before any setState — prevents re-renders from duplicate events
          // (Supabase fires both SIGNED_IN and INITIAL_SESSION on every page load)
          if (session.user.id === lastUserId) return;
          lastUserId = session.user.id;
          setUser(session.user);
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          lastUserId = null;
          setUser(null);
          setProfile(null);
          setAuthState('landing');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Native deep-link handler: Google sends tokens back via the custom scheme.
  // Supabase PKCE flow: com.pokerurmemory.app://login-callback?code=…
  // Implicit fallback:  com.pokerurmemory.app://login-callback#access_token=…
  useEffect(() => {
    if (!isNative) return;
    const handle = App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT)) return;
      Browser.close().catch(() => {});

      // PKCE: exchange the authorization code for a session
      const code = new URL(url).searchParams.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }

      // Implicit fallback: tokens directly in the hash
      const hash = url.split('#')[1];
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    });
    return () => { handle.then((h) => h.remove()); };
  }, []);

  async function signInWithGoogle() {
    if (isNative) {
      // Get the provider URL without auto-redirecting, then open it in the system
      // browser (Custom Tab) — Google blocks OAuth inside embedded WebViews.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        console.error('[signInWithGoogle] failed to start OAuth:', error?.message);
        return;
      }
      await Browser.open({ url: data.url });
      return;
    }

    // Web / PWA: full-page redirect back to the current origin (implicit flow,
    // detectSessionInUrl picks up the hash on return). Works on any port.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithFacebook() {
    if (isNative) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        console.error('[signInWithFacebook] failed to start OAuth:', error?.message);
        return;
      }
      await Browser.open({ url: data.url });
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function createProfile(username: string, countryCode: string) {
    if (!user) return 'Not authenticated';
    const avatarUrl = (user.user_metadata?.avatar_url as string) ?? null;
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: user.id, username, country_code: countryCode || null, avatar_url: avatarUrl })
      .select()
      .single();

    if (error) return error.message;
    setProfile(data);
    setCachedProfile(data);
    setAuthState('ready');
    return null;
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'username' | 'country_code'>>) {
    if (!user) return 'Not authenticated';
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) return error.message;
    setProfile(data);
    setCachedProfile(data);
    return null;
  }

  return { authState, user, profile, signInWithGoogle, signInWithFacebook, signOut, createProfile, updateProfile };
}
