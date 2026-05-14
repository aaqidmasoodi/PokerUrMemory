import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { User, Settings, Spade } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export function MainMenuScreen({
  profile,
  onStartGame,
  onProfile,
  onSettings,
}: {
  profile: Profile;
  onStartGame: () => void;
  onProfile: () => void;
  onSettings: () => void;
}) {
  const winRate = profile.total_games > 0
    ? Math.round((profile.wins / profile.total_games) * 100)
    : 0;

  return (
    <div
      className="h-dvh flex flex-col [@media(orientation:landscape)]:flex-row bg-[var(--color-background)] overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none" />

      {/* Left / Top — Profile strip */}
      <div className="relative shrink-0 flex flex-col items-center justify-center gap-3
        px-6 pt-6 pb-4
        [@media(orientation:landscape)]:w-[42%] [@media(orientation:landscape)]:h-full
        [@media(orientation:landscape)]:pt-0 [@media(orientation:landscape)]:pb-0
        [@media(orientation:landscape)]:border-r [@media(orientation:landscape)]:border-black/[0.07]">

        <Avatar url={profile.avatar_url} name={profile.username} size="lg" className="border-2 border-white shadow-sm" />

        <div className="text-center">
          <p className="font-bold text-base text-foreground leading-tight">
            {profile.username}
            {profile.country_code && (
              <span className="ml-1.5">{getFlagEmoji(profile.country_code)}</span>
            )}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {profile.total_games} games · {winRate}% win rate
          </p>
        </div>

        {/* Stats pills — landscape only */}
        <div className="hidden [@media(orientation:landscape)]:flex gap-2 mt-1">
          {[
            { label: 'Games', value: profile.total_games },
            { label: 'Wins', value: profile.wins },
            { label: 'Win %', value: `${winRate}%` },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center bg-white/70 rounded-xl px-3 py-2 border border-black/[0.07] shadow-sm min-w-[52px]">
              <span className="font-display text-base font-bold blue-text leading-tight">{s.value}</span>
              <span className="text-[8px] text-gray-400 tracking-wide uppercase">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right / Bottom — Title + Buttons */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-6 px-6
        pb-8 [@media(orientation:landscape)]:pb-0">

        <div className="text-center">
          <h1 className="font-display text-[2rem] [@media(orientation:landscape)]:text-[1.6rem] font-bold blue-text leading-tight tracking-wide">
            PokerUrMemory
          </h1>
          <p className="text-[10px] text-gray-500 mt-1 tracking-[0.18em] uppercase">
            5-Card Draw · Memory Twist
          </p>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={onStartGame}
            className="w-full h-14 rounded-2xl font-display tracking-wider uppercase text-[12px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)] active:scale-[0.97] transition-transform flex items-center justify-center gap-2.5"
          >
            <Spade className="w-4 h-4" />
            Start a New Game
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onProfile}
              className="h-12 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-white/80 text-foreground border border-black/[0.10] shadow-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
            >
              <User className="w-3.5 h-3.5 text-[color:var(--color-blue)]" />
              Profile
            </button>

            <button
              onClick={onSettings}
              className="h-12 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-white/80 text-foreground border border-black/[0.10] shadow-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
            >
              <Settings className="w-3.5 h-3.5 text-[color:var(--color-blue)]" />
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
