import { useEffect, useState } from 'react';
import { Users, Crown, Play, LogOut, Loader2 } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import type { WaitingRoomState } from '../hooks/useSocket';

export function WaitingRoomScreen({
  waitingRoom,
  myPlayerId,
  onStart,
  onLeave,
}: {
  waitingRoom: WaitingRoomState;
  myPlayerId: string;
  onStart: () => Promise<{ success: boolean; error?: string }>;
  onLeave: () => void;
}) {
  const me = waitingRoom.players.find(p => p.id === myPlayerId);
  const isHost = !!me?.isHost;
  const host = waitingRoom.players.find(p => p.isHost);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live countdown to the auto-start deadline.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!waitingRoom.deadline) { setSecondsLeft(null); return; }
    const tick = () => {
      const s = Math.max(0, Math.round((waitingRoom.deadline! - Date.now()) / 1000));
      setSecondsLeft(s);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [waitingRoom.deadline]);

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    const res = await onStart();
    if (res.error) { setError(res.error); setBusy(false); }
    // on success the gameState transition unmounts this screen
  };

  // Render seats: filled players first, then empty slots up to the target.
  const target = Math.max(waitingRoom.target, waitingRoom.count, 2);
  const emptySeats = Math.max(0, target - waitingRoom.players.length);

  return (
    <div
      className="h-dvh flex flex-col bg-transparent overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none" />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.07] border border-white/10 mb-3">
              <Loader2 className="w-6 h-6 text-[color:var(--color-gold)] animate-spin" />
            </div>
            <h1 className="font-display text-xl font-bold text-white tracking-wide">Waiting Room</h1>
            <p className="text-[12px] text-white/55 mt-1 leading-snug">
              {isHost
                ? 'Players are joining — start when you’re ready'
                : `Waiting for ${host?.name ?? 'the host'} to start the game`}
            </p>
          </div>

          {/* Seat count + countdown */}
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="flex items-center gap-1.5 text-[11px] text-white/55 font-display tracking-wider uppercase">
              <Users className="w-3.5 h-3.5" />
              {waitingRoom.count} joined
            </span>
            {secondsLeft != null && (
              <span className="text-[11px] text-white/45 tabular-nums">
                Auto-starts in {secondsLeft}s
              </span>
            )}
          </div>

          {/* Seats */}
          <ul className="flex flex-col gap-2 mb-5">
            {waitingRoom.players.map(p => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm px-3 py-2.5"
              >
                <Avatar url={null} name={p.name} size="sm" className={`w-9 h-9 shrink-0 ${p.disconnected ? 'opacity-40' : ''}`} />
                <span className="flex-1 min-w-0 text-[13px] font-semibold text-white truncate flex items-center gap-1.5">
                  {p.name}
                  {p.id === myPlayerId && <span className="text-[10px] text-white/40">(you)</span>}
                </span>
                {p.isHost && (
                  <span className="flex items-center gap-1 text-[9px] font-display tracking-widest uppercase text-[color:var(--color-gold)]">
                    <Crown className="w-3 h-3" />
                    Host
                  </span>
                )}
                {p.disconnected && (
                  <span className="text-[9px] text-amber-300/70 uppercase tracking-wider">offline</span>
                )}
              </li>
            ))}
            {Array.from({ length: emptySeats }).map((_, i) => (
              <li
                key={`empty-${i}`}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 px-3 py-2.5"
              >
                <div className="w-9 h-9 shrink-0 rounded-full border-2 border-dashed border-white/15 bg-white/[0.02]" />
                <span className="text-[12px] text-white/30 italic">Waiting for player…</span>
              </li>
            ))}
          </ul>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11px] text-red-200 leading-snug mb-3">
              {error}
            </div>
          )}

          {/* Actions */}
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={busy || !waitingRoom.canStart}
              className="w-full h-12 rounded-2xl font-display tracking-[0.15em] uppercase text-[13px] font-bold
                bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10
                shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:brightness-110 active:scale-[0.98] transition-all
                disabled:opacity-40 disabled:active:scale-100
                flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {busy ? 'Starting…' : waitingRoom.canStart ? 'Start Game' : 'Need 1 more player'}
            </button>
          ) : (
            <div className="w-full h-12 rounded-2xl bg-white/[0.05] border border-white/10
              flex items-center justify-center gap-2 text-[12px] text-white/50 font-display tracking-wider uppercase">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for host…
            </div>
          )}

          <button
            onClick={onLeave}
            className="w-full h-10 mt-2 rounded-2xl font-display tracking-widest uppercase text-[10px] font-bold
              bg-transparent text-white/45 hover:text-white/70 active:scale-[0.98] transition-all
              flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
