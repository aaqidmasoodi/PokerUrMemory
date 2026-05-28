import { useEffect, useState } from 'react';
import { X, Trophy, Coins, Flame, Award } from 'lucide-react';
import { supabase, type Profile } from '../lib/supabase';
import { getCountryName, getFlagEmoji } from '../lib/countries';
import { Avatar } from './Avatar';

// Indexed by handEvaluator.js rank (0..9). Kept in sync with the server side.
const HAND_RANK_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush',
];

export function PlayerStatsModal({
  userId,
  fallbackName,
  fallbackAvatarUrl,
  onClose,
}: {
  userId: string;
  fallbackName?: string;
  fallbackAvatarUrl?: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError('Could not load profile');
        else setProfile(data as Profile);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const name = profile?.username ?? fallbackName ?? 'Player';
  const avatarUrl = profile?.avatar_url ?? fallbackAvatarUrl ?? null;
  const winRate = profile && profile.total_games > 0
    ? Math.round((profile.wins / profile.total_games) * 100)
    : 0;
  const handWinRate = profile && profile.hands_played > 0
    ? Math.round((profile.hands_won / profile.hands_played) * 100)
    : 0;
  const bestHandText = profile && profile.best_hand_rank >= 0
    ? (profile.best_hand_name ?? HAND_RANK_NAMES[profile.best_hand_rank] ?? '—')
    : '—';

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] rounded-3xl overflow-hidden border border-[color:var(--color-gold)]/30 shadow-2xl
                   bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-3 flex items-start gap-4">
          <div className="p-[2px] rounded-full bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] shadow-[0_0_24px_rgba(212,168,67,0.25)]">
            <div className="p-0.5 rounded-full bg-[oklch(0.22_0.06_148)]">
              <Avatar url={avatarUrl} name={name} size="md" className="w-16 h-16 text-xl" />
            </div>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="font-display text-lg font-bold text-white truncate leading-tight">
              {name}
            </p>
            {profile?.country_code && (
              <p className="text-[11px] text-white/50 mt-0.5 flex items-center gap-1.5">
                <span>{getFlagEmoji(profile.country_code)}</span>
                <span className="truncate">{getCountryName(profile.country_code) ?? profile.country_code}</span>
              </p>
            )}
            <p className="text-[9px] text-white/30 tracking-widest uppercase mt-1.5">Player Stats</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          {loading && (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-white/20 border-t-[color:var(--color-gold)] rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <p className="text-[12px] text-red-300 text-center py-6">{error}</p>
          )}
          {profile && !loading && !error && (
            <>
              {/* Primary row — game-level */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <StatTile label="Games" value={profile.total_games} />
                <StatTile label="Wins" value={profile.wins} />
                <StatTile label="Win Rate" value={`${winRate}%`} />
              </div>

              {/* Secondary row — hand-level */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <StatTile label="Hands" value={profile.hands_played} />
                <StatTile label="Hand Wins" value={profile.hands_won} />
                <StatTile label="Hand %" value={`${handWinRate}%`} />
              </div>

              {/* Highlight row — totals */}
              <div className="flex flex-col gap-2">
                <HighlightRow
                  icon={<Coins className="w-3.5 h-3.5" />}
                  label="Points Won"
                  value={`${profile.pots_won_total.toLocaleString()}pts`}
                />
                <HighlightRow
                  icon={<Flame className="w-3.5 h-3.5" />}
                  label="Biggest Pot"
                  value={`${profile.biggest_pot_won.toLocaleString()}pts`}
                />
                <HighlightRow
                  icon={profile.best_hand_rank >= 7
                    ? <Trophy className="w-3.5 h-3.5" />
                    : <Award className="w-3.5 h-3.5" />
                  }
                  label="Best Hand"
                  value={bestHandText}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center bg-white/[0.07] border border-white/10 rounded-2xl py-2.5 backdrop-blur-sm">
      <span className="font-display text-lg font-bold text-white leading-tight tabular-nums">{value}</span>
      <span className="text-[8px] text-white/40 tracking-widest uppercase mt-0.5">{label}</span>
    </div>
  );
}

function HighlightRow({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5">
      <div className="w-7 h-7 rounded-lg bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] grid place-items-center shrink-0">
        {icon}
      </div>
      <span className="text-[10px] text-white/50 tracking-widest uppercase font-display font-semibold">
        {label}
      </span>
      <span className="ml-auto text-[13px] font-bold text-white tabular-nums">
        {value}
      </span>
    </div>
  );
}
