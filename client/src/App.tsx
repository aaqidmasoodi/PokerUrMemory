import { useState, useEffect } from "react";
import { useSocket, type DiscardEntry } from "./hooks/useSocket";
import { PlayingCard } from "./components/poker/PlayingCard";
import { ChipStack } from "./components/poker/ChipStack";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { cn } from "./lib/utils";
import { Clock, Eye, LogOut, Copy, Check, RefreshCw } from "lucide-react";

// ─── Random username generator ────────────────────────────────────────────────

const _ADJ = [
  "Wild","Silent","Dark","Lucky","Iron","Steel","Phantom","Shadow",
  "Rogue","Slick","Neon","Sharp","Ghost","Swift","Ace","Bold",
  "Sly","Cold","Crazy","Bluff",
];
const _NOUN = [
  "Shark","Fox","Hustler","Dealer","Maverick","Joker","Trickster",
  "Gambler","Wolf","Viper","Tiger","King","Cobra","Hawk","Eagle",
  "Bluffer","Raiser","Caller","Phantom","Ace",
];
function randomUsername() {
  const adj  = _ADJ [Math.floor(Math.random() * _ADJ.length)];
  const noun = _NOUN[Math.floor(Math.random() * _NOUN.length)];
  const num  = Math.floor(Math.random() * 90) + 10;
  return `${adj}${noun}${num}`;
}

type Phase = "waiting" | "memoryReveal" | "firstBetting" | "draw" | "discardReveal" | "drawReveal" | "secondBetting" | "showdown";

// ─── Phase badge ─────────────────────────────────────────────────────────────

function PhaseBadge({
  phase, timer,
}: {
  phase: Phase; timer?: number | null;
}) {
  const map: Record<Phase, string> = {
    waiting: "Waiting", memoryReveal: "Memory", firstBetting: "Betting",
    draw: "Draw", discardReveal: "Discards", drawReveal: "Reveal", secondBetting: "Betting", showdown: "Showdown",
  };
  const isEye = phase === "memoryReveal" || phase === "drawReveal";
  const isBetting = phase === "firstBetting" || phase === "secondBetting";

  const displayTimer: number | null = isBetting
    ? null
    : (typeof timer === "number" ? timer : null);

  const hasTimer = displayTimer != null && displayTimer > 0;
  const timerColor = "var(--color-gold)";

  return (
    <div className="pointer-events-none">
      <div className={cn(
        "flex flex-col items-center rounded-2xl bg-white/90 gold-border backdrop-blur-sm shadow-md",
        hasTimer ? "px-3 pt-1.5 pb-2" : "px-2.5 py-1.5",
      )}>
        <div className="flex items-center gap-1.5">
          {isEye
            ? <Eye className="w-3 h-3 text-[color:var(--color-gold)]" />
            : <Clock className="w-3 h-3 text-[color:var(--color-gold)]" />
          }
          <span className="font-display text-[9px] sm:text-[11px] font-semibold tracking-widest uppercase gold-text whitespace-nowrap">
            {map[phase]}
          </span>
        </div>
        {hasTimer && (
          <span
            className="font-display font-black leading-none tabular-nums text-[38px] sm:text-[52px] mt-0.5"
            style={{ color: timerColor, textShadow: `0 0 18px ${timerColor}99, 0 0 40px ${timerColor}44` }}
          >
            {displayTimer}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Player seat ─────────────────────────────────────────────────────────────

const SEAT_CFG = {
  normal:  { pill: "gap-1.5 pl-1 pr-2.5 py-1",       avatar: "w-6 h-6 sm:w-8 sm:h-8 text-[9px] sm:text-sm", name: "text-[8px] sm:text-[11px] max-w-[52px] sm:max-w-[80px]", chips: "text-[7px] sm:text-[10px]", showBet: true,  ringPad: 5, numCls: "text-[15px]" },
  compact: { pill: "gap-1 pl-0.5 pr-2 py-0.5",         avatar: "w-5 h-5 text-[7px]",                           name: "text-[7px] max-w-[36px]",                               chips: "text-[6px]",               showBet: false, ringPad: 3, numCls: "text-[11px]" },
  mini:    { pill: "gap-0.5 pl-0.5 pr-1.5 py-[1px]",   avatar: "w-4 h-4 text-[6px]",                           name: "text-[6px] max-w-[26px]",                               chips: "text-[5px]",               showBet: false, ringPad: 2, numCls: "text-[10px]" },
} as const;

function PlayerSeat({
  name, chips, bet, active, avatar, folded, turnTimeLeft, size = "normal",
}: {
  name: string; chips: number; bet?: number; active?: boolean;
  avatar: string; folded?: boolean; turnTimeLeft?: number | null;
  size?: "normal" | "compact" | "mini";
}) {
  const cfg = SEAT_CFG[size];
  const showRing = active && !folded && turnTimeLeft != null;
  const pct  = showRing ? (turnTimeLeft! / 30) * 100 : 100;
  const timerColor = showRing
    ? turnTimeLeft! > 18 ? "#22c55e"
    : turnTimeLeft! > 10 ? "#f59e0b"
    : "#ef4444"
    : "#e2e8f0";

  // Outer wrapper carries the ring; inner pill (fully opaque) masks the gradient center
  const ringStyle = showRing
    ? {
        padding: `${cfg.ringPad}px`,
        borderRadius: '9999px',
        background: `conic-gradient(${timerColor} ${pct.toFixed(1)}%, #e2e8f0 ${pct.toFixed(1)}%)`,
        boxShadow: turnTimeLeft! <= 10 ? `0 0 18px 3px ${timerColor}99` : undefined,
      }
    : active && !folded
    ? { padding: '2px', borderRadius: '9999px', background: '#d4a843', boxShadow: '0 0 14px rgba(212,168,67,0.35)' }
    : { padding: '1px', borderRadius: '9999px', background: 'rgba(0,0,0,0.10)' };

  return (
    <div className="shrink-0 flex flex-col items-center gap-1">
      {/* Ring wrapper + pill */}
      <div className="relative" style={ringStyle}>
        {/* Pulsing dot when it's this player's turn but no per-player timer yet */}
        {active && !folded && !showRing && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[color:var(--color-gold)] shadow-[0_0_8px_rgba(212,168,67,1)] animate-pulse z-10" />
        )}

        {/* Pill — bg-white (fully opaque) so it masks the gradient centre */}
        <div className={cn(
          "flex items-center rounded-full bg-white shadow-md",
          cfg.pill,
          folded && "opacity-40 grayscale",
        )}>
          <div className={cn(
            "shrink-0 rounded-full grid place-items-center font-display font-bold bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] text-white",
            cfg.avatar,
          )}>
            {avatar}
          </div>
          <div className="flex flex-col leading-none">
            <span className={cn("font-display font-semibold uppercase truncate text-foreground/90", cfg.name)}>
              {name}
            </span>
            <span className={cn("font-bold gold-text", cfg.chips)}>
              ${chips.toLocaleString()}
            </span>
          </div>
          {cfg.showBet && typeof bet === "number" && bet > 0 && (
            <span className="text-[6px] sm:text-[8px] text-[color:var(--color-gold)] pl-1.5 border-l border-black/10 leading-none whitespace-nowrap">
              <span className="block opacity-60 tracking-wider text-[5px] uppercase">bet</span>
              ${bet}
            </span>
          )}
        </div>
      </div>

      {/* Large countdown number — very readable, colour-coded */}
      {showRing && (
        <span
          className={cn("font-display font-black leading-none tabular-nums", cfg.numCls)}
          style={{ color: timerColor, textShadow: `0 0 10px ${timerColor}66` }}
        >
          {turnTimeLeft}s
        </span>
      )}
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({
  label, variant = "ghost", onClick, className, disabled,
}: {
  label: React.ReactNode; variant?: "primary" | "ghost"; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 rounded-xl font-display tracking-wider uppercase text-[9px] font-bold transition-all px-3",
        variant === "primary"
          ? "bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          : "bg-white/90 text-[color:var(--color-blue)] blue-border hover:bg-white shadow-sm",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      {label}
    </Button>
  );
}

// ─── Discard reveal overlay ───────────────────────────────────────────────────

function fanTransform(index: number, total: number): string {
  if (total <= 1) return '';
  const maxAngle = Math.min((total - 1) * 6, 18);
  const step = maxAngle / (total - 1);
  const angle = -maxAngle / 2 + step * index;
  const lift = Math.abs(angle) * 0.4;
  return `rotate(${angle}deg) translateY(${lift}px)`;
}

function DiscardGroup({ entry }: { entry: DiscardEntry }) {
  const cardWidth = 36;
  const fanOverlap = 18;
  const containerW = entry.cards.length <= 1
    ? cardWidth
    : cardWidth + fanOverlap * (entry.cards.length - 1);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[9px] uppercase tracking-widest font-display gold-text bg-white/90 px-2 py-0.5 rounded-full gold-border whitespace-nowrap shadow-sm">
        {entry.playerName}
      </span>

      {entry.cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[62px]">
          <span className="text-[9px] text-gray-500 italic tracking-wide">Stand Pat</span>
        </div>
      ) : (
        <div className="relative" style={{ width: containerW, height: 62 }}>
          {entry.cards.map((card, i) => (
            <div
              key={i}
              className="absolute bottom-0"
              style={{
                left: i * fanOverlap,
                transform: fanTransform(i, entry.cards.length),
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              <PlayingCard card={card as any} faceUp size="sm" />
            </div>
          ))}
        </div>
      )}

      {entry.cards.length > 0 && (
        <span className="text-[8px] text-gray-500 tracking-wide">
          {entry.cards.length} discarded
        </span>
      )}
    </div>
  );
}

function DiscardRevealOverlay({
  discards, timer,
}: {
  discards: DiscardEntry[];
  timer: number | null;
}) {
  const count = discards.length;
  const gridClass = count <= 2
    ? "flex flex-row flex-wrap gap-6 sm:gap-10 justify-center items-start"
    : "grid grid-cols-2 gap-4 sm:gap-6";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[oklch(0.95_0.025_232)]/95 backdrop-blur-sm px-4">
      <p className="font-display text-[10px] sm:text-xs uppercase tracking-[0.2em] gold-text mb-5">
        Cards Discarded
      </p>

      <div className={gridClass}>
        {discards.map(entry => (
          <DiscardGroup key={entry.playerId} entry={entry} />
        ))}
      </div>

      <div className="mt-6 w-40 sm:w-52 h-[3px] rounded-full bg-black/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[color:var(--color-gold)] transition-all duration-1000 ease-linear"
          style={{ width: `${((timer ?? 0) / 10) * 100}%` }}
        />
      </div>
      <p className="text-[8px] text-gray-500 mt-1.5 uppercase tracking-widest">
        {timer ?? 0}s
      </p>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[oklch(0.13_0.05_240)]/40 backdrop-blur-sm p-6">
      <div
        className="bg-[oklch(0.99_0.006_230)] border border-[color:var(--color-gold)]/30 rounded-2xl p-6 max-w-[280px] w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-bold gold-text mb-2">{title}</h3>
        <p className="text-xs text-gray-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <ActionButton label={cancelLabel} onClick={onCancel} className="flex-1" />
          <ActionButton label={confirmLabel} variant="primary" onClick={onConfirm} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

// ─── Decorative card fan ──────────────────────────────────────────────────────

function CardFan() {
  return (
    <div className="relative h-28 w-44 flex-shrink-0">
      <div className="absolute top-5 left-3 -rotate-[18deg] origin-bottom">
        <PlayingCard card={{ rank: "A", suit: "♠" }} faceUp size="sm" />
      </div>
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
        <PlayingCard card={{ rank: "K", suit: "♥" }} faceUp size="sm" />
      </div>
      <div className="absolute top-5 right-3 rotate-[18deg] origin-bottom">
        <PlayingCard card={{ rank: "Q", suit: "♦" }} faceUp size="sm" />
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const {
    uiState, roomCode, playerId, isHost, lobbyPlayers, gameState,
    myTurnData, actionLog, timer, showdownData, discardRevealData, selectedDrawCards, hasDiscarded,
    turnTimer,
    createRoom, joinRoom, startGame, playAction, toggleDrawCard, confirmDiscard, leaveGame,
  } = useSocket();

  const [playerNameInput, setPlayerNameInput] = useState(() => randomUsername());
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [raiseAmount, setRaiseAmount] = useState<number[]>([100]);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    meta.content = uiState === "game" ? "#4e7fa4" : "#e8eef5";
  }, [uiState]);

  function copyRoomCode() {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── JOIN / MAIN MENU ──────────────────────────────────────────────────────────
  if (uiState === "join") {
    return (
      <div className="h-dvh flex flex-col landscape:flex-row bg-[var(--color-background)] overflow-hidden select-none">
        {/* ── Branding hero ── */}
        <div className="flex-1 relative flex flex-col items-center justify-center gap-3 landscape:gap-2 px-6 landscape:px-4 min-h-0 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)' }}>
          <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none" />

          <div className="relative drop-shadow-xl">
            <img
              src="/android-chrome-192x192.png"
              alt="PokerUrMemory"
              draggable={false}
              className="w-24 h-24 landscape:w-16 landscape:h-16 rounded-[22px] landscape:rounded-[16px] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
            />
          </div>

          <div className="relative text-center">
            <h1 className="font-display text-[2.1rem] landscape:text-[1.55rem] font-bold blue-text leading-tight tracking-wide">
              PokerUrMemory
            </h1>
            <p className="text-[11px] landscape:text-[9px] text-gray-500 mt-1 landscape:mt-0.5 tracking-[0.18em] uppercase">
              5-Card Draw · Memory Twist
            </p>
          </div>

          <div className="relative opacity-80 scale-90 landscape:scale-75 mt-1 landscape:-mt-1">
            <CardFan />
          </div>
        </div>

        {/* ── Form panel ── */}
        <div
          className="shrink-0 landscape:w-[46%] flex flex-col gap-3.5 landscape:gap-2.5 px-5 landscape:px-4 pt-5 landscape:pt-0 landscape:justify-center bg-white/60 border-t landscape:border-t-0 landscape:border-l border-black/[0.07]"
          style={{ paddingBottom: `calc(1.5rem + env(safe-area-inset-bottom, 0px))`, paddingRight: `env(safe-area-inset-right, 0px)` }}
        >
          {/* Name input */}
          <div className="relative">
            <span className="absolute left-4 landscape:left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-blue)] text-[10px] landscape:text-[9px] font-display uppercase tracking-widest pointer-events-none opacity-70">
              Name
            </span>
            <input
              type="text"
              placeholder="Your name"
              value={playerNameInput}
              onChange={e => setPlayerNameInput(e.target.value)}
              className="w-full bg-white border border-black/[0.12] rounded-2xl landscape:rounded-xl pl-16 landscape:pl-14 pr-11 py-4 landscape:py-3 text-foreground placeholder:text-foreground/30 focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm"
            />
            <button
              onClick={() => setPlayerNameInput(randomUsername())}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-[color:var(--color-blue)]/60 hover:text-[color:var(--color-blue)] hover:bg-[color:var(--color-blue)]/8 transition-colors"
              title="Random name"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary CTA */}
          <button
            onClick={() => createRoom(playerNameInput || "Player")}
            className="w-full h-14 landscape:h-11 rounded-2xl landscape:rounded-xl font-display tracking-wider uppercase text-[11px] landscape:text-[10px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_16px_rgba(0,0,0,0.18)] active:scale-[0.97] transition-transform"
          >
            Create New Game
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 -my-0.5 landscape:my-0">
            <div className="flex-1 h-px bg-black/15" />
            <span className="text-[9px] landscape:text-[8px] tracking-[0.3em] font-display uppercase text-gray-400">or join</span>
            <div className="flex-1 h-px bg-black/15" />
          </div>

          {/* Room-code input */}
          <input
            type="text"
            placeholder="ROOM CODE"
            value={roomCodeInput}
            onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full bg-white border border-black/[0.12] rounded-2xl landscape:rounded-xl px-4 landscape:px-3 py-4 landscape:py-3 text-foreground placeholder:text-foreground/25 focus:border-[color:var(--color-blue)]/70 outline-none uppercase text-center tracking-[0.45em] landscape:tracking-[0.4em] shadow-sm"
          />

          {/* Secondary CTA */}
          <button
            onClick={() => joinRoom(roomCodeInput, playerNameInput || "Player")}
            className="w-full h-14 landscape:h-11 rounded-2xl landscape:rounded-xl font-display tracking-wider uppercase text-[11px] landscape:text-[10px] font-bold bg-white text-[color:var(--color-blue)] blue-border shadow-sm active:scale-[0.97] transition-transform"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────────
  if (uiState === "lobby") {
    const playerList = (
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 landscape:px-3 pt-3 space-y-2.5"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {lobbyPlayers.map((p, i) => (
          <div key={i} className="flex items-center gap-3 bg-white/80 px-4 landscape:px-3 py-3 landscape:py-2.5 rounded-2xl border border-black/[0.07] shadow-sm">
            <div className="w-10 h-10 landscape:w-9 landscape:h-9 rounded-full bg-gradient-to-br from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white flex items-center justify-center font-bold text-base landscape:text-sm shrink-0">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-sm text-foreground truncate flex-1">
              {p.name}{p.id === playerId ? <span className="text-gray-400 text-xs ml-1">(You)</span> : ""}
            </span>
            {p.isHost && (
              <span className="text-[8px] font-display tracking-widest uppercase blue-text bg-[color:var(--color-blue)]/10 px-2.5 py-1 rounded-full border border-[color:var(--color-blue)]/25 shrink-0">
                Host
              </span>
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 2 - lobbyPlayers.length) }).map((_, i) => (
          <div key={`ghost-${i}`} className="flex items-center gap-3 px-4 landscape:px-3 py-3 landscape:py-2.5 rounded-2xl border border-dashed border-black/[0.10]">
            <div className="w-10 h-10 landscape:w-9 landscape:h-9 rounded-full border border-dashed border-black/10 flex items-center justify-center shrink-0">
              <span className="text-gray-300 text-2xl leading-none">+</span>
            </div>
            <span className="text-gray-400 text-sm">Waiting for player…</span>
          </div>
        ))}
      </div>
    );

    const actionPanel = (
      <div className="shrink-0 space-y-2">
        {isHost ? (
          <>
            <p className="text-[10px] text-gray-500 text-center leading-relaxed">
              {lobbyPlayers.length < 2 ? "Need at least 2 players to start" : "All set — start whenever you're ready!"}
            </p>
            <button
              onClick={startGame}
              disabled={lobbyPlayers.length < 2}
              className={cn(
                "w-full h-12 landscape:h-10 rounded-2xl landscape:rounded-xl font-display tracking-wider uppercase text-[11px] landscape:text-[10px] font-bold transition-all",
                lobbyPlayers.length >= 2
                  ? "bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_14px_rgba(0,0,0,0.18)] active:scale-[0.97]"
                  : "bg-black/5 text-black/20 cursor-not-allowed",
              )}
            >
              Start Game
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-blue)]/60 animate-pulse"
                  style={{ animationDelay: `${i * 0.28}s` }} />
              ))}
            </div>
            <span className="text-xs text-gray-500 tracking-wide">Waiting for host to start…</span>
          </div>
        )}
      </div>
    );

    return (
      <div className="h-dvh flex flex-col landscape:flex-row bg-[var(--color-background)] overflow-hidden select-none">

        {/* ── Left panel (portrait: top / landscape: sidebar) ── */}
        <div
          className="shrink-0 landscape:w-[42%] flex flex-col landscape:justify-center gap-3 px-5 landscape:px-6 pb-4 landscape:pb-6 border-b landscape:border-b-0 landscape:border-r border-black/[0.07] bg-white/40"
          style={{ paddingTop: `calc(1.1rem + env(safe-area-inset-top, 0px))`, paddingLeft: `env(safe-area-inset-left, 0px)` }}
        >
          <div className="flex landscape:flex-col items-center landscape:items-start justify-between landscape:justify-start gap-3 landscape:gap-2">
            <div>
              <p className="text-[9px] text-[color:var(--color-blue)] tracking-[0.3em] uppercase mb-0.5 opacity-70">Room Code</p>
              <p className="font-display text-[2rem] landscape:text-[2.4rem] font-bold blue-text tracking-widest leading-none">
                {roomCode}
              </p>
              <p className="text-[8px] text-gray-400 mt-1 tracking-wide">not case-sensitive</p>
            </div>
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 px-4 py-3 landscape:py-3.5 text-[10px] font-display tracking-widest uppercase blue-border rounded-2xl text-[color:var(--color-blue)] bg-white shadow-sm active:bg-gray-50 transition-colors shrink-0 min-w-[80px] justify-center"
            >
              {copied
                ? <><Check className="w-4 h-4 shrink-0" /> Copied</>
                : <><Copy className="w-4 h-4 shrink-0" /> Copy</>}
            </button>
          </div>

          {/* Progress pips */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.22em]">
              Players&nbsp;{lobbyPlayers.length}&nbsp;/&nbsp;4
            </p>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={cn(
                  "w-6 h-1.5 rounded-full transition-all duration-300",
                  i < lobbyPlayers.length ? "bg-[color:var(--color-blue)]" : "bg-black/10",
                )} />
              ))}
            </div>
          </div>

          <div
            className="hidden landscape:block"
            style={{ paddingBottom: `env(safe-area-inset-bottom, 0px)` }}
          >
            {actionPanel}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col min-h-0" style={{ paddingRight: `env(safe-area-inset-right, 0px)` }}>
          {playerList}

          <div
            className="landscape:hidden shrink-0 px-4 pt-3 border-t border-black/[0.07]"
            style={{ paddingBottom: `calc(1.25rem + env(safe-area-inset-bottom, 0px))` }}
          >
            {actionPanel}
          </div>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ───────────────────────────────────────────────────────────────
  if (!gameState) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const opponents = gameState.players.filter(p => p.id !== playerId);
  const phase = gameState.phase;

  const isDrawReveal    = phase === "drawReveal";
  const isDiscardReveal = phase === "discardReveal";
  const isDrawPhase     = phase === "draw";
  const isShowdown      = phase === "showdown" || showdownData !== null;
  const isBettingPhase  = phase === "firstBetting" || phase === "secondBetting";
  const isMemoryReveal  = phase === "memoryReveal";
  const isRevealPhase   = isMemoryReveal || isDrawReveal || isDiscardReveal;
  const myTurnActive    = myTurnData !== null && !isShowdown && !isDrawReveal && !isDiscardReveal;
  const showDraw      = isDrawPhase && !myPlayer?.folded && !hasDiscarded;
  const showBetting   = myTurnActive && isBettingPhase && !showBetSlider && !!myTurnData;

  const potChipVariant = gameState.pot >= 500 ? "gold" : gameState.pot >= 200 ? "blue" : "red";
  const heroTurnTimeLeft = turnTimer?.playerId === playerId ? turnTimer.timeLeft : null;

  return (
    <main className="h-dvh w-full bg-[radial-gradient(ellipse_at_top,oklch(0.70_0.08_228)_0%,oklch(0.50_0.09_236)_100%)] text-foreground overflow-hidden relative">

      {/* ── EXIT DIALOG ── */}
      {showExitDialog && (
        <ConfirmDialog
          title="Leave Game?"
          message="You'll be disconnected from the table. Any chips in the pot will be forfeited."
          confirmLabel="Leave" cancelLabel="Stay"
          onCancel={() => setShowExitDialog(false)}
          onConfirm={() => leaveGame()}
        />
      )}

      {/* ── REVEAL DIM OVERLAY ── */}
      {isRevealPhase && (
        <div className="absolute inset-0 z-[5] bg-black/25 pointer-events-none" />
      )}

      {/* ── DISCARD REVEAL OVERLAY ── */}
      {isDiscardReveal && discardRevealData && (
        <DiscardRevealOverlay discards={discardRevealData.discards} timer={timer} />
      )}

      {/* ── SHOWDOWN BANNER ── */}
      {isShowdown && showdownData && (
        <div className="fixed inset-0 z-[150] pointer-events-none flex items-center justify-center">
          <div className="bg-white/95 border-y border-[color:var(--color-gold)]/40 backdrop-blur-md py-4 w-full text-center shadow-lg">
            <h2 className="font-display text-base sm:text-3xl font-bold gold-text mb-2">
              {showdownData.winner.playerName || showdownData.winner} Wins!
            </h2>
            {showdownData.isBluff ? (
              <p className="text-gray-500 italic text-xs">Opponent folded</p>
            ) : showdownData.hands ? (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-4">
                {showdownData.hands.map((h: any, i: number) => {
                  const isWinner = h.playerId === showdownData.winner.playerId;
                  return (
                    <div key={i} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs",
                      isWinner ? "bg-[color:var(--color-gold)]/15 border border-[color:var(--color-gold)]/40" : "bg-black/5")}>
                      <span className="font-bold text-foreground">{h.playerName}:</span>
                      <span className="text-[color:var(--color-chip-teal)] font-bold">{h.rankName}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="text-[color:var(--color-gold)] animate-pulse mt-2 font-display tracking-widest text-[8px] uppercase opacity-80">
              Next hand starting...
            </p>
          </div>
        </div>
      )}

      {/* ── FIXED TOP BAR ── */}
      <div
        className="fixed z-30 flex items-start justify-between pointer-events-none"
        style={{
          top:   'calc(0.625rem + env(safe-area-inset-top, 0px))',
          left:  'calc(0.625rem + env(safe-area-inset-left, 0px))',
          right: 'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button onClick={() => setShowExitDialog(true)}
            className="w-7 h-7 grid place-items-center rounded-full bg-white/80 gold-border shadow-sm shrink-0">
            <LogOut className="w-3 h-3 text-[color:var(--color-gold)] rotate-180" />
          </button>
          <span className="font-display text-[7px] tracking-[0.25em] text-[color:var(--color-gold)] bg-white/70 px-2 py-0.5 rounded-full border border-black/10 shadow-sm whitespace-nowrap">
            {roomCode}
          </span>
        </div>
        <PhaseBadge phase={phase} timer={timer} />
      </div>

      {/* ── FELT TABLE OVAL ── */}
      <div className="felt-surface absolute inset-x-[4%] top-[7%] bottom-[4%] rounded-[50%] -z-10 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]" />

      {/* ── OPPONENTS ── */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-start z-10",
          opponents.length <= 1 ? "justify-center px-4" :
          opponents.length === 2 ? "justify-around px-2" :
          "justify-between px-3",
        )}
        style={{ top: 'calc(7% + env(safe-area-inset-top, 0px))' }}
      >
        {opponents.map((opp, idx) => {
          const oppTurnTimeLeft = turnTimer?.playerId === opp.id ? turnTimer.timeLeft : null;
          const seatSize = opponents.length >= 3 ? "mini" : opponents.length >= 2 ? "compact" : "normal";
          const cardSize = opponents.length >= 2 ? "xs" : "sm";
          const cardSpacing = opponents.length >= 3 ? "-space-x-1.5" : "-space-x-1";
          return (
            <div key={idx} className="flex flex-col items-center gap-0.5">
              <PlayerSeat
                name={opp.name} chips={opp.chips} bet={opp.currentBet}
                avatar={opp.name.charAt(0).toUpperCase()}
                active={opp.isCurrentTurn && !isShowdown}
                folded={opp.folded}
                turnTimeLeft={oppTurnTimeLeft}
                size={seatSize}
              />
              <div className={cn("flex", cardSpacing)}>
                {opp.hand.map((c, ci) => (
                  <PlayingCard
                    key={ci} card={c as any} size={cardSize} faceUp={c.faceUp}
                    highlight={isDrawReveal && c.faceUp}
                    className={opp.folded ? "opacity-30 grayscale" : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CENTER — pot + action log ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 gold-border backdrop-blur-md shadow-md whitespace-nowrap">
          <div
            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-md"
            style={{ backgroundColor: potChipVariant === "gold" ? "var(--color-gold)" : potChipVariant === "blue" ? "var(--color-chip-blue)" : "var(--color-chip-red)" }}
          />
          <span className="font-display font-bold gold-text text-[11px] sm:text-sm">
            ${gameState.pot.toLocaleString()}
          </span>
        </div>
        <div className="text-[7px] sm:text-[10px] text-gray-700 bg-white/75 px-2 py-1 rounded-xl border border-black/[0.08] max-w-[160px] sm:max-w-[260px] text-center leading-tight shadow-sm">
          {actionLog}
        </div>
      </div>

      {/* ── HERO AREA ── */}
      {myPlayer && (
        <div
          className="absolute right-[100px] sm:right-[136px] z-20 flex items-start gap-2"
          style={{
            bottom: 'calc(10% + env(safe-area-inset-bottom, 0px))',
            left:   'calc(1rem + env(safe-area-inset-left, 0px))',
          }}
        >
          <PlayerSeat
            name={myPlayer.name} chips={myPlayer.chips} bet={myPlayer.currentBet}
            avatar={myPlayer.name.charAt(0).toUpperCase()}
            active={myTurnActive} folded={myPlayer.folded}
            turnTimeLeft={heroTurnTimeLeft}
          />
          <div className="flex gap-0.5 sm:gap-1">
            {myPlayer.hand.map((c, i) => {
              const isClickable = isDrawPhase && !hasDiscarded && !myPlayer.folded;
              const isSelected = selectedDrawCards.includes(i);
              return (
                <PlayingCard
                  key={i} card={c as any} faceUp size="sm"
                  selected={isSelected}
                  highlight={isSelected || (isDrawReveal && (c as any).isReplacement && c.faceUp)}
                  onClick={isClickable ? () => toggleDrawCard(i) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── FIXED ACTION BAR ── */}
      <div
        className="fixed z-40 flex flex-col gap-1.5 items-stretch w-[92px] sm:w-[120px]"
        style={{
          bottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
          right:  'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        {showDraw && (
          <>
            <p className="font-display text-[6px] tracking-widest uppercase blue-text text-center bg-white/90 px-1.5 py-0.5 rounded-full blue-border leading-tight shadow-sm">
              Discard {selectedDrawCards.length}/4
            </p>
            <ActionButton
              variant="primary"
              label={selectedDrawCards.length === 0 ? "Stand Pat" : `Discard ${selectedDrawCards.length}`}
              onClick={confirmDiscard} className="w-full"
            />
          </>
        )}
        {showBetting && (
          <>
            <ActionButton label="Fold" onClick={() => playAction("fold")} className="w-full" />
            {myTurnData!.canCheck ? (
              <ActionButton label="Check" variant="primary" onClick={() => playAction("check")} className="w-full" />
            ) : (
              <ActionButton
                label={
                  <div className="flex flex-col items-center leading-none">
                    <span>Call</span>
                    <span className="text-[6px] font-sans font-normal opacity-80 mt-0.5">
                      ${myTurnData!.currentBet - myTurnData!.playerBet}
                    </span>
                  </div>
                }
                variant="primary" onClick={() => playAction("call")} disabled={!myTurnData!.canCall} className="w-full"
              />
            )}
            <ActionButton
              label={myTurnData!.currentBet === 0 ? "Bet" : "Raise"}
              onClick={() => {
                const min = myTurnData!.currentBet === 0 ? myTurnData!.minBet : myTurnData!.minRaise;
                setRaiseAmount([Math.min(min, myTurnData!.maxBet)]);
                setShowBetSlider(true);
              }}
              disabled={!myTurnData!.canRaise} className="w-full"
            />
          </>
        )}
      </div>

      {/* ── BET SLIDER ── */}
      <div
        className={cn(
          "fixed z-[110] w-[172px] sm:w-[210px]",
          "bg-white/97 border border-[color:var(--color-gold)]/40 rounded-2xl p-3.5 backdrop-blur-2xl shadow-xl",
          "transform transition-all duration-300 ease-out",
          showBetSlider ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none",
        )}
        style={{
          bottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
          right:  'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <p className="font-display text-[7px] tracking-widest uppercase text-gray-500 mb-1">
          {myTurnData?.currentBet === 0 ? "Bet Amount" : "Raise To"}
        </p>
        <div className="pt-4 mb-3">
          <ChipStack amount={raiseAmount[0]} variant="red" size="sm" />
        </div>
        <div className="mb-3 px-1">
          <Slider
            value={raiseAmount} onValueChange={setRaiseAmount}
            min={myTurnData ? (myTurnData.currentBet === 0 ? myTurnData.minBet : myTurnData.minRaise) : 0}
            max={myTurnData ? myTurnData.maxBet : 100}
            step={1} className="py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-1 mb-3">
          {(["Min", "½ Pot", "Pot", "All In"] as const).map((label, idx) => {
            const pot = gameState.pot;
            const min = myTurnData ? (myTurnData.currentBet === 0 ? myTurnData.minBet : myTurnData.minRaise) : 0;
            let val = min;
            if (label === "½ Pot") val = Math.max(min, Math.floor(pot / 2));
            if (label === "Pot")   val = Math.max(min, pot);
            if (label === "All In") val = myTurnData ? myTurnData.maxBet : 100;
            val = Math.min(val, myTurnData ? myTurnData.maxBet : 100);
            return (
              <button key={idx} onClick={() => setRaiseAmount([val])}
                className="py-1 text-[7px] font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 uppercase tracking-wider transition-colors">
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-1">
          <ActionButton variant="primary" label="Confirm" className="w-full"
            onClick={() => {
              const amt = raiseAmount[0];
              if (myTurnData && amt >= myTurnData.maxBet) playAction("allIn");
              else playAction(myTurnData?.currentBet === 0 ? "bet" : "raise", amt);
              setShowBetSlider(false);
            }}
          />
          <ActionButton label="Cancel" onClick={() => setShowBetSlider(false)} className="w-full" />
        </div>
      </div>
    </main>
  );
}
