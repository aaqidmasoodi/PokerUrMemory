import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { User, Settings, Spade, BookOpen, Users, Info } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export function MainMenuScreen({
  profile,
  onStartGame,
  onPlayWithFriends,
  onProfile,
  onSettings,
  onRules,
  onAbout,
}: {
  profile: Profile;
  onStartGame: () => void;
  onPlayWithFriends: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onRules: () => void;
  onAbout: () => void;
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
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none" />

      {/* ── Top bar: identity left, stats right ── */}
      <div className="relative z-10 shrink-0 flex items-center justify-between gap-3
        pt-4 sm:pt-5 md:pt-6 lg:pt-10 xl:pt-14 2xl:pt-20
        px-4 sm:px-6 md:px-8 lg:px-14 xl:px-20 2xl:px-32
        landscape:pt-2">

        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Avatar
            url={profile.avatar_url}
            name={profile.username}
            size="md"
            className="sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 border-2 border-white shadow-sm shrink-0
              landscape:w-9 landscape:h-9 landscape:text-sm"
          />
          <div className="min-w-0">
            <p className="font-bold text-sm sm:text-base lg:text-xl xl:text-2xl 2xl:text-3xl text-white leading-tight truncate
              landscape:text-xs">
              {profile.username}
              {profile.country_code && (
                <span className="ml-1.5">{getFlagEmoji(profile.country_code)}</span>
              )}
            </p>
            <p className="text-[10px] sm:text-xs xl:text-sm 2xl:text-base text-gray-300 mt-0.5 truncate
              landscape:text-[9px]">
              {profile.total_games} games played
            </p>
          </div>
        </div>

        <div className="flex gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0">
          {stats.map(s => (
            <div key={s.label} className="flex flex-col items-center bg-white rounded-xl lg:rounded-2xl
              px-2.5 py-1.5 sm:px-4 sm:py-2 lg:px-5 lg:py-3 xl:px-7 xl:py-4 2xl:px-9 2xl:py-5
              border border-black/[0.07] shadow-md
              min-w-[44px] sm:min-w-[60px] lg:min-w-[80px] xl:min-w-[110px] 2xl:min-w-[130px]
              landscape:px-2 landscape:py-1 landscape:min-w-[34px]">
              <span className="font-display text-sm sm:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold blue-text leading-tight
                landscape:text-xs">{s.value}</span>
              <span className="text-[8px] sm:text-[9px] lg:text-[10px] xl:text-[12px] 2xl:text-sm text-gray-300 tracking-widest uppercase mt-0.5
                landscape:text-[7px]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: title + primary buttons ──
          The title is whitespace-nowrap so it sets the container width.
          Buttons use w-full to match, keeping them perfectly aligned. ── */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center
        gap-6 sm:gap-8 lg:gap-10 xl:gap-14 2xl:gap-16 px-6
        landscape:gap-2">

        {/* w-max: sizes to the widest child (the title); buttons fill that width */}
        <div className="w-max mx-auto max-w-[calc(100vw-3rem)] flex flex-col items-stretch gap-5 sm:gap-6 lg:gap-7 xl:gap-8
          landscape:gap-2.5">

          <div className="text-center">
            <h1 className="font-display whitespace-nowrap
              text-2xl min-[380px]:text-3xl sm:text-4xl lg:text-5xl xl:text-6xl 2xl:text-8xl
              font-bold leading-tight tracking-wide text-white drop-shadow-md
              landscape:text-xl landscape:min-[380px]:text-xl landscape:sm:text-2xl">
              ♠ PokerUrMemory ♠
            </h1>
            <p className="text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-xl text-gray-300
              mt-1.5 lg:mt-3 xl:mt-4 tracking-[0.2em] uppercase
              landscape:text-[9px] landscape:mt-1">
              5-Card Draw · Memory Twist
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:gap-4 xl:gap-5 2xl:gap-6">
            {/* Primary CTA — taller + bigger text than the cancel reference (h-10 / text-[12px]) */}
            <button
              onClick={onStartGame}
              className="w-full h-14 sm:h-14 lg:h-16 xl:h-20 2xl:h-24 rounded-2xl
                font-display tracking-[0.15em] uppercase
                text-[13px] sm:text-sm lg:text-[14px] xl:text-[17px] 2xl:text-[20px]
                font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
                text-white border border-black/10
                shadow-[0_4px_20px_rgba(0,0,0,0.2)] lg:shadow-[0_8px_30px_rgba(0,0,0,0.25)]
                hover:brightness-110 active:scale-[0.97] transition-all
                flex items-center justify-center gap-2.5 lg:gap-3 xl:gap-4
                landscape:h-11 landscape:text-[12px]"
            >
              <Spade className="w-4 h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 2xl:w-7 2xl:h-7" />
              Quick Play
            </button>

            {/* Secondary CTA — same text scale as cancel, slightly taller */}
            <button
              onClick={onPlayWithFriends}
              className="w-full h-12 sm:h-12 lg:h-14 xl:h-18 2xl:h-20 rounded-2xl
                font-display tracking-[0.15em] uppercase
                text-[12px] sm:text-xs lg:text-[12px] xl:text-[15px] 2xl:text-[17px]
                font-bold bg-white text-[color:var(--color-blue)]
                border border-[color:var(--color-blue)]/30
                shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
                flex items-center justify-center gap-2 lg:gap-2.5 xl:gap-3
                landscape:h-9 landscape:text-[11px]"
            >
              <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
              Play with Friends
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom bar: nav buttons ── */}
      <div className="relative z-10 shrink-0 flex flex-wrap items-end justify-start sm:justify-between gap-2
        px-4 pb-4 sm:px-6 sm:pb-5 md:px-8 md:pb-6 lg:px-14 lg:pb-10 xl:px-20 xl:pb-14 2xl:px-32 2xl:pb-20
        landscape:pb-2">

        <div className="flex gap-2 xl:gap-3">
          <button
            onClick={onProfile}
            className="h-10 sm:h-11 xl:h-14 2xl:h-16 px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] xl:text-[13px] 2xl:text-[15px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5
              landscape:h-9 landscape:text-[10px] landscape:px-3"
          >
            <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-[color:var(--color-blue)]" />
            Profile
          </button>
          <button
            onClick={onSettings}
            className="h-10 sm:h-11 xl:h-14 2xl:h-16 px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] xl:text-[13px] 2xl:text-[15px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5
              landscape:h-9 landscape:text-[10px] landscape:px-3"
          >
            <Settings className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-[color:var(--color-blue)]" />
            Settings
          </button>
        </div>

        <div className="flex gap-2 xl:gap-3">
          <button
            onClick={onRules}
            className="h-10 sm:h-11 xl:h-14 2xl:h-16 px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] xl:text-[13px] 2xl:text-[15px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5
              landscape:h-9 landscape:text-[10px] landscape:px-3"
          >
            <BookOpen className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-[color:var(--color-blue)]" />
            How to Play
          </button>
          <button
            onClick={onAbout}
            className="h-10 sm:h-11 xl:h-14 2xl:h-16 px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] xl:text-[13px] 2xl:text-[15px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5
              landscape:h-9 landscape:text-[10px] landscape:px-3"
          >
            <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-[color:var(--color-blue)]" />
            About
          </button>
        </div>
      </div>
    </div>
  );
}
