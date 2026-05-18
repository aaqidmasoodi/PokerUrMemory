import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { Check, X } from 'lucide-react';
import type { IncomingInvite } from '../hooks/useSocket';

const INVITE_TIMEOUT_SECS = 30;

export function IncomingInviteModal({
  invite,
  onAccept,
  onDecline,
}: {
  invite: IncomingInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [invite.lobbyId]);

  useEffect(() => {
    if (elapsed >= INVITE_TIMEOUT_SECS) onDecline();
  }, [elapsed, onDecline]);

  const remaining = Math.max(0, INVITE_TIMEOUT_SECS - elapsed);
  const pct = (remaining / INVITE_TIMEOUT_SECS) * 100;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
      <div
        className="bg-[oklch(0.99_0.006_230)] border border-[color:var(--color-blue)]/30 rounded-2xl p-6 max-w-[300px] w-full shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-display tracking-widest uppercase blue-text opacity-70 mb-3">
          Party Invite
        </p>

        <div className="flex justify-center mb-3">
          <Avatar url={invite.fromAvatarUrl} name={invite.fromUsername} size="lg" className="border-2 border-white shadow-sm" />
        </div>

        <p className="text-sm text-foreground mb-1">
          <span className="font-bold">{invite.fromUsername}</span> invited you
        </p>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">to join their party</p>

        <div className="w-full h-1 bg-black/8 rounded-full overflow-hidden mb-1">
          <div
            className="h-full rounded-full bg-[color:var(--color-blue)] transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[9px] text-gray-400 mb-5">{remaining}s to respond</p>

        <div className="flex gap-2">
          <button
            onClick={onDecline}
            className="flex-1 h-12 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-white text-gray-500 border border-black/[0.10] shadow-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 h-12 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow active:scale-[0.97] transition-transform flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
