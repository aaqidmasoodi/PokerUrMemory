import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '../lib/supabase';

export type CheckInData = {
  is_new_today: boolean;
  checkin_streak: number;
  longest_checkin_streak: number;
  cycle_day: number;
  xp_earned: number;
  total_xp: number;
};

// Calls claim_daily_checkin() once when the user is ready, and again whenever the
// app is resumed from the background (so a player who keeps the app open across
// midnight still gets their reward). The RPC is idempotent + server-date-driven,
// so calling it repeatedly is cheap and unspoofable — a same-day call just returns
// is_new_today=false and we stay quiet.
export function useDailyCheckIn(userId: string | null | undefined, onClaimed?: () => void) {
  const [data, setData] = useState<CheckInData | null>(null);
  const [open, setOpen] = useState(false);
  const onClaimedRef = useRef(onClaimed);
  onClaimedRef.current = onClaimed;

  const runClaim = useCallback(async () => {
    const { data: res, error } = await supabase.rpc('claim_daily_checkin');
    if (error) {
      console.error('[checkin] claim failed:', error.message);
      return;
    }
    const d = res as CheckInData;
    setData(d);
    if (d.is_new_today) {
      setOpen(true);
      onClaimedRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    runClaim();

    if (!Capacitor.isNativePlatform()) return;
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) runClaim();
    });
    return () => { handle.then((h) => h.remove()); };
  }, [userId, runClaim]);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return { data, open, openModal, closeModal };
}
