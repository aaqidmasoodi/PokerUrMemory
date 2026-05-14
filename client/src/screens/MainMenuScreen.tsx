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
      className="h-dvh flex flex-col bg-[var(--color-background)] overflow-hidden select-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none" />

      {/* Top bar */}
      <div className="relative shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <Avatar url={profile.avatar_url} name={profile.username} size="sm" className="border-2 border-white shadow-sm" />
          <div>
            <p className="font-semibold text-sm text-foreground leading-tight">
              {profile.username}
              {profile.country_code && (
                <span className="ml-1.5">{getFlagEmoji(profile.country_code)}</span>
              )}
            </p>
            <p className="text-[10px] text-gray-400">
              {profile.total_games} games · {winRate}% win rate
            </p>
          </div>
        </div>
      </div>

      {/* Center branding */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <h1 className="font-display text-[2rem] font-bold blue-text leading-tight tracking-wide">
            PokerUrMemory
          </h1>
          <p className="text-[10px] text-gray-500 mt-1 tracking-[0.18em] uppercase">
            5-Card Draw · Memory Twist
          </p>
        </div>

        {/* Menu buttons */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={onStartGame}
            className="w-full h-16 rounded-2xl font-display tracking-wider uppercase text-[12px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)] active:scale-[0.97] transition-transform flex items-center justify-center gap-2.5"
          >
            <Spade className="w-5 h-5" />
            Start a New Game
          </button>

          <button
            onClick={onProfile}
            className="w-full h-13 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-white/80 text-foreground border border-black/[0.10] shadow-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4 text-[color:var(--color-blue)]" />
            Profile
          </button>

          <button
            onClick={onSettings}
            className="w-full h-13 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-white/80 text-foreground border border-black/[0.10] shadow-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4 text-[color:var(--color-blue)]" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
