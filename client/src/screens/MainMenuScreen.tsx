import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { User, Settings, Spade, BookOpen, Users, Info, CalendarClock, Lightbulb, Bot, Cpu } from 'lucide-react';
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
  onQuickIntro,
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
  onQuickIntro: () => void;
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
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] sm:text-xs text-gray-300 truncate">
                {profile.total_games} games played
              </span>
              <span className={`text-[10px] sm:text-xs font-bold shrink-0 ${profile.current_streak > 0 ? 'text-orange-300' : 'text-gray-500'}`}>
                🔥 {profile.current_streak}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="brief-intro-wobble shrink-0">
            <button
              onClick={onQuickIntro}
              className="flex items-center gap-2 h-9 sm:h-10
                pl-2.5 pr-3.5 sm:pl-3 sm:pr-4
                rounded-full font-display tracking-wider uppercase
                text-[10px] sm:text-[11px] font-bold text-white
                bg-white/15 backdrop-blur-sm border border-white/30
                active:scale-95 transition-all"
            >
              <Lightbulb className="w-4 h-4 shrink-0" />
              Brief Intro
            </button>
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
      </div>

      {/* ── Center: [Solitaire] [title + buttons] [Patience] ── */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center
        gap-3 sm:gap-4 lg:gap-5
        px-4 sm:px-6 md:px-8 lg:px-14 xl:px-20
        py-6 sm:py-8 lg:py-10">

        {/* Solitaire — left square panel */}
        <div className="relative shrink-0">
          <button
            onClick={onSolitaire}
            className="w-[6rem] h-[6rem] sm:w-[7.5rem] sm:h-[7.5rem] lg:w-[9rem] lg:h-[9rem] xl:w-[11rem] xl:h-[11rem]
              block relative rounded-2xl overflow-hidden
              border border-white/30
              hover:brightness-110 active:scale-[0.97] transition-all"
          >
            <img
              src="/images/PUM_Solitaire.webp"
              alt="Solitaire"
              className="w-full h-full object-cover object-center"
              draggable={false}
            />
          </button>
          <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 z-10
            w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8
            rounded-full bg-black/70 backdrop-blur-sm border border-white/30
            flex items-center justify-center pointer-events-none">
            <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-white" />
          </div>
        </div>

        {/* Center: title + 3 game mode buttons */}
        <div className="flex flex-col items-center gap-5 sm:gap-6 lg:gap-8">

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

          {/* 3 game mode buttons — fixed square-ish size */}
          <div className="flex items-stretch gap-2 sm:gap-3 lg:gap-4 xl:gap-5">

            {/* With Friends */}
            <button
              onClick={onPlayWithFriends}
              className="w-[5rem] sm:w-[6rem] lg:w-[7.5rem] xl:w-[9rem]
                min-h-[5rem] sm:min-h-[6rem] lg:min-h-[7.5rem] xl:min-h-[9rem]
                flex flex-col items-center justify-center gap-2 sm:gap-2.5
                rounded-2xl font-display tracking-wider uppercase
                bg-white/15 backdrop-blur-sm border border-white/30 text-white
                hover:bg-white/25 active:scale-[0.97] transition-all"
            >
              <Users className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9" />
              <span className="text-[10px] sm:text-xs lg:text-[13px] xl:text-sm font-bold leading-tight text-center">
                With<br />Friends
              </span>
            </button>

            {/* Quick Play — blue primary */}
            <button
              onClick={onStartGame}
              className="w-[5rem] sm:w-[6rem] lg:w-[7.5rem] xl:w-[9rem]
                min-h-[5rem] sm:min-h-[6rem] lg:min-h-[7.5rem] xl:min-h-[9rem]
                flex flex-col items-center justify-center gap-2 sm:gap-2.5
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
              className="w-[5rem] sm:w-[6rem] lg:w-[7.5rem] xl:w-[9rem]
                min-h-[5rem] sm:min-h-[6rem] lg:min-h-[7.5rem] xl:min-h-[9rem]
                flex flex-col items-center justify-center gap-2 sm:gap-2.5
                rounded-2xl font-display tracking-wider uppercase
                bg-white/15 backdrop-blur-sm border border-white/30 text-white
                hover:bg-white/25 active:scale-[0.97] transition-all"
            >
              <CalendarClock className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9" />
              <span className="text-[10px] sm:text-xs lg:text-[13px] xl:text-sm font-bold leading-tight text-center">
                Schedule
              </span>
            </button>

          </div>
        </div>

        {/* Patience — right square panel */}
        <div className="relative shrink-0">
          <button
            onClick={onPatience}
            className="w-[6rem] h-[6rem] sm:w-[7.5rem] sm:h-[7.5rem] lg:w-[9rem] lg:h-[9rem] xl:w-[11rem] xl:h-[11rem]
              block relative rounded-2xl overflow-hidden
              border border-white/30
              hover:brightness-110 active:scale-[0.97] transition-all"
          >
            <img
              src="/images/PUM_Patience.webp"
              alt="Patience"
              className="w-full h-full object-cover object-center"
              draggable={false}
            />
          </button>
          <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 z-10
            w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8
            rounded-full bg-black/70 backdrop-blur-sm border border-white/30
            flex items-center justify-center pointer-events-none">
            <Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-white" />
          </div>
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
              font-bold bg-white/15 backdrop-blur-sm text-white border border-white/30
              hover:bg-white/25 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
            Profile
          </button>
          <button
            onClick={onSettings}
            className="h-10 sm:h-11 px-4 sm:px-5 lg:px-6
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] lg:text-[12px]
              font-bold bg-white/15 backdrop-blur-sm text-white border border-white/30
              hover:bg-white/25 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
            Settings
          </button>
        </div>

        <div className="flex gap-2 xl:gap-3">
          <button
            onClick={onRules}
            className="h-10 sm:h-11 px-4 sm:px-5 lg:px-6
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] lg:text-[12px]
              font-bold bg-white/15 backdrop-blur-sm text-white border border-white/30
              hover:bg-white/25 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
            How to Play
          </button>
          <button
            onClick={onAbout}
            className="h-10 sm:h-11 px-4 sm:px-5 lg:px-6
              rounded-2xl font-display tracking-wider uppercase
              text-[11px] sm:text-[11px] lg:text-[12px]
              font-bold bg-white/15 backdrop-blur-sm text-white border border-white/30
              hover:bg-white/25 active:scale-[0.97] transition-all
              flex items-center justify-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
            About
          </button>
        </div>
      </div>
    </div>
  );
}
