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
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.22] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

      {/* Header */}
      <div className="pum-header relative shrink-0 z-10 flex items-center px-4">
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

      {/* Single-column scrollable body */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6"
          style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}
        >

          {/* Profile hero — compact horizontal row */}
          <div className="flex items-center gap-4 px-1">
            <div className="shrink-0 p-[3px] rounded-full bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] shadow-[0_0_24px_rgba(212,168,67,0.25)]">
              <div className="p-0.5 rounded-full bg-[oklch(0.22_0.06_148)]">
                <Avatar
                  url={profile.avatar_url}
                  name={profile.username}
                  size="md"
                  className="w-14 h-14 text-xl"
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-white leading-tight tracking-wide truncate">
                {profile.username}
                {profile.country_code && (
                  <span className="ml-2">{getFlagEmoji(profile.country_code)}</span>
                )}
              </p>
              <p className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">Account</p>
              <p className="text-[10px] text-white/25 tracking-widest mt-0.5">v{__APP_VERSION__}</p>
            </div>
          </div>

          {/* Sound group */}
          <SettingsGroup label="Sound">
            <button
              onClick={onToggleMute}
              className="settings-row"
            >
              <div className="flex items-center gap-3">
                {muted
                  ? <VolumeX className="w-4 h-4 text-white/30" />
                  : <Volume2 className="w-4 h-4 text-white/70" />}
                <div>
                  <p className="text-sm font-medium text-white">Sound Effects</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{muted ? 'Muted' : 'On'}</p>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${muted ? 'bg-white/20' : 'bg-[color:var(--color-gold)]'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${muted ? 'left-0.5' : 'left-[calc(100%-1.375rem)]'}`} />
              </div>
            </button>
          </SettingsGroup>

          {/* Table group */}
          <SettingsGroup label="Table">
            <button onClick={onOpenLayout} className="settings-row">
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 text-white/50" />
                <div>
                  <p className="text-sm font-medium text-white">Table Layout</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Position &amp; resize opponents per table size</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
            </button>
          </SettingsGroup>

          {/* Support group */}
          <SettingsGroup label="Support">
            <button onClick={() => setShowFeedback(true)} className="settings-row">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-white/50" />
                <div>
                  <p className="text-sm font-medium text-white">Contact Us</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Send feedback or report an issue</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
            </button>

            <div className="settings-row cursor-default">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-white/50" />
                <div>
                  <p className="text-sm font-medium text-white">Privacy Policy</p>
                  <p className="text-[10px] text-white/40 mt-0.5">How we handle your data</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
            </div>
          </SettingsGroup>

          {/* Sign Out */}
          <button
            onClick={onSignOut}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-white/[0.07] border border-red-500/30 text-red-400 text-sm font-semibold backdrop-blur-sm active:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>

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

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold px-1">{label}</p>
      <div className="flex flex-col rounded-2xl overflow-hidden divide-y divide-white/[0.06] bg-white/[0.07] border border-white/10 backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}
