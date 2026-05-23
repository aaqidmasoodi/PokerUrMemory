import { useState } from 'react';
import { ChevronLeft, Volume2, VolumeX, LogOut, MessageCircle, ChevronRight, Shield } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { Avatar } from '../components/Avatar';
import { FeedbackDialog } from '../components/FeedbackDialog';

const PRIVACY_POLICY_URL = 'https://pokerurmemory.onrender.com/privacy';

function openUrl(url: string) {
  if (Capacitor.isNativePlatform()) {
    Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function SettingsScreen({
  profile,
  muted,
  onToggleMute,
  onBack,
  onSignOut,
}: {
  profile: Profile;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div
      className="h-dvh flex flex-col bg-transparent overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />

      {/* Back button — floating pill, no full-width bar */}
      <div
        className="relative shrink-0"
        style={{
          paddingTop: 'calc(0.625rem + env(safe-area-inset-top, 0px))',
          paddingLeft: 'calc(0.75rem + env(safe-area-inset-left, 0px))',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 h-10 pl-2 pr-4 rounded-full bg-white/90 backdrop-blur-sm border border-black/[0.08] shadow-md active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-[color:var(--color-blue)]" />
          <span className="font-display text-[12px] font-bold blue-text tracking-wider uppercase">
            Settings
          </span>
        </button>
      </div>

      {/* Body — single col portrait, two col landscape */}
      <div className="relative flex-1 flex flex-col [@media(orientation:landscape)]:flex-row overflow-hidden">

        {/* Left / Top — Account */}
        <div className="flex flex-col gap-3
          px-5 py-5 shrink-0
          [@media(orientation:landscape)]:w-1/2
          [@media(orientation:landscape)]:border-r [@media(orientation:landscape)]:border-white/30
          [@media(orientation:landscape)]:justify-center">

          <p className="text-[10px] font-display tracking-widest uppercase text-gray-300">Account</p>
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-black/[0.07] shadow-md">
            <Avatar url={profile.avatar_url} name={profile.username} />
            <div>
              <p className="font-semibold text-sm text-foreground">
                {profile.username}
                {profile.country_code && <span className="ml-1.5">{getFlagEmoji(profile.country_code)}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Right / Bottom — Sound + Sign out */}
        <div className="flex-1 flex flex-col gap-3 px-5 py-5 [@media(orientation:landscape)]:justify-center">
          <p className="text-[10px] font-display tracking-widest uppercase text-gray-300">Sound</p>
          <button
            onClick={onToggleMute}
            className="flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 border border-black/[0.07] shadow-md active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {muted
                ? <VolumeX className="w-4 h-4 text-gray-300" />
                : <Volume2 className="w-4 h-4 text-[color:var(--color-blue)]" />}
              <span className="text-sm font-medium text-foreground">Sound Effects</span>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${muted ? 'bg-gray-200' : 'bg-[color:var(--color-blue)]'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${muted ? 'left-0.5' : 'left-[calc(100%-1.375rem)]'}`} />
            </div>
          </button>

          <p className="text-[10px] font-display tracking-widest uppercase text-gray-300 mt-4">Support</p>
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 border border-black/[0.07] shadow-md active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-4 h-4 text-[color:var(--color-blue)]" />
              <span className="text-sm font-medium text-foreground">Contact Us</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <button
            onClick={() => openUrl(PRIVACY_POLICY_URL)}
            className="flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 border border-black/[0.07] shadow-md active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[color:var(--color-blue)]" />
              <span className="text-sm font-medium text-foreground">Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <div className="[@media(orientation:portrait)]:flex-1 mt-4 [@media(orientation:landscape)]:mt-2">
            <button
              onClick={onSignOut}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-red-200 text-red-500 text-sm font-medium bg-white shadow-md active:bg-red-50 transition-colors"
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
