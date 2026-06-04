import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { User, Settings, Spade, BookOpen, Users, Info, CalendarClock, Bot, Layers } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export function MainMenuScreen({
  profile,
  onStartGame,
  onSolitaire,
  onPatience,
  onPlayWithFriends,
  onScheduledGames,
  onProfile,
  onSettings,
  onRules,
  onAbout,
}: {
  profile: Profile;
  onStartGame: () => void;
  onSolitaire: () => void;
  onPatience: () => void;
  onPlayWithFriends: () => void;
  onScheduledGames: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onRules: () => void;
  onAbout: () => void;
}) {

  return (
    <div className="pum-screen relative h-full flex flex-col overflow-hidden select-none bg-transparent">
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none" />

      {/* ── Top bar: identity left, discord right ── */}
      <div className="relative z-10 shrink-0 flex items-center justify-between gap-3
        pt-3 sm:pt-4 lg:pt-6 xl:pt-10
        px-4 sm:px-6 md:px-8 lg:px-14 xl:px-20">

        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Avatar
            url={profile.avatar_url}
            name={profile.username}
            size="md"
            className="sm:w-11 sm:h-11 lg:w-13 lg:h-13 border-2 border-white shadow-sm shrink-0"
          />
          <div className="min-w-0">
            <p className="font-bold text-sm sm:text-base lg:text-lg text-white leading-tight truncate">
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

        <a
          href="https://discord.gg/Jg2Ae4wAtj"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-2 h-9 sm:h-10
            pl-2.5 pr-3.5 sm:pl-3 sm:pr-4
            rounded-full font-display tracking-wider uppercase
            text-[10px] sm:text-[11px] font-bold text-white
            shadow-[0_4px_16px_rgba(88,101,242,0.4)]
            active:scale-95 transition-all"
          style={{ background: '#5865F2' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028ZM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38Zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38Z" />
          </svg>
          Join Discord
        </a>
      </div>

      {/* ── Center: title + button grid ── */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center
        gap-5 sm:gap-6 lg:gap-8
        px-4 sm:px-6 md:px-8 lg:px-14 xl:px-20">

        {/* Title */}
        <div className="text-center">
          <h1 className="font-display
            text-2xl min-[380px]:text-3xl sm:text-4xl lg:text-5xl xl:text-6xl
            font-bold leading-tight tracking-wide text-white drop-shadow-md whitespace-nowrap">
            ♠ PokerUrMemory ♠
          </h1>
          <p className="text-[10px] sm:text-xs lg:text-sm text-gray-300 mt-1.5 tracking-[0.2em] uppercase">
            5-Card Draw · Memory Twist
          </p>
        </div>

        {/* Primary button row — 5 square-ish tiles filling the horizontal space */}
        <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto flex gap-2 sm:gap-3 lg:gap-4 xl:gap-5">

          {/* Solitaire + Patience stacked in one tile slot */}
          <div className="flex-1 flex flex-col gap-1.5 sm:gap-2">
            <button
              onClick={onSolitaire}
              className="flex-1 flex flex-row items-center justify-center gap-2
                px-2 rounded-2xl font-display tracking-wider uppercase
                bg-white text-[color:var(--color-blue)]
                border border-[color:var(--color-blue)]/25
                shadow-md hover:bg-white/90 active:scale-[0.97] transition-all"
            >
              <Bot className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 shrink-0" />
              <span className="text-[9px] sm:text-[10px] lg:text-xs font-bold leading-tight text-center">
                PokerUrMemory<br />Solitaire
              </span>
            </button>
            <button
              onClick={onPatience}
              className="flex-1 flex flex-row items-center justify-center gap-2
                px-2 rounded-2xl font-display tracking-wider uppercase
                bg-white text-[color:var(--color-blue)]
                border border-[color:var(--color-blue)]/25
                shadow-md hover:bg-white/90 active:scale-[0.97] transition-all"
            >
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 shrink-0" />
              <span className="text-[9px] sm:text-[10px] lg:text-xs font-bold leading-tight text-center">
                PokerUrMemory<br />Patience
              </span>
            </button>
          </div>

          {/* With Friends */}
          <button
            onClick={onPlayWithFriends}
            className="flex-[1.25] flex flex-col items-center justify-center gap-2 sm:gap-2.5
              py-4 sm:py-5 lg:py-6
              rounded-2xl font-display tracking-wider uppercase
              bg-white text-[color:var(--color-blue)]
              border border-[color:var(--color-blue)]/25
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all"
          >
            <Users className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9" />
            <span className="text-[10px] sm:text-xs lg:text-[13px] xl:text-sm font-bold leading-tight text-center">
              With<br />Friends
            </span>
          </button>

          {/* Quick Play — blue primary */}
          <button
            onClick={onStartGame}
            className="flex-[1.25] flex flex-col items-center justify-center gap-2 sm:gap-2.5
              py-4 sm:py-5 lg:py-6
              rounded-2xl font-display tracking-wider uppercase
              bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
              text-white border border-black/10
              shadow-[0_6px_24px_rgba(0,0,0,0.25)]
              hover:brightness-110 active:scale-[0.97] transition-all"
          >
            <Spade className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9" />
            <span className="text-[10px] sm:text-xs lg:text-[13px] xl:text-sm font-bold leading-tight text-center">
              Quick<br />Play
            </span>
          </button>

          {/* Schedule */}
          <button
            onClick={onScheduledGames}
            className="flex-[1.25] flex flex-col items-center justify-center gap-2 sm:gap-2.5
              py-4 sm:py-5 lg:py-6
              rounded-2xl font-display tracking-wider uppercase
              bg-white text-[color:var(--color-blue)]
              border border-[color:var(--color-blue)]/25
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all"
          >
            <CalendarClock className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9" />
            <span className="text-[10px] sm:text-xs lg:text-[13px] xl:text-sm font-bold leading-tight text-center">
              Schedule
            </span>
          </button>
        </div>

      </div>

      {/* ── Bottom bar: nav buttons ── */}
      <div className="relative z-10 shrink-0 flex flex-wrap items-end justify-between gap-2
        px-4 pb-3 sm:px-6 sm:pb-4 md:px-8 lg:px-14 lg:pb-6 xl:px-20 xl:pb-10">

        <div className="flex gap-2 xl:gap-3">
          <button
            onClick={onProfile}
            className="h-10 sm:h-11 px-4 sm:px-5 lg:px-6
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] lg:text-[12px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[color:var(--color-blue)]" />
            Profile
          </button>
          <button
            onClick={onSettings}
            className="h-10 sm:h-11 px-4 sm:px-5 lg:px-6
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] lg:text-[12px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[color:var(--color-blue)]" />
            Settings
          </button>
        </div>

        <div className="flex gap-2 xl:gap-3">
          <button
            onClick={onRules}
            className="h-10 sm:h-11 px-4 sm:px-5 lg:px-6
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] lg:text-[12px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[color:var(--color-blue)]" />
            How to Play
          </button>
          <button
            onClick={onAbout}
            className="h-10 sm:h-11 px-4 sm:px-5 lg:px-6
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] lg:text-[12px]
              font-bold bg-white text-foreground border border-black/[0.10]
              shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[color:var(--color-blue)]" />
            About
          </button>
        </div>
      </div>
    </div>
  );
}
