import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { User, Settings, Spade, BookOpen, Users, Info, CalendarClock, Bot } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export function MainMenuScreen({
  profile,
  onStartGame,
  onPlayWithComputer,
  onPlayWithFriends,
  onScheduledGames,
  onProfile,
  onSettings,
  onRules,
  onAbout,
}: {
  profile: Profile;
  onStartGame: () => void;
  onPlayWithComputer: () => void;
  onPlayWithFriends: () => void;
  onScheduledGames: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onRules: () => void;
  onAbout: () => void;
}) {

  return (
    <div
      className="pum-screen relative h-full flex flex-col overflow-hidden select-none bg-transparent"
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

        {/* Discord join button */}
        <a
          href="https://discord.gg/Jg2Ae4wAtj"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-2 sm:gap-2.5
            h-9 sm:h-10 lg:h-11 xl:h-13 2xl:h-14
            pl-2.5 pr-3.5 sm:pl-3 sm:pr-4 lg:pl-3.5 lg:pr-5
            rounded-full font-display tracking-wider uppercase
            text-[10px] sm:text-[11px] lg:text-[12px] xl:text-[13px] 2xl:text-[14px]
            font-bold text-white
            shadow-[0_4px_16px_rgba(88,101,242,0.4)]
            active:scale-95 transition-all
            landscape:h-8 landscape:text-[10px] landscape:pl-2 landscape:pr-3"
          style={{ background: '#5865F2' }}
        >
          {/* Discord logo mark */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 shrink-0 landscape:w-3.5 landscape:h-3.5"
            aria-hidden="true"
          >
            <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028ZM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38Zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38Z" />
          </svg>
          Join Discord
        </a>
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

            {/* Play against computer opponents */}
            <button
              onClick={onPlayWithComputer}
              className="w-full h-12 sm:h-12 lg:h-14 xl:h-18 2xl:h-20 rounded-2xl
                font-display tracking-[0.12em] uppercase
                text-[11px] sm:text-[11px] lg:text-[12px] xl:text-[14px] 2xl:text-[16px]
                font-bold bg-white text-[color:var(--color-blue)]
                border border-[color:var(--color-blue)]/30
                shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
                flex items-center justify-center gap-1.5 lg:gap-2 xl:gap-3
                landscape:h-9 landscape:text-[10px]"
            >
              <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 shrink-0" />
              Play vs Computer
            </button>

            {/* Secondary CTAs — Play with Friends + Schedule on the same row */}
            <div className="flex gap-2 lg:gap-3 xl:gap-4 2xl:gap-5">
              <button
                onClick={onPlayWithFriends}
                className="flex-1 h-12 sm:h-12 lg:h-14 xl:h-18 2xl:h-20 rounded-2xl
                  font-display tracking-[0.12em] uppercase
                  text-[11px] sm:text-[11px] lg:text-[12px] xl:text-[14px] 2xl:text-[16px]
                  font-bold bg-white text-[color:var(--color-blue)]
                  border border-[color:var(--color-blue)]/30
                  shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
                  flex items-center justify-center gap-1.5 lg:gap-2 xl:gap-3
                  landscape:h-9 landscape:text-[10px]"
              >
                <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 shrink-0" />
                With Friends
              </button>

              <button
                onClick={onScheduledGames}
                className="flex-1 h-12 sm:h-12 lg:h-14 xl:h-18 2xl:h-20 rounded-2xl
                  font-display tracking-[0.12em] uppercase
                  text-[11px] sm:text-[11px] lg:text-[12px] xl:text-[14px] 2xl:text-[16px]
                  font-bold bg-white text-[color:var(--color-blue)]
                  border border-[color:var(--color-blue)]/30
                  shadow-md hover:bg-white/90 active:scale-[0.97] transition-all
                  flex items-center justify-center gap-1.5 lg:gap-2 xl:gap-3
                  landscape:h-9 landscape:text-[10px]"
              >
                <CalendarClock className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 shrink-0" />
                Schedule
              </button>
            </div>
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
