import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';

export type AuthState = 'loading' | 'landing' | 'onboarding' | 'ready';

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
      async (event, session) => {
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

  async function signInWithGoogle() {
    // Use the current origin so it works on any port (dev or prod)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
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
    return null;
  }

  return { authState, user, profile, signInWithGoogle, signOut, createProfile, updateProfile };
}
