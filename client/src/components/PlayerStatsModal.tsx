import { X, Trophy, Coins, Flame, Award } from 'lucide-react';
import { getCountryName, getFlagEmoji } from '../lib/countries';
import { useProfile } from '../lib/profileCache';
import { Avatar } from './Avatar';

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
  const { profile, loading, error } = useProfile(userId);

  // Loading and error are only visible when there's no cached data to show.
  // If we have a cached profile, the refetch happens silently in the background.
  const showLoading = !profile && loading;
  const showError = !profile && !!error;

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
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })
    : null;

  const allStats = profile ? [
    { label: 'Games', value: profile.total_games },
    { label: 'Wins', value: profile.wins },
    { label: 'Win %', value: `${winRate}%` },
    { label: 'Hands', value: profile.hands_played },
    { label: 'Hand W', value: profile.hands_won },
    { label: 'Hand %', value: `${handWinRate}%` },
  ] : [];

  const highlights = profile ? [
    { icon: <Coins className="w-3.5 h-3.5" />, label: 'Points Won', value: profile.pots_won_total.toLocaleString() },
    { icon: <Flame className="w-3.5 h-3.5" />, label: 'Biggest Pot', value: profile.biggest_pot_won.toLocaleString() },
    { icon: profile.best_hand_rank >= 7 ? <Trophy className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />, label: 'Best Hand', value: bestHandText },
  ] : [];

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 select-none"
      onClick={onClose}
    >
      {/* Outer wrapper: relative + overflow-visible so the X button can poke outside the card */}
      <div
        className="relative w-full max-w-[340px] landscape:max-w-[600px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — half outside the card top-right corner */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-20 w-9 h-9 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white shadow-lg transition-colors backdrop-blur-sm"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card */}
        <div
          className="w-full max-h-[95dvh] rounded-3xl overflow-hidden border border-[color:var(--color-gold)]/30 shadow-2xl
                     bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)]
                     flex flex-col landscape:flex-row"
        >

        {/* ── Identity section ── */}
        <div className="shrink-0 flex flex-col items-center gap-2 px-5 pt-5 pb-3
          landscape:w-[40%] landscape:py-4 landscape:px-4 landscape:gap-1.5
          landscape:border-r landscape:border-white/10 landscape:justify-center">

          <div className="p-[2px] rounded-full bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] shadow-[0_0_24px_rgba(212,168,67,0.25)]">
            <div className="p-0.5 rounded-full bg-[oklch(0.22_0.06_148)]">
              <div className="w-16 h-16 landscape:w-14 landscape:h-14">
                <Avatar url={avatarUrl} name={name} className="!w-full !h-full !text-xl" />
              </div>
            </div>
          </div>

          <p className="font-display text-base landscape:text-sm font-bold text-white truncate leading-tight text-center max-w-full">
            {name}
          </p>

          {profile?.country_code && (
            <p className="text-[11px] text-white/50 flex items-center gap-1.5">
              <span className="text-sm leading-none">{getFlagEmoji(profile.country_code)}</span>
              <span className="truncate">{getCountryName(profile.country_code) ?? profile.country_code}</span>
            </p>
          )}

          {memberSince && (
            <div className="hidden landscape:block px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10">
              <p className="font-display text-[8px] tracking-[0.25em] uppercase text-white/40 font-semibold">
                Since {memberSince}
              </p>
            </div>
          )}

          <p className="landscape:hidden text-[9px] text-white/30 tracking-widest uppercase mt-0.5">
            Player Stats
          </p>
        </div>

        {/* ── Body section ── */}
        <div className="flex-1 px-5 pb-5 landscape:py-4 landscape:px-4 flex flex-col gap-2.5 min-h-0 overflow-y-auto landscape:overflow-hidden">
          {showLoading && (
            <div className="py-8 flex justify-center items-center flex-1">
              <div className="w-6 h-6 border-2 border-white/20 border-t-[color:var(--color-gold)] rounded-full animate-spin" />
            </div>
          )}
          {showError && (
            <p className="text-[12px] text-red-300 text-center py-6">{error}</p>
          )}
          {profile && (
            <>
              {/* Performance stats: portrait = 3+3 grid, landscape = 6 in one row */}
              <div className="grid grid-cols-3 landscape:grid-cols-6 gap-1.5">
                {allStats.map(s => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center bg-white/[0.07] border border-white/10 rounded-xl py-2 px-1 backdrop-blur-sm"
                  >
                    <span className="font-display text-base landscape:text-base font-bold text-white leading-tight tabular-nums">
                      {s.value}
                    </span>
                    <span className="text-[8px] text-white/40 tracking-widest uppercase mt-0.5 truncate w-full text-center">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Highlights: portrait = stacked rows, landscape = 3 cards in row */}
              <div className="flex flex-col landscape:grid landscape:grid-cols-3 gap-1.5">
                {highlights.map(h => (
                  <div
                    key={h.label}
                    className="flex items-center landscape:flex-col landscape:items-center landscape:gap-1 gap-3 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 landscape:py-2.5 landscape:px-2"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] grid place-items-center shrink-0">
                      {h.icon}
                    </div>
                    <span className="text-[10px] landscape:text-[8px] text-white/50 tracking-widest uppercase font-display font-semibold landscape:text-center landscape:leading-tight">
                      {h.label}
                    </span>
                    <span className="ml-auto landscape:ml-0 text-[13px] landscape:text-[12px] font-bold text-white tabular-nums landscape:text-center landscape:truncate landscape:w-full">
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>{/* card */}
      </div>{/* outer wrapper */}
    </div>
  );
}
