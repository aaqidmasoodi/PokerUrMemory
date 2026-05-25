import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { User, Settings, Spade, BookOpen, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export function MainMenuScreen({
  profile,
  onStartGame,
  onPlayWithFriends,
  onProfile,
  onSettings,
  onRules,
}: {
  profile: Profile;
  onStartGame: () => void;
  onPlayWithFriends: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onRules: () => void;
}) {
  const winRate = profile.total_games > 0
    ? Math.round((profile.wins / profile.total_games) * 100)
    : 0;

  const stats = [
    { label: 'Games', value: profile.total_games },
    { label: 'Wins', value: profile.wins },
    { label: 'Win %', value: `${winRate}%` },
  ];

  return (
    <div
      className="relative h-full flex flex-col overflow-hidden select-none bg-transparent"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none" />

      {/* ── Top bar — identity (left) + stats (right) ── */}
      <div className="relative z-10 shrink-0 flex items-center justify-between gap-3
        px-4 pt-4 sm:px-6 sm:pt-5 md:px-8 md:pt-6 lg:px-14 lg:pt-10 xl:px-20 xl:pt-14">

        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Avatar
            url={profile.avatar_url}
            name={profile.username}
            size="md"
            className="sm:w-12 sm:h-12 sm:text-lg lg:w-14 lg:h-14 lg:text-xl border-2 border-white shadow-sm shrink-0"
          />
          <div className="min-w-0">
            <p className="font-bold text-xs sm:text-base lg:text-xl text-white leading-tight truncate">
              {profile.username}
              {profile.country_code && (
                <span className="ml-1.5">{getFlagEmoji(profile.country_code)}</span>
              )}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-300 mt-0.5 truncate">
              {profile.total_games} games played
            </p>
          </div>
        </div>

        <div className="flex gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0">
          {stats.map(s => (
            <div key={s.label} className="flex flex-col items-center bg-white rounded-xl lg:rounded-2xl px-2 py-1 sm:px-4 sm:py-2 lg:px-5 lg:py-3 border border-black/[0.07] shadow-md min-w-[40px] sm:min-w-[58px] lg:min-w-[80px]">
              <span className="font-display text-xs sm:text-lg lg:text-2xl font-bold blue-text leading-tight">{s.value}</span>
              <span className="text-[7px] sm:text-[9px] lg:text-[10px] text-gray-300 tracking-wide lg:tracking-widest uppercase mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center — title + primary actions ── */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center gap-6 sm:gap-8 lg:gap-10 px-6">
        <div className="text-center">
          <h1 className="font-display text-xl min-[380px]:text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight tracking-wide text-white drop-shadow-md whitespace-nowrap">
            ♠ PokerUrMemory ♠
          </h1>
          <p className="text-[10px] sm:text-xs lg:text-sm text-gray-300 mt-2 lg:mt-3 tracking-[0.2em] lg:tracking-[0.28em] uppercase">
            5-Card Draw · Memory Twist
          </p>
        </div>

        <div className="w-full max-w-[300px] sm:max-w-[340px] lg:w-[380px] lg:max-w-none flex flex-col gap-3 lg:gap-4">
          <button
            onClick={onStartGame}
            className="w-full h-12 lg:h-16 rounded-2xl font-display tracking-wider lg:tracking-[0.15em] uppercase text-[11px] lg:text-[14px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)] lg:shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-2.5 lg:gap-3"
          >
            <Spade className="w-4 h-4 lg:w-5 lg:h-5" />
            Quick Play
          </button>

          <button
            onClick={onPlayWithFriends}
            className="w-full h-11 lg:h-14 rounded-2xl font-display tracking-wider lg:tracking-[0.15em] uppercase text-[10px] lg:text-[12px] font-bold bg-white text-[color:var(--color-blue)] border border-[color:var(--color-blue)]/30 shadow-md hover:bg-white/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2 lg:gap-2.5"
          >
            <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
            Play with Friends
          </button>
        </div>
      </div>

      {/* ── Bottom bar — Profile/Settings (left) + How to Play (right) ── */}
      <div className="relative z-10 shrink-0 flex flex-wrap items-end justify-start sm:justify-between gap-2
        px-4 pb-4 sm:px-6 sm:pb-5 md:px-8 md:pb-6 lg:px-14 lg:pb-10 xl:px-20 xl:pb-14">

        <div className="flex gap-2">
          <button
            onClick={onProfile}
            className="h-10 sm:h-12 px-3 sm:px-5 lg:px-6 rounded-2xl font-display tracking-wider uppercase text-[9px] sm:text-[11px] font-bold bg-white text-foreground border border-black/[0.10] shadow-md hover:bg-white/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            <User className="w-3 h-3 lg:w-4 lg:h-4 text-[color:var(--color-blue)]" />
            Profile
          </button>
          <button
            onClick={onSettings}
            className="h-10 sm:h-12 px-3 sm:px-5 lg:px-6 rounded-2xl font-display tracking-wider uppercase text-[9px] sm:text-[11px] font-bold bg-white text-foreground border border-black/[0.10] shadow-md hover:bg-white/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            <Settings className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[color:var(--color-blue)]" />
            Settings
          </button>
        </div>

        <button
          onClick={onRules}
          className="h-10 sm:h-12 px-3 sm:px-5 lg:px-6 rounded-2xl font-display tracking-wider uppercase text-[9px] sm:text-[11px] font-bold bg-white text-foreground border border-black/[0.10] shadow-md hover:bg-white/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        >
          <BookOpen className="w-3 h-3 lg:w-4 lg:h-4 text-[color:var(--color-blue)]" />
          How to Play
        </button>
      </div>
    </div>
  );
}
