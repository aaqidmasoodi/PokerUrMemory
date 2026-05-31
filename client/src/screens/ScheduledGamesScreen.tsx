import { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { ChevronLeft, CalendarPlus, Clock, Users, X, Crown, LogOut } from 'lucide-react';
import type { Profile } from '../lib/supabase';
import { getFlagEmoji } from '../lib/countries';
import { Avatar } from '../components/Avatar';
import { useScheduledGames } from '../hooks/useScheduledGames';
import {
  createScheduledGame,
  cancelScheduledGame,
  reserveSpot,
  cancelReservation,
  maxScheduleDate,
  formatLocalDateTime,
  localTimeZoneLabel,
  formatCountdown,
  type ScheduledGameWithSeats,
} from '../lib/scheduledGames';

// Round a Date up to the next 15-minute boundary.
const STEP_MS = 1 * 60 * 1000;
function roundUpTo15Min(d: Date): Date {
  return new Date(Math.ceil(d.getTime() / STEP_MS) * STEP_MS);
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function ScheduledGamesScreen({
  profile,
  onBack,
  onLaunchGame,
}: {
  profile: Profile;
  onBack: () => void;
  onLaunchGame: (gameId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const { games, loading, refetch } = useScheduledGames(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticking clock for live countdowns.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const tz = useMemo(() => localTimeZoneLabel(), []);

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
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none" />

      {/* Header */}
      <div
        className="relative shrink-0 z-10 flex items-center gap-2 px-4 landscape:px-8"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.75rem' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm active:scale-95 transition-transform shrink-0"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
          <span className="font-display text-[10px] font-bold text-white/70 tracking-widest uppercase">Back</span>
        </button>
        <div className="flex-1 flex justify-center pointer-events-none">
          <p className="font-display text-[11px] tracking-[0.3em] uppercase text-white font-semibold">Scheduled Games</p>
        </div>
        <button
          onClick={() => { setError(null); setShowCreate(true); }}
          className="flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full
            bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
            border border-black/10 shadow-md active:scale-95 transition-transform shrink-0"
        >
          <CalendarPlus className="w-3.5 h-3.5 text-white" />
          <span className="font-display text-[10px] font-bold text-white tracking-widest uppercase">Schedule</span>
        </button>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 landscape:px-8 pb-6">
        <div className="mx-auto w-full max-w-md landscape:max-w-none lg:max-w-none xl:max-w-none">

          <div className="flex items-center justify-between px-1 mt-1 mb-2">
            <p className="font-display text-[10px] tracking-[0.25em] uppercase text-white/50">Available Games</p>
            {tz && (
              <p className="text-[9px] text-white/35">Times in your local zone ({tz})</p>
            )}
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-[11px] text-red-200 leading-snug mb-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-7 h-7 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
              <p className="text-[11px] text-white/40 tracking-wider uppercase font-display">Loading…</p>
            </div>
          ) : games.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 grid place-items-center">
                <Clock className="w-6 h-6 text-white/40" />
              </div>
              <p className="text-[12px] text-white/50 leading-relaxed max-w-[220px]">
                No games scheduled yet. Be the first — tap <span className="text-white/70 font-semibold">Schedule</span> above.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 landscape:grid-cols-2 lg:grid-cols-2 gap-3">
              {games.map(game => (
                <GameCard
                  key={game.id}
                  game={game}
                  now={now}
                  currentUserId={profile.id}
                  onError={setError}
                  onRefetch={refetch}
                  onLaunchGame={onLaunchGame}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateGameSheet
          profile={profile}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ─── Game card ───────────────────────────────────────────────────────────────

function GameCard({
  game,
  now,
  currentUserId,
  onError,
  onRefetch,
  onLaunchGame,
}: {
  game: ScheduledGameWithSeats;
  now: number;
  currentUserId: string;
  onError: (msg: string | null) => void;
  onRefetch: () => Promise<void>;
  onLaunchGame: (gameId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const isHost = game.host_id === currentUserId;
  const reserved = game.reservations.some(r => r.user_id === currentUserId);
  const filled = game.reservations.length;
  const isFull = filled >= game.max_players;
  const countdown = formatCountdown(game.scheduled_at, now);
  const startingNow = new Date(game.scheduled_at).getTime() - now <= 0;

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    onError(null);
    const { error } = await fn();
    if (error) {
      setBusy(false);
      onError(error);
      return;
    }
    await onRefetch();
    setBusy(false);
  };

  return (
    <li className="rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm p-3.5 shadow-sm">
      {/* Host + countdown */}
      <div className="flex items-center gap-3">
        <Avatar url={game.host_avatar_url} name={game.host_username} size="sm" className="w-10 h-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white truncate flex items-center gap-1.5">
            <Crown className="w-3 h-3 text-[color:var(--color-gold)] shrink-0" />
            {game.host_username}
            {game.host_country_code && <span>{getFlagEmoji(game.host_country_code)}</span>}
          </p>
          <p className="text-[10px] text-white/45 mt-0.5">{formatLocalDateTime(game.scheduled_at)}</p>
        </div>
        <div className={`shrink-0 flex flex-col items-end ${startingNow ? 'animate-pulse' : ''}`}>
          <span className="font-display text-[9px] tracking-widest uppercase text-white/35">
            {startingNow ? '' : 'Starts in'}
          </span>
          <span
            className="font-display font-black tabular-nums text-[15px] text-[color:var(--color-gold)] leading-none"
            style={{ textShadow: '0 0 14px rgba(212,168,67,0.4)' }}
          >
            {countdown}
          </span>
        </div>
      </div>

      {/* Seats */}
      <div className="flex items-center gap-2 mt-3">
        <div className="flex -space-x-2 flex-1">
          {Array.from({ length: game.max_players }).map((_, i) => {
            const r = game.reservations[i];
            if (!r) {
              return (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-dashed border-white/15 bg-white/[0.03]"
                />
              );
            }
            return (
              <Avatar
                key={r.user_id}
                url={r.avatar_url}
                name={r.username}
                size="sm"
                className="w-7 h-7 border-2 border-[oklch(0.22_0.06_148)]"
              />
            );
          })}
        </div>
        <span className="shrink-0 flex items-center gap-1 text-[10px] text-white/45 font-display tracking-wider">
          <Users className="w-3 h-3" />
          {filled}/{game.max_players}
        </span>
      </div>

      {/* Action */}
      <div className="mt-3">
        {isHost && startingNow ? (
          <button
            onClick={() => run(() => onLaunchGame(game.id))}
            disabled={busy}
            className="w-full h-10 rounded-xl font-display tracking-widest uppercase text-[10px] font-bold
              bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
              text-white border border-black/10 shadow
              active:scale-[0.98] transition-all disabled:opacity-50
              flex items-center justify-center gap-1.5"
          >
            {busy ? 'Launching…' : '🚀 Launch Game'}
          </button>
        ) : isHost ? (
          <button
            onClick={() => run(() => cancelScheduledGame(game.id))}
            disabled={busy}
            className="w-full h-10 rounded-xl font-display tracking-widest uppercase text-[10px] font-bold
              bg-red-500/10 border border-red-500/30 text-red-300 active:scale-[0.98] transition-all
              flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Cancel Game
          </button>
        ) : reserved ? (
          <button
            onClick={() => run(() => cancelReservation(game.id, currentUserId))}
            disabled={busy}
            className="w-full h-10 rounded-xl font-display tracking-widest uppercase text-[10px] font-bold
              bg-white/[0.06] border border-white/15 text-white/70 active:scale-[0.98] transition-all
              flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave — You're In
          </button>
        ) : isFull ? (
          <div className="w-full h-10 rounded-xl font-display tracking-widest uppercase text-[10px] font-bold
            bg-white/[0.03] border border-white/10 text-white/30 flex items-center justify-center">
            Full
          </div>
        ) : (
          <button
            onClick={() => run(() => reserveSpot(game.id))}
            disabled={busy}
            className="w-full h-10 rounded-xl font-display tracking-widest uppercase text-[10px] font-bold
              bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10
              shadow active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {busy ? 'Joining…' : 'Join Game'}
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Create game sheet ───────────────────────────────────────────────────────

function CreateGameSheet({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const maxDateVal = useMemo(() => maxScheduleDate(), []);
  const defaultDate = useMemo(() => roundUpTo15Min(new Date(Date.now() + 60 * 60 * 1000)), []);

  const [selectedDate, setSelectedDate] = useState<Date>(defaultDate);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clamp available times so past slots are greyed out when today is selected.
  const minTime = isSameCalendarDay(selectedDate, new Date())
    ? roundUpTo15Min(new Date(Date.now() + 60 * 1000))
    : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0);
  const maxTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 45);

  const handleCreate = async () => {
    setError(null);
    if (!selectedDate || isNaN(selectedDate.getTime())) { setError('Pick a valid date and time'); return; }
    if (selectedDate.getTime() <= Date.now()) { setError('Pick a time in the future'); return; }
    if (selectedDate.getTime() > maxDateVal.getTime()) { setError('You can only schedule up to 48 hours ahead'); return; }

    setBusy(true);
    const { error } = await createScheduledGame(profile, selectedDate.toISOString(), maxPlayers);
    setBusy(false);
    if (error) { setError(error); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl border-t sm:border border-[color:var(--color-gold)]/30 shadow-2xl p-5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-bold blue-text flex items-center gap-2">
            <CalendarPlus className="w-4 h-4" />
            Schedule a Game
          </h3>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full bg-black/[0.06] active:scale-90 transition-all">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <label className="block text-[10px] font-display tracking-widest uppercase text-gray-400 mb-1.5">Date & Time</label>
        <div className="pum-datepicker">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            showTimeSelect
            timeIntervals={1}
            minDate={roundUpTo15Min(new Date(Date.now() + 60 * 1000))}
            maxDate={maxDateVal}
            minTime={minTime}
            maxTime={maxTime}
            dateFormat="MMM d, yyyy · h:mm aa"
            timeCaption="Time"
            popperClassName="pum-dp-popper z-[400]"
            popperPlacement="bottom-start"
            popperProps={{ strategy: 'fixed' }}
            className="w-full bg-white border border-black/[0.12] rounded-xl px-3 py-2.5 text-sm
              focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm cursor-pointer"
            wrapperClassName="w-full"
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          1-minute intervals · up to 48 hours from now · max 2 hosted games
        </p>

        <label className="block text-[10px] font-display tracking-widest uppercase text-gray-400 mb-1.5 mt-4">Table Size</label>
        <div className="grid grid-cols-3 gap-2">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setMaxPlayers(n)}
              className={`h-10 rounded-xl font-display text-[12px] font-bold tracking-wider transition-all border ${
                maxPlayers === n
                  ? 'bg-[color:var(--color-blue)] text-white border-[color:var(--color-blue)]'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {n} Players
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700 leading-snug mt-4">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full h-12 mt-5 rounded-2xl font-display tracking-[0.15em] uppercase text-[12px] font-bold
            bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10
            shadow hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {busy ? 'Scheduling…' : 'Schedule Game'}
        </button>
      </div>
    </div>
  );
}
