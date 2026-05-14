import { ArrowLeft, Volume2, VolumeX, LogOut } from 'lucide-react';
import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { Avatar } from '../components/Avatar';

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
  return (
    <div
      className="h-dvh flex flex-col bg-[var(--color-background)] overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />

      {/* Header */}
      <div className="relative shrink-0 flex items-center gap-3 px-5 pt-4 pb-3 border-b border-black/[0.07]">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-display tracking-wider uppercase text-gray-500 hover:text-[color:var(--color-blue)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <h2 className="font-display text-base font-bold blue-text flex-1 text-center pr-10">Settings</h2>
      </div>

      {/* Body — single col portrait, two col landscape */}
      <div className="relative flex-1 flex flex-col [@media(orientation:landscape)]:flex-row overflow-hidden">

        {/* Left / Top — Account */}
        <div className="flex flex-col gap-3
          px-5 py-5 shrink-0
          [@media(orientation:landscape)]:w-1/2
          [@media(orientation:landscape)]:border-r [@media(orientation:landscape)]:border-black/[0.07]
          [@media(orientation:landscape)]:justify-center">

          <p className="text-[10px] font-display tracking-widest uppercase text-gray-400">Account</p>
          <div className="flex items-center gap-3 bg-white/70 rounded-2xl px-4 py-3.5 border border-black/[0.07] shadow-sm">
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
          <p className="text-[10px] font-display tracking-widest uppercase text-gray-400">Sound</p>
          <button
            onClick={onToggleMute}
            className="flex items-center justify-between bg-white/70 rounded-2xl px-4 py-3.5 border border-black/[0.07] shadow-sm active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {muted
                ? <VolumeX className="w-4 h-4 text-gray-400" />
                : <Volume2 className="w-4 h-4 text-[color:var(--color-blue)]" />}
              <span className="text-sm font-medium text-foreground">Sound Effects</span>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${muted ? 'bg-gray-200' : 'bg-[color:var(--color-blue)]'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${muted ? 'left-0.5' : 'left-[calc(100%-1.375rem)]'}`} />
            </div>
          </button>

          <div className="[@media(orientation:portrait)]:flex-1 mt-4 [@media(orientation:landscape)]:mt-2">
            <button
              onClick={onSignOut}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-red-200 text-red-500 text-sm font-medium bg-white/60 active:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
