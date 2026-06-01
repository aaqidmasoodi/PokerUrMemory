import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../lib/supabase';
import { getCountryName, getFlagEmoji } from '../lib/countries';
import { ChevronLeft, Coins, Flame, Trophy, Award, Pencil, Check, X } from 'lucide-react';
import { Avatar } from '../components/Avatar';

const HAND_RANK_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush',
];

export function ProfileScreen({
  profile,
  onSave,
  onBack,
}: {
  profile: Profile;
  onSave: (updates: Partial<Pick<Profile, 'username' | 'country_code'>>) => Promise<string | null>;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftUsername, setDraftUsername] = useState(profile.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const winRate = profile.total_games > 0
    ? Math.round((profile.wins / profile.total_games) * 100)
    : 0;
  const handWinRate = profile.hands_played > 0
    ? Math.round((profile.hands_won / profile.hands_played) * 100)
    : 0;
  const bestHandText = profile.best_hand_rank >= 0
    ? (profile.best_hand_name ?? HAND_RANK_NAMES[profile.best_hand_rank] ?? '—')
    : '—';
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })
    : null;

  const allStats = [
    { label: 'Games', value: profile.total_games },
    { label: 'Wins', value: profile.wins },
    { label: 'Win %', value: `${winRate}%` },
    { label: 'Hands', value: profile.hands_played },
    { label: 'Hand W', value: profile.hands_won },
    { label: 'Hand %', value: `${handWinRate}%` },
  ];
  const highlights = [
    { icon: <Coins className="w-3.5 h-3.5" />, label: 'Points Won', value: `${profile.pots_won_total.toLocaleString()}` },
    { icon: <Flame className="w-3.5 h-3.5" />, label: 'Biggest Pot', value: `${profile.biggest_pot_won.toLocaleString()}` },
    { icon: profile.best_hand_rank >= 7 ? <Trophy className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />, label: 'Best Hand', value: bestHandText },
  ];

  function startEditing() {
    setDraftUsername(profile.username);
    setError('');
    setEditing(true);
  }

  function cancelEditing() {
    setDraftUsername(profile.username);
    setError('');
    setEditing(false);
  }

  async function commitEdit() {
    const trimmed = draftUsername.trim();
    if (!trimmed) { setError('Cannot be empty'); return; }
    if (trimmed === profile.username) { setEditing(false); return; }
    setSaving(true);
    setError('');
    const err = await onSave({ username: trimmed });
    setSaving(false);
    if (err) { setError(err); } else { setEditing(false); }
  }

  function renderNameField(textClass: string) {
    if (!editing) {
      return (
        <button
          onClick={startEditing}
          className="group inline-flex items-center gap-2 max-w-full active:scale-[0.98] transition-transform"
        >
          <span className={`${textClass} truncate`}>{profile.username}</span>
          <Pencil className="w-3.5 h-3.5 text-white/35 group-hover:text-[color:var(--color-gold)] transition-colors shrink-0" />
        </button>
      );
    }
    return (
      <div className="flex items-center gap-1.5 w-full max-w-[260px]">
        <input
          ref={inputRef}
          type="text"
          value={draftUsername}
          maxLength={20}
          onChange={e => setDraftUsername(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') cancelEditing();
          }}
          className={`${textClass} bg-transparent border-b border-[color:var(--color-gold)]/60 focus:border-[color:var(--color-gold)] outline-none min-w-0 flex-1 text-center`}
        />
        <button
          onClick={commitEdit}
          disabled={saving}
          className="w-7 h-7 grid place-items-center rounded-full bg-[color:var(--color-gold)]/20 text-[color:var(--color-gold)] active:scale-90 transition-transform disabled:opacity-40 shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={cancelEditing}
          disabled={saving}
          className="w-7 h-7 grid place-items-center rounded-full bg-white/10 text-white/60 active:scale-90 transition-transform disabled:opacity-40 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  function renderSectionLabel(label: string) {
    return (
      <p className="font-display text-[9px] tracking-[0.3em] uppercase text-[color:var(--color-gold)]/70 font-semibold mb-1.5">
        {label}
      </p>
    );
  }

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
          <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold">Player Profile</p>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 flex flex-col landscape:flex-row overflow-y-auto landscape:overflow-hidden">

        {/* ── Left column: identity hero ── */}
        <div className="shrink-0 flex flex-col items-center gap-3 px-6 py-5
          landscape:w-[38%] landscape:border-r landscape:border-white/10
          landscape:py-3 landscape:px-4 landscape:gap-2 landscape:justify-center landscape:overflow-hidden">

          {/* Avatar with gold ring */}
          <div className="p-[3px] rounded-full bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] shadow-[0_0_32px_rgba(212,168,67,0.3)]">
            <div className="p-0.5 rounded-full bg-[oklch(0.22_0.06_148)]">
              <div className="w-24 h-24 landscape:w-16 landscape:h-16">
                <Avatar
                  url={profile.avatar_url}
                  name={profile.username}
                  className="!w-full !h-full !text-3xl landscape:!text-xl"
                />
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="w-full flex justify-center">
            {renderNameField('font-display text-xl landscape:text-lg font-bold text-white leading-tight tracking-wide')}
          </div>

          {error && (
            <p className="text-[11px] text-red-400 -mt-1">{error}</p>
          )}

          {/* Country */}
          {profile.country_code && (
            <p className="text-sm landscape:text-xs text-white/50 flex items-center gap-1.5 -mt-1">
              <span className="text-base leading-none">{getFlagEmoji(profile.country_code)}</span>
              <span>{getCountryName(profile.country_code) ?? profile.country_code}</span>
            </p>
          )}

          {/* Member since */}
          {memberSince && (
            <div className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10">
              <p className="font-display text-[9px] tracking-[0.25em] uppercase text-white/45 font-semibold">
                Member since {memberSince}
              </p>
            </div>
          )}

          {/* Portrait-only: stats live below identity */}
          <div className="landscape:hidden w-full max-w-xs flex flex-col gap-3 mt-2">
            <div>
              {renderSectionLabel('Performance')}
              <div className="grid grid-cols-3 gap-2">
                {allStats.slice(0, 3).map(s => (
                  <div key={s.label} className="flex flex-col items-center bg-white/[0.06] border border-white/10 rounded-2xl py-2.5 backdrop-blur-sm">
                    <span className="font-display text-base font-bold text-white leading-tight tabular-nums">{s.value}</span>
                    <span className="text-[8px] text-white/40 tracking-widest uppercase mt-0.5">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {allStats.slice(3).map(s => (
                  <div key={s.label} className="flex flex-col items-center bg-white/[0.06] border border-white/10 rounded-2xl py-2.5 backdrop-blur-sm">
                    <span className="font-display text-base font-bold text-white leading-tight tabular-nums">{s.value}</span>
                    <span className="text-[8px] text-white/40 tracking-widest uppercase mt-0.5">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              {renderSectionLabel('Highlights')}
              <div className="flex flex-col gap-1.5">
                {highlights.map(h => (
                  <div key={h.label} className="flex items-center gap-3 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2">
                    <div className="w-7 h-7 rounded-lg bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] grid place-items-center shrink-0">
                      {h.icon}
                    </div>
                    <span className="text-[10px] text-white/50 tracking-widest uppercase font-display font-semibold">
                      {h.label}
                    </span>
                    <span className="ml-auto text-[12px] font-bold text-white tabular-nums">
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: stats (landscape only) ── */}
        <div className="hidden landscape:flex flex-1 flex-col justify-center gap-4 px-6 py-3 lg:px-8 overflow-hidden">

          {/* Performance: 6 tiles in one row */}
          <div>
            {renderSectionLabel('Performance')}
            <div className="flex gap-1.5">
              {allStats.map(s => (
                <div
                  key={s.label}
                  className="flex-1 flex flex-col items-center bg-white/[0.06] border border-white/10 rounded-xl py-2 px-1 backdrop-blur-sm"
                >
                  <span className="font-display text-base lg:text-lg font-bold text-white leading-tight tabular-nums">
                    {s.value}
                  </span>
                  <span className="text-[8px] text-white/40 tracking-widest uppercase mt-0.5 truncate w-full text-center">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights: 3 cards in one row */}
          <div>
            {renderSectionLabel('Highlights')}
            <div className="grid grid-cols-3 gap-1.5">
              {highlights.map(h => (
                <div
                  key={h.label}
                  className="flex flex-col items-center gap-1 bg-white/[0.05] border border-white/10 rounded-xl px-2 py-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] grid place-items-center shrink-0">
                    {h.icon}
                  </div>
                  <span className="text-[8px] text-white/45 tracking-widest uppercase font-display font-semibold text-center leading-tight">
                    {h.label}
                  </span>
                  <span className="text-[12px] font-bold text-white tabular-nums text-center truncate w-full">
                    {h.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
