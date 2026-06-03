import { useState } from 'react';
import { ChevronLeft, Volume2, VolumeX, LogOut, MessageCircle, ChevronRight, Shield, LayoutGrid } from 'lucide-react';
import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { Avatar } from '../components/Avatar';
import { FeedbackDialog } from '../components/FeedbackDialog';

export function SettingsScreen({
  profile,
  muted,
  onToggleMute,
  onOpenLayout,
  onBack,
  onSignOut,
}: {
  profile: Profile;
  muted: boolean;
  onToggleMute: () => void;
  onOpenLayout: () => void;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div
      className="h-dvh flex flex-col bg-transparent overflow-hidden select-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.22] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

      {/* Header */}
      <div
        className="pum-header relative shrink-0 z-10 flex items-center px-4"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
          <span className="font-display text-[10px] font-bold text-white/70 tracking-widest uppercase">Back</span>
        </button>
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold">Settings</p>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

        {/* Identity hero */}
        <div className="shrink-0 flex flex-col items-center gap-5 lg:gap-7
          px-6 py-6 md:py-0 md:justify-center
          border-b border-white/10 md:border-b-0 md:border-r md:border-white/10
          md:w-[42%]">

          {/* Avatar with gold ring */}
          <div className="p-[3px] rounded-full bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] shadow-[0_0_32px_rgba(212,168,67,0.25)]">
            <div className="p-0.5 rounded-full bg-[oklch(0.22_0.06_148)]">
              <Avatar
                url={profile.avatar_url}
                name={profile.username}
                size="lg"
                className="sm:w-24 sm:h-24 sm:text-3xl lg:w-32 lg:h-32 lg:text-4xl"
              />
            </div>
          </div>

          <div className="text-center">
            <p className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-tight tracking-wide">
              {profile.username}
              {profile.country_code && (
                <span className="ml-2">{getFlagEmoji(profile.country_code)}</span>
              )}
            </p>
            <p className="text-[10px] text-white/40 tracking-widest uppercase mt-1.5">Account</p>
            <p className="text-[10px] text-white/25 tracking-widest mt-1">v{__APP_VERSION__}</p>
          </div>

          {/* Sign Out — md+ only (phone has it at bottom of list) */}
          <button
            onClick={onSignOut}
            className="hidden md:flex items-center justify-center gap-2 h-11 lg:h-12 px-6 lg:px-8 rounded-2xl bg-white/[0.07] border border-red-500/30 text-red-400 text-sm font-semibold backdrop-blur-sm hover:bg-red-500/10 active:scale-[0.98] transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Settings list */}
        <div className="flex-1 flex flex-col justify-center px-6 py-6 md:px-10 lg:px-16 xl:px-20">
          <div className="w-full max-w-md mx-auto md:mx-0 flex flex-col gap-4 lg:gap-5">

            <div>
              <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold">Sound</p>
            </div>

            <button
              onClick={onToggleMute}
              className="flex items-center justify-between bg-white/[0.07] border border-white/10 rounded-2xl px-4 py-3.5 lg:px-5 lg:py-4 backdrop-blur-sm hover:bg-white/[0.10] active:bg-white/[0.10] transition-colors"
            >
              <div className="flex items-center gap-3">
                {muted
                  ? <VolumeX className="w-4 h-4 lg:w-5 lg:h-5 text-white/30" />
                  : <Volume2 className="w-4 h-4 lg:w-5 lg:h-5 text-white/70" />}
                <div>
                  <p className="text-sm lg:text-base font-medium text-white">Sound Effects</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{muted ? 'Muted' : 'On'}</p>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${muted ? 'bg-white/20' : 'bg-[color:var(--color-gold)]'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${muted ? 'left-0.5' : 'left-[calc(100%-1.375rem)]'}`} />
              </div>
            </button>

            <div className="mt-1 lg:mt-2">
              <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold">Table</p>
            </div>

            <button
              onClick={onOpenLayout}
              className="flex items-center justify-between bg-white/[0.07] border border-white/10 rounded-2xl px-4 py-3.5 lg:px-5 lg:py-4 backdrop-blur-sm hover:bg-white/[0.10] active:bg-white/[0.10] transition-colors"
            >
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 lg:w-5 lg:h-5 text-white/50" />
                <div>
                  <p className="text-sm lg:text-base font-medium text-white">Table Layout</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Position &amp; resize opponents per table size</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-white/25 shrink-0" />
            </button>

            <div className="mt-1 lg:mt-2">
              <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold">Support</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowFeedback(true)}
                className="flex items-center justify-between bg-white/[0.07] border border-white/10 rounded-2xl px-4 py-3.5 lg:px-5 lg:py-4 backdrop-blur-sm hover:bg-white/[0.10] active:bg-white/[0.10] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 lg:w-5 lg:h-5 text-white/50" />
                  <div>
                    <p className="text-sm lg:text-base font-medium text-white">Contact Us</p>
                    <p className="text-[10px] text-white/40 mt-0.5">Send feedback or report an issue</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-white/25 shrink-0" />
              </button>

              <div className="flex items-center justify-between bg-white/[0.07] border border-white/10 rounded-2xl px-4 py-3.5 lg:px-5 lg:py-4 cursor-default">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 lg:w-5 lg:h-5 text-white/50" />
                  <div>
                    <p className="text-sm lg:text-base font-medium text-white">Privacy Policy</p>
                    <p className="text-[10px] text-white/40 mt-0.5">How we handle your data</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-white/25 shrink-0" />
              </div>
            </div>

            {/* Sign Out — phone only */}
            <button
              onClick={onSignOut}
              className="md:hidden flex items-center justify-center gap-2 w-full h-12 mt-2 rounded-2xl bg-white/[0.07] border border-red-500/30 text-red-400 text-sm font-semibold backdrop-blur-sm active:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {showFeedback && (
        <FeedbackDialog
          userId={profile.id}
          username={profile.username}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}
