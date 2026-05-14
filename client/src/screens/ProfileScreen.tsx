import { useState } from 'react';
import type { Profile } from '../lib/supabase';
import { COUNTRIES, getFlagEmoji } from '../lib/countries';
import { ArrowLeft } from 'lucide-react';
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
  const [countryCode, setCountryCode] = useState(profile.country_code ?? '');
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
    const err = await onSave({ username: username.trim(), country_code: countryCode || null });
    setLoading(false);
    if (err) { setError(err); } else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <div
      className="h-dvh flex flex-col bg-[var(--color-background)] overflow-hidden select-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />

      {/* Header */}
      <div className="relative shrink-0 flex items-center gap-3 px-5 pt-4 pb-3 border-b border-black/[0.07]">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-display tracking-wider uppercase text-gray-500 hover:text-[color:var(--color-blue)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <h2 className="font-display text-base font-bold blue-text flex-1 text-center pr-10">Profile</h2>
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {/* Avatar + stats */}
        <div className="flex flex-col items-center gap-3 pb-3 border-b border-black/[0.07]">
          <Avatar url={profile.avatar_url} name={profile.username} size="lg" className="border-4 border-white shadow-md" />

          {/* Stats pills */}
          <div className="flex gap-3">
            {[
              { label: 'Games', value: profile.total_games },
              { label: 'Wins', value: profile.wins },
              { label: 'Win Rate', value: `${winRate}%` },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center bg-white/70 rounded-2xl px-4 py-2.5 border border-black/[0.07] shadow-sm min-w-[64px]">
                <span className="font-display text-lg font-bold blue-text leading-tight">{s.value}</span>
                <span className="text-[9px] text-gray-400 tracking-wide uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Edit fields */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-display tracking-widest uppercase text-[color:var(--color-blue)] opacity-70">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
              className="w-full bg-white border border-black/[0.12] rounded-2xl px-4 py-3.5 text-foreground focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-display tracking-widest uppercase text-[color:var(--color-blue)] opacity-70">Country</label>
            <div className="relative">
              {countryCode && (
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl pointer-events-none">{getFlagEmoji(countryCode)}</span>
              )}
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className={`w-full bg-white border border-black/[0.12] rounded-2xl py-3.5 text-foreground focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm appearance-none ${countryCode ? 'pl-10 pr-4' : 'px-4'}`}
              >
                <option value="">No country selected</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{getFlagEmoji(c.code)} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full h-13 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          {loading ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
