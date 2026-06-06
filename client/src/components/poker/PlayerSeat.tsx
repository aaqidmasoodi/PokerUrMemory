import React from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/useCountdown";
import type { ElementLayout, SeatSize } from "@/lib/tableLayout";

// Long names (PokerSolitaire / PokerPatience) get a smaller font so they fit the
// seat pill without truncation.

const DEAD_MAN_BOT = 'PokerAA88';
const DEAD_MAN_CARDS: { rank: string; suit: string; red: boolean }[] = [
  { rank: 'A', suit: '♥', red: true  },
  { rank: 'A', suit: '♦', red: true  },
  { rank: '8', suit: '♥', red: true  },
  { rank: '8', suit: '♦', red: true  },
];

export function PlayerNameDisplay({ name, nameCls }: { name: string; nameCls: string }) {
  if (name === DEAD_MAN_BOT) {
    return (
      <span className="flex flex-col leading-none gap-px">
        <span className={cn('font-display font-semibold uppercase text-gray-900', nameCls.replace(/max-w-\S+/g, '').replace(/text-\S+/g, ''), 'text-[7px] sm:text-[10px] lg:text-[13px]')}>
          Poker
        </span>
        <span className="flex gap-[1px] items-center">
          {DEAD_MAN_CARDS.map((c, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex flex-col items-center leading-none font-bold bg-white border border-gray-300 rounded-[2px]',
                'shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
                'text-[4px] sm:text-[6px] lg:text-[7px] px-px py-px',
                c.red ? 'text-red-600' : 'text-gray-900',
              )}
            >
              <span>{c.rank}</span>
              <span>{c.suit}</span>
            </span>
          ))}
        </span>
      </span>
    );
  }

  // Long bot names — reduce font so they don't overflow the pill.
  const isLong = name.length > 9;
  const fontOverride = isLong
    ? nameCls.replace(/text-\[8px\]/g, 'text-[6px]').replace(/sm:text-\[11px\]/g, 'sm:text-[9px]').replace(/lg:text-\[14px\]/g, 'lg:text-[13px]')
             .replace(/text-\[7px\]/g, 'text-[5px]').replace(/lg:text-\[10px\]/g, 'lg:text-[9px]')
             .replace(/text-\[6px\]/g, 'text-[5px]').replace(/lg:text-\[9px\]/g, 'lg:text-[8px]')
    : nameCls;

  return (
    <span className={cn('font-display font-semibold uppercase text-gray-900 leading-tight', fontOverride, isLong && 'break-all')}>
      {name}
    </span>
  );
}

// ─── Player seat ─────────────────────────────────────────────────────────────

export const SEAT_CFG = {
  normal:  { pill: "gap-1.5 pl-1 pr-2.5 py-1 lg:gap-2 lg:pl-1.5 lg:pr-3.5 lg:py-1.5",       avatar: "w-6 h-6 sm:w-8 sm:h-8 lg:w-11 lg:h-11 text-[9px] sm:text-sm lg:text-base", name: "text-[8px] sm:text-[11px] lg:text-[14px] max-w-[52px] sm:max-w-[80px] lg:max-w-[120px]", chips: "text-[7px] sm:text-[10px] lg:text-[12px]", showBet: true,  ringPad: 5, numCls: "text-[15px] lg:text-[20px]", flashCls: "text-[14px] sm:text-[18px] lg:text-[22px]" },
  compact: { pill: "gap-1 pl-0.5 pr-2 py-0.5 lg:gap-1.5 lg:pr-2.5 lg:py-1",                  avatar: "w-5 h-5 lg:w-7 lg:h-7 text-[7px] lg:text-[10px]",                         name: "text-[7px] lg:text-[10px] max-w-[36px] lg:max-w-[56px]",                               chips: "text-[6px] lg:text-[9px]",  showBet: true,  ringPad: 3, numCls: "text-[11px] lg:text-[15px]", flashCls: "text-[10px] sm:text-[12px] lg:text-[15px]" },
  mini:    { pill: "gap-0.5 pl-0.5 pr-1.5 py-[1px] lg:gap-1 lg:pr-2 lg:py-0.5",              avatar: "w-4 h-4 lg:w-6 lg:h-6 text-[6px] lg:text-[9px]",                         name: "text-[6px] lg:text-[9px] max-w-[26px] lg:max-w-[40px]",                               chips: "text-[5px] lg:text-[8px]",  showBet: true,  ringPad: 2, numCls: "text-[10px] lg:text-[13px]", flashCls: "text-[8px] sm:text-[10px] lg:text-[13px]" },
} as const;

export interface PlayerSeatProps {
  name: string;
  chips: number;
  bet?: number;
  active?: boolean;
  avatar: string;
  avatarUrl?: string | null;
  folded?: boolean;
  // Client-domain deadline (epoch ms) for this seat's betting turn, or null for no ring.
  // The seat counts down locally from this, so it stays correct across reconnects.
  turnEndsAt?: number | null;
  turnTimeMax?: number;
  size?: SeatSize;
  flashLabel?: string;
  disconnected?: boolean;
}

export function PlayerSeat({
  name, chips, bet, active, avatar, avatarUrl, folded, turnEndsAt, turnTimeMax = 15, size = "normal",
  flashLabel, disconnected,
}: PlayerSeatProps) {
  const cfg = SEAT_CFG[size];
  const msLeft = useCountdown(turnEndsAt ?? null);
  const showRing = active && !folded && turnEndsAt != null && msLeft > 0;
  const turnTimeLeft = Math.ceil(msLeft / 1000);
  const pct  = showRing ? Math.max(0, Math.min(100, (msLeft / (turnTimeMax * 1000)) * 100)) : 100;
  const timerColor = showRing
    ? pct > 60 ? "#22c55e"
    : pct > 33 ? "#f59e0b"
    : "#ef4444"
    : "#e2e8f0";

  // When showing action (flashLabel), use blue background with white text
  const showAction = !!flashLabel;
  const actionBgColor = '#1e40af';

  // Outer wrapper carries the ring; inner pill (fully opaque) masks the gradient center
  const ringStyle = showRing
    ? {
        padding: `${cfg.ringPad}px`,
        borderRadius: '9999px',
        background: `conic-gradient(${timerColor} ${pct.toFixed(1)}%, #e2e8f0 ${pct.toFixed(1)}%)`,
        boxShadow: pct <= 33 ? `0 0 18px 3px ${timerColor}99` : undefined,
      }
    : showAction
    ? { padding: '3px', borderRadius: '9999px', background: actionBgColor, boxShadow: '0 0 20px rgba(0,0,0,0.5)' }
    : active && !folded
    ? { padding: '2px', borderRadius: '9999px', background: '#d4a843', boxShadow: '0 0 14px rgba(212,168,67,0.35)' }
    : { padding: '1px', borderRadius: '9999px', background: 'rgba(0,0,0,0.10)' };

  return (
    <div className="shrink-0 flex flex-col items-center gap-1">
      {/* Ring wrapper + pill */}
      <div className="relative" style={ringStyle}>
        {/* Pulsing dot — gold for active turn, amber for disconnected */}
        {disconnected && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse z-10" />
        )}
        {!disconnected && active && !folded && !showRing && !showAction && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[color:var(--color-gold)] shadow-[0_0_8px_rgba(212,168,67,1)] animate-pulse z-10" />
        )}

        {/* Pill — bg-white normally, bg-blue when action showing */}
        <div className={cn(
          "flex items-center rounded-full shadow-md",
          cfg.pill,
          (folded || disconnected) && "opacity-40 grayscale",
          showAction ? "bg-blue-700" : "bg-white",
        )}>
          {showAction ? (
            /* Action showing: large white text + bet amount */
            <div className="flex items-center gap-2 px-3 py-1">
              <span className={cn("font-display font-black uppercase tracking-wider text-white", cfg.flashCls)}>
                {flashLabel}
              </span>
              {typeof bet === "number" && bet > 0 && (
                <div className="flex flex-col items-center border-l border-white/30 pl-2">
                  <span className="font-bold text-white text-[10px] sm:text-[12px]">{bet}pts</span>
                  <span className="text-[4px] uppercase text-white/70 tracking-wider">bet</span>
                </div>
              )}
            </div>
          ) : (
            /* Normal: show avatar, name, chips */
            <>
              <div
                className={cn(
                  "shrink-0 rounded-full grid place-items-center font-display font-bold text-white overflow-hidden",
                  cfg.avatar,
                  // Gold gradient only when no real image and not in timer-ring mode
                  !showRing && !(avatarUrl && !disconnected) && "bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)]",
                )}
                style={showRing ? { backgroundColor: timerColor } : undefined}
              >
                {showRing
                  ? <span className="font-black tabular-nums">{turnTimeLeft}</span>
                  : disconnected
                    ? <WifiOff className="w-3 h-3" />
                    : avatarUrl
                      ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : avatar}
              </div>
              <div className="flex flex-col leading-none">
                <PlayerNameDisplay name={name} nameCls={cfg.name} />
                <span className={cn("font-bold text-gray-700", cfg.chips)}>
                  {chips.toLocaleString()}pts
                </span>
              </div>
            </>
          )}
          {/* Bet - always show and bigger */}
          {!showAction && cfg.showBet && typeof bet === "number" && bet > 0 && (
            <div className="flex flex-col items-center pl-2 border-l border-gray-300 ml-1">
              <span className="font-bold text-gray-800 text-[10px] sm:text-[12px]">{bet}pts</span>
              <span className="text-[5px] uppercase text-gray-500 tracking-wider">bet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Layout box (position + scale a single element) ───────────────────────────
//
// Centre-anchors `children` at the element's (x, y) and scales around that
// centre, so size changes never shift the element's position. Shared by the live
// game and the layout editor so both render pixel-identically.

export function LayoutBox({
  el, className, children, onPointerDown,
}: {
  el: ElementLayout;
  className?: string;
  children: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className={cn("absolute", className)}
      style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)', touchAction: onPointerDown ? 'none' : undefined }}
      onPointerDown={onPointerDown}
    >
      <div style={{ transform: `scale(${el.scale})` }}>
        {children}
      </div>
    </div>
  );
}
