import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase, type Profile } from './supabase';

// Stale-while-revalidate cache for profiles.
// - useProfile(userId) returns cached data instantly (no loading flash) and
//   refetches in the background. Subscribers re-render only if the fetch
//   produces fresh data.
// - setCachedProfile(profile) writes through (used on self-update so the
//   logged-in user's modal never lags one fetch behind).

const cache = new Map<string, Profile>();
const subscribers = new Map<string, Set<() => void>>();
const inFlight = new Map<string, Promise<void>>();

function notify(userId: string) {
  subscribers.get(userId)?.forEach((cb) => cb());
}

function subscribe(userId: string, cb: () => void) {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) subscribers.delete(userId);
  };
}

function refresh(userId: string): Promise<void> {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error || !data) return;
      const fresh = data as Profile;
      // Only notify if anything actually changed — avoids needless re-renders.
      const prev = cache.get(userId);
      if (!prev || !shallowEqualProfile(prev, fresh)) {
        cache.set(userId, fresh);
        notify(userId);
      }
    } finally {
      inFlight.delete(userId);
    }
  })();

  inFlight.set(userId, p);
  return p;
}

function shallowEqualProfile(a: Profile, b: Profile): boolean {
  return (
    a.id === b.id &&
    a.username === b.username &&
    a.country_code === b.country_code &&
    a.avatar_url === b.avatar_url &&
    a.total_games === b.total_games &&
    a.wins === b.wins &&
    a.hands_played === b.hands_played &&
    a.hands_won === b.hands_won &&
    a.pots_won_total === b.pots_won_total &&
    a.biggest_pot_won === b.biggest_pot_won &&
    a.best_hand_rank === b.best_hand_rank &&
    a.best_hand_name === b.best_hand_name
  );
}

/** Write a known-fresh profile into the cache (e.g. after self-update). */
export function setCachedProfile(profile: Profile) {
  const prev = cache.get(profile.id);
  if (!prev || !shallowEqualProfile(prev, profile)) {
    cache.set(profile.id, profile);
    notify(profile.id);
  }
}

/**
 * Subscribe to a profile by id. Returns whatever's in the cache immediately
 * (possibly undefined on first ever view), then revalidates from the server
 * in the background. `loading` is only true on a true cold miss.
 */
export function useProfile(userId: string) {
  const profile = useSyncExternalStore(
    (cb) => subscribe(userId, cb),
    () => cache.get(userId),
    () => undefined,
  );

  const [loading, setLoading] = useState(() => !cache.has(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hadCache = cache.has(userId);
    setLoading(!hadCache);
    setError(null);

    refresh(userId).then(() => {
      if (cancelled) return;
      setLoading(false);
      if (!cache.has(userId)) setError('Could not load profile');
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading, error };
}
