import { useState } from 'react';
import type { Profile } from '../lib/supabase';
import { getCountryName, getFlagEmoji } from '../lib/countries';
import { ChevronLeft } from 'lucide-react';
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
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />

      {/* Header — background bleeds edge-to-edge, content sits inside safe area */}
      <div
        className="relative shrink-0 flex items-center gap-3 border-b border-black/[0.07] bg-white/60 backdrop-blur-sm"
        style={{
          marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
          marginLeft: 'calc(-1 * env(safe-area-inset-left, 0px))',
          marginRight: 'calc(-1 * env(safe-area-inset-right, 0px))',
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
          paddingBottom: '0.75rem',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <button
          onClick={onBack}
          className="w-8 h-8 grid place-items-center rounded-full bg-white border border-black/[0.08] shadow-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="font-display text-sm [@media(orientation:landscape)]:text-base font-bold blue-text tracking-wider uppercase">
          Profile
        </h1>
      </div>

      {/* Body — single col portrait, two col landscape */}
      <div className="relative flex-1 flex flex-col [@media(orientation:landscape)]:flex-row overflow-hidden">

        {/* Left / Top — Avatar + stats */}
        <div className="flex flex-col items-center gap-3
          px-5 py-5
          [@media(orientation:landscape)]:w-[40%] [@media(orientation:landscape)]:justify-center
          [@media(orientation:landscape)]:border-r [@media(orientation:landscape)]:border-white/30
          shrink-0">

          <Avatar url={profile.avatar_url} name={profile.username} size="lg" className="border-4 border-white shadow-md" />

          <div className="flex gap-3">
            {[
              { label: 'Games', value: profile.total_games },
              { label: 'Wins', value: profile.wins },
              { label: 'Win Rate', value: `${winRate}%` },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center bg-white/70 rounded-2xl px-4 py-2.5 border border-black/[0.07] shadow-sm min-w-[64px]">
                <span className="font-display text-lg font-bold blue-text leading-tight">{s.value}</span>
                <span className="text-[9px] text-gray-300 tracking-wide uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right / Bottom — Edit fields */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4 [@media(orientation:landscape)]:justify-center">
          <div className="flex flex-col gap-4 w-full max-w-sm mx-auto [@media(orientation:landscape)]:mx-0">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-display tracking-widest uppercase text-[color:var(--color-blue)] opacity-70">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={20}
                className="w-full bg-white border border-black/[0.12] rounded-2xl px-4 py-3.5 text-white focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-display tracking-widest uppercase text-[color:var(--color-blue)] opacity-70">Country · Auto-detected</label>
              <div className="w-full bg-white/70 border border-black/[0.10] rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 text-foreground">
                {profile.country_code ? (
                  <>
                    <span className="text-xl leading-none">{getFlagEmoji(profile.country_code)}</span>
                    <span className="text-sm text-white">{getCountryName(profile.country_code) ?? profile.country_code}</span>
                  </>
                ) : (
                  <span className="text-gray-300 text-sm">Unknown</span>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full h-13 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {loading ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
