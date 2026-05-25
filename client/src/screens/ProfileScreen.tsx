import { useState } from 'react';
import type { Profile } from '../lib/supabase';
import { getCountryName, getFlagEmoji } from '../lib/countries';
import { ChevronLeft, Check } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export function ProfileScreen({
  profile,
  onSave,
  onBack,
}: {
  profile: Profile;
  onSave: (updates: Partial<Pick<Profile, 'username' | 'country_code'>>) => Promise<string | null>;
  onBack: () => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const winRate = profile.total_games > 0
    ? Math.round((profile.wins / profile.total_games) * 100)
    : 0;

  const stats = [
    { label: 'Games', value: profile.total_games },
    { label: 'Wins', value: profile.wins },
    { label: 'Win Rate', value: `${winRate}%` },
  ];

  async function handleSave() {
    if (!username.trim()) { setError('Username cannot be empty'); return; }
    setLoading(true);
    setError('');
    const err = await onSave({ username: username.trim() });
    setLoading(false);
    if (err) { setError(err); } else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <div
      className="h-dvh flex flex-col bg-transparent overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.22] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

      {/* Header */}
      <div
        className="relative shrink-0 z-10 flex items-center px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.75rem' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
          <span className="font-display text-[10px] font-bold text-white/70 tracking-widest uppercase">Back</span>
        </button>
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold">Player Profile</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="ml-auto flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm active:scale-95 transition-transform disabled:opacity-40"
        >
          {saved && <Check className="w-4 h-4 text-white/70" />}
          <span className="font-display text-[10px] font-bold text-white/70 tracking-widest uppercase">
            {loading ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

        {/* Identity hero */}
        <div className="shrink-0 flex flex-col items-center gap-4 lg:gap-5
          px-6 py-4 md:py-0 md:justify-center
          border-b border-white/10 md:border-b-0 md:border-r md:border-white/10
          md:w-[45%]">

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
            </p>
            {profile.country_code && (
              <p className="text-sm text-white/50 mt-1.5 flex items-center justify-center gap-1.5">
                <span>{getFlagEmoji(profile.country_code)}</span>
                <span>{getCountryName(profile.country_code) ?? profile.country_code}</span>
              </p>
            )}
          </div>

          {/* Stats — dark game-UI cards */}
          <div className="flex gap-2.5 sm:gap-3 lg:gap-4 w-full max-w-xs justify-center">
            {stats.map(s => (
              <div key={s.label} className="flex-1 flex flex-col items-center bg-white/[0.07] border border-white/10 rounded-2xl py-3 lg:py-4 backdrop-blur-sm">
                <span className="font-display text-lg sm:text-2xl lg:text-3xl font-bold text-white leading-tight">{s.value}</span>
                <span className="text-[8px] lg:text-[9px] text-white/40 tracking-widest uppercase mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Edit form */}
        <div className="flex-1 flex flex-col justify-center px-6 py-5 md:px-10 lg:px-16 xl:px-20">
          <div className="w-full max-w-md mx-auto md:mx-0 flex flex-col gap-3 lg:gap-4">

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-display tracking-[0.2em] uppercase text-white/50">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={20}
                className="w-full bg-white/[0.08] border border-white/15 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:border-[color:var(--color-gold)]/50 focus:bg-white/[0.10] outline-none transition-colors backdrop-blur-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-display tracking-[0.2em] uppercase text-white/50">Country</label>
              <div className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
                {profile.country_code ? (
                  <>
                    <span className="text-xl lg:text-2xl leading-none">{getFlagEmoji(profile.country_code)}</span>
                    <span className="text-sm lg:text-base text-white/60">{getCountryName(profile.country_code) ?? profile.country_code}</span>
                  </>
                ) : (
                  <span className="text-white/30 text-sm">Unknown</span>
                )}
                <span className="ml-auto text-[9px] text-white/25 tracking-widest uppercase font-display">Auto-detected</span>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
