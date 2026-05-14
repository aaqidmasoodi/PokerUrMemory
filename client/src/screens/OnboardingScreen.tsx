import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { COUNTRIES, getFlagEmoji } from '../lib/countries';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';

export function OnboardingScreen({
  user,
  onComplete,
}: {
  user: User;
  onComplete: (username: string, countryCode: string) => Promise<string | null>;
}) {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }
  const defaultName = (user.user_metadata?.full_name as string | undefined)
    ?.split(' ')[0] ?? 'Player';

  const [username, setUsername] = useState(defaultName);
  const [countryCode, setCountryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!username.trim()) { setError('Please enter a username'); return; }
    if (!countryCode) { setError('Please select your country'); return; }
    setLoading(true);
    setError('');
    const err = await onComplete(username.trim(), countryCode);
    if (err) { setError(err); setLoading(false); }
  }

  return (
    <div
      className="h-dvh flex flex-col [@media(orientation:landscape)]:flex-row bg-[var(--color-background)] overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />

      {/* Left / Top — Avatar + title */}
      <div className="relative flex flex-col items-center justify-center gap-3
        px-6 pt-8 pb-4
        [@media(orientation:landscape)]:w-[42%] [@media(orientation:landscape)]:h-full
        [@media(orientation:landscape)]:pt-0 [@media(orientation:landscape)]:pb-0
        [@media(orientation:landscape)]:border-r [@media(orientation:landscape)]:border-black/[0.07]">

        <Avatar
          url={user.user_metadata?.avatar_url as string | undefined}
          name={(user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'P'}
          size="lg"
          className="border-4 border-white shadow-md"
        />
        <div className="text-center">
          <h2 className="font-display text-xl font-bold blue-text">Set Up Your Profile</h2>
          <p className="text-xs text-gray-500 mt-1">You can change these anytime in Profile</p>
        </div>
      </div>

      {/* Right / Bottom — Form */}
      <div className="relative flex-1 flex flex-col justify-center gap-4
        px-6 pb-8 pt-2
        [@media(orientation:landscape)]:pb-0 [@media(orientation:landscape)]:pt-0 [@media(orientation:landscape)]:overflow-y-auto">

        <div className="w-full max-w-xs mx-auto flex flex-col gap-4">
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-display tracking-widest uppercase text-[color:var(--color-blue)] opacity-70">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
              className="w-full bg-white border border-black/[0.12] rounded-2xl px-4 py-3 text-foreground focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm"
              placeholder="Your display name"
            />
          </div>

          {/* Country */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-display tracking-widest uppercase text-[color:var(--color-blue)] opacity-70">
              Country
            </label>
            <div className="relative">
              {countryCode && (
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl pointer-events-none">
                  {getFlagEmoji(countryCode)}
                </span>
              )}
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className={`w-full bg-white border border-black/[0.12] rounded-2xl py-3 text-foreground focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm appearance-none ${countryCode ? 'pl-10 pr-4' : 'px-4'}`}
              >
                <option value="">Select your country…</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {getFlagEmoji(c.code)} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center -mt-2">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-13 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_16px_rgba(0,0,0,0.18)] active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {loading ? 'Saving…' : "Let's Play →"}
          </button>

          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors text-center"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
