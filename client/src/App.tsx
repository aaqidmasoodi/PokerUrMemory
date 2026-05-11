import { useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { PlayingCard } from "./components/poker/PlayingCard";
import { ChipStack } from "./components/poker/ChipStack";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { cn } from "./lib/utils";
import { Clock, Eye, EyeOff, LogOut, Copy, Check } from "lucide-react";

type Phase = "waiting" | "memoryReveal" | "firstBetting" | "draw" | "drawReveal" | "secondBetting" | "showdown";

const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40 in viewBox 0 0 100 100

// ─── Phase badge (unified timer display) ──────────────────────────────────────

function PhaseBadge({
  phase, timer, showCountdown,
}: {
  phase: Phase; timer?: number | null; showCountdown?: boolean;
}) {
  const map: Record<Phase, string> = {
    waiting: "Waiting", memoryReveal: "Memory", firstBetting: "Betting",
    draw: "Draw", drawReveal: "Reveal", secondBetting: "Betting", showdown: "Showdown",
  };
  const isEye = phase === "memoryReveal" || phase === "drawReveal";

  return (
    <div className="flex flex-col items-end gap-1 pointer-events-none">
      {/* Phase pill — slightly bigger than before */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 gold-border backdrop-blur-sm">
        {isEye
          ? <Eye className="w-3 h-3 text-[color:var(--color-gold)]" />
          : <EyeOff className="w-3 h-3 text-[color:var(--color-gold)]" />
        }
        <span className="font-display text-[9px] sm:text-[11px] font-semibold tracking-widest uppercase gold-text whitespace-nowrap">
          {map[phase]}
        </span>
        {!showCountdown && typeof timer === "number" && (
          <span className="flex items-center gap-0.5 text-[9px] sm:text-[11px] font-bold text-[color:var(--color-gold)]">
            <Clock className="w-2.5 h-2.5" />{timer}s
          </span>
        )}
      </div>
      {/* Large countdown shown during reveal phases — unified timer spot */}
      {showCountdown && typeof timer === "number" && (
        <span
          className="font-display font-black leading-none text-[56px] sm:text-[72px] tabular-nums"
          style={{ color: "var(--color-gold)", textShadow: "0 0 30px rgba(212,168,67,0.9), 0 0 60px rgba(212,168,67,0.4)" }}
        >
          {timer}
        </span>
      )}
    </div>
  );
}

// ─── Player seat with SVG turn-timer ring ─────────────────────────────────────

function PlayerSeat({
  name, chips, bet, active, avatar, folded, turnTimeLeft,
}: {
  name: string; chips: number; bet?: number; active?: boolean;
  avatar: string; folded?: boolean; turnTimeLeft?: number | null;
}) {
  const showRing = active && !folded && turnTimeLeft != null;
  const ringPct = showRing ? turnTimeLeft! / 20 : 0;
  const ringColor = !showRing ? "transparent"
    : turnTimeLeft! > 12 ? "oklch(0.65 0.20 145)"
    : turnTimeLeft! > 6  ? "var(--color-gold)"
    : "var(--color-chip-red)";

  return (
    <div className="relative shrink-0">
      {/* Active turn pulsing dot */}
      {active && !folded && turnTimeLeft == null && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[color:var(--color-gold)] shadow-[0_0_8px_rgba(212,168,67,1)] animate-pulse z-10" />
      )}
      <div className={cn(
        "flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md pl-1 pr-2.5 py-1 transition-all",
        active && !folded
          ? "gold-border shadow-[0_0_14px_rgba(212,168,67,0.35)]"
          : "border border-white/10",
        folded && "opacity-40 grayscale",
      )}>
        {/* Avatar with timer ring */}
        <div className="relative w-6 h-6 sm:w-8 sm:h-8 shrink-0">
          {showRing && (
            <svg
              className="absolute pointer-events-none"
              style={{ width: "calc(100% + 8px)", height: "calc(100% + 8px)", top: "-4px", left: "-4px" }}
              viewBox="0 0 100 100"
            >
              {/* Track */}
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              {/* Progress */}
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke={ringColor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${ringPct * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dasharray 0.9s linear, stroke 0.5s ease" }}
              />
            </svg>
          )}
          <div className="w-full h-full rounded-full grid place-items-center font-display font-bold text-[9px] sm:text-sm bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] text-[color:var(--color-felt-deep)]">
            {avatar}
          </div>
        </div>
        {/* Name + chips */}
        <div className="flex flex-col leading-none">
          <span className="font-display text-[8px] sm:text-[11px] font-semibold uppercase truncate max-w-[52px] sm:max-w-[80px] text-foreground/90">
            {name}
          </span>
          <span className="text-[7px] sm:text-[10px] font-bold gold-text">${chips.toLocaleString()}</span>
        </div>
        {typeof bet === "number" && bet > 0 && (
          <span className="text-[6px] sm:text-[8px] text-[color:var(--color-gold)]/80 pl-1.5 border-l border-white/10 leading-none whitespace-nowrap">
            <span className="block opacity-60 tracking-wider text-[5px] uppercase">bet</span>
            ${bet}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Reusable action button ───────────────────────────────────────────────────

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
          ? "bg-gradient-to-b from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] text-[color:var(--color-felt-deep)] border border-black/20 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
          : "bg-black/50 text-[color:var(--color-gold)] gold-border hover:bg-black/65",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      {label}
    </Button>
  );
}

// ─── Exit / custom confirm dialog ────────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
      <div
        className="bg-[oklch(0.16_0.025_150)] border border-[color:var(--color-gold)]/30 rounded-2xl p-6 max-w-[280px] w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-bold gold-text mb-2">{title}</h3>
        <p className="text-xs text-gray-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <ActionButton label={cancelLabel} onClick={onCancel} className="flex-1" />
          <ActionButton label={confirmLabel} variant="primary" onClick={onConfirm} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

// ─── Decorative card fan for main menu ───────────────────────────────────────

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
    myTurnData, actionLog, timer, showdownData, selectedDrawCards, hasDiscarded,
    turnTimer,
    createRoom, joinRoom, startGame, playAction, toggleDrawCard, confirmDiscard,
  } = useSocket();

  const [playerNameInput, setPlayerNameInput] = useState("Player");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [raiseAmount, setRaiseAmount] = useState<number[]>([100]);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyRoomCode() {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── JOIN / MAIN MENU ─────────────────────────────────────────────────────────
  if (uiState === "join") {
    return (
      <div className="h-dvh bg-[var(--color-background)] flex flex-col landscape:flex-row overflow-hidden">
        {/* Branding panel */}
        <div className="flex-1 relative flex flex-col items-center justify-center gap-4 p-6 min-h-0">
          <div className="absolute inset-0 felt-surface opacity-[0.07] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 pointer-events-none" />
          <CardFan />
          <div className="relative text-center">
            <h1 className="font-display text-3xl landscape:text-2xl font-bold gold-text leading-tight">PokerUrMemory</h1>
            <p className="text-[11px] text-gray-500 mt-1 tracking-wide">5-Card Draw · Memory Twist</p>
          </div>
        </div>
        {/* Form panel */}
        <div className="shrink-0 flex flex-col justify-center gap-3 p-5 landscape:p-6 landscape:w-72 landscape:border-l landscape:border-white/[0.07] bg-black/30 overflow-y-auto">
          <p className="font-display text-[9px] tracking-[0.25em] text-[color:var(--color-gold)]/60 uppercase -mb-1">Your Name</p>
          <input
            type="text" placeholder="Player" value={playerNameInput}
            onChange={e => setPlayerNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createRoom(playerNameInput || "Player")}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[color:var(--color-gold)] outline-none text-sm"
          />
          <ActionButton variant="primary" label="Create New Game" className="w-full"
            onClick={() => createRoom(playerNameInput || "Player")} />
          <div className="flex items-center gap-3 my-1 opacity-30">
            <div className="flex-1 h-px bg-white" />
            <span className="text-[9px] tracking-widest font-display uppercase text-gray-300">or</span>
            <div className="flex-1 h-px bg-white" />
          </div>
          <input
            type="text" placeholder="ROOM CODE" value={roomCodeInput}
            onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && joinRoom(roomCodeInput, playerNameInput || "Player")}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[color:var(--color-gold)] outline-none uppercase text-center tracking-[0.3em] text-sm"
            maxLength={6}
          />
          <ActionButton label="Join Game" className="w-full"
            onClick={() => joinRoom(roomCodeInput, playerNameInput || "Player")} />
        </div>
      </div>
    );
  }

  // ── LOBBY ────────────────────────────────────────────────────────────────────
  if (uiState === "lobby") {
    return (
      <div className="h-dvh bg-[var(--color-background)] flex flex-col landscape:flex-row overflow-hidden">
        {/* Room info + players */}
        <div className="flex-1 flex flex-col p-5 landscape:p-6 min-h-0 overflow-y-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 min-w-0">
              <p className="text-[8px] text-[color:var(--color-gold)]/50 tracking-[0.25em] uppercase mb-0.5">Room Code</p>
              <p className="font-display text-3xl landscape:text-2xl font-bold gold-text tracking-widest leading-none">{roomCode}</p>
            </div>
            <button onClick={copyRoomCode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-display tracking-widest uppercase gold-border rounded-full text-[color:var(--color-gold)] bg-black/40 hover:bg-black/60 transition-colors shrink-0">
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <p className="text-[8px] text-gray-600 uppercase tracking-[0.2em] mb-2">Players {lobbyPlayers.length} / 4</p>
          <div className="flex gap-1 mb-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={cn("flex-1 h-1 rounded-full transition-all duration-300",
                i < lobbyPlayers.length ? "bg-[color:var(--color-gold)]" : "bg-white/10")} />
            ))}
          </div>
          <div className="space-y-1.5">
            {lobbyPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-white/[0.04] px-3 py-2 rounded-xl border border-white/[0.06]">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] text-[color:var(--color-felt-deep)] flex items-center justify-center font-bold text-sm shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-sm text-white truncate flex-1">
                  {p.name}{p.id === playerId ? " (You)" : ""}
                </span>
                {p.isHost && (
                  <span className="text-[7px] font-display tracking-widest uppercase gold-text bg-[color:var(--color-gold)]/10 px-2 py-0.5 rounded-full border border-[color:var(--color-gold)]/20 shrink-0">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Start action */}
        <div className="shrink-0 flex flex-col justify-center gap-4 p-5 landscape:p-6 landscape:w-60 landscape:border-l landscape:border-white/[0.07] bg-black/20">
          <div>
            <h1 className="font-display text-xl font-bold gold-text mb-1">Game Lobby</h1>
            <p className="text-xs text-gray-500 leading-relaxed">
              {isHost
                ? lobbyPlayers.length < 2 ? "Waiting for at least one more player..." : "Ready to start!"
                : "Waiting for the host to start..."}
            </p>
          </div>
          {isHost ? (
            <ActionButton variant="primary" label="Start Game" className="w-full"
              disabled={lobbyPlayers.length < 2} onClick={startGame} />
          ) : (
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-gold)]/50 animate-pulse"
                  style={{ animationDelay: `${i * 0.25}s` }} />
              ))}
              <span className="text-xs text-gray-500">Waiting...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ──────────────────────────────────────────────────────────────
  if (!gameState) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const opponents = gameState.players.filter(p => p.id !== playerId);
  const phase = gameState.phase;

  const isDrawReveal  = phase === "drawReveal";
  const isDrawPhase   = phase === "draw";
  const isShowdown    = phase === "showdown" || showdownData !== null;
  const isBettingPhase = phase === "firstBetting" || phase === "secondBetting";
  const isMemoryReveal = phase === "memoryReveal";
  const isRevealPhase  = isMemoryReveal || isDrawReveal;
  const myTurnActive  = myTurnData !== null && !isShowdown && !isDrawReveal;
  const showDraw      = isDrawPhase && !myPlayer?.folded && !hasDiscarded;
  const showBetting   = myTurnActive && isBettingPhase && !showBetSlider && !!myTurnData;

  const potChipVariant = gameState.pot >= 500 ? "gold" : gameState.pot >= 200 ? "blue" : "red";

  // Per-seat turn time
  const heroTurnTimeLeft = turnTimer?.playerId === playerId ? turnTimer.timeLeft : null;

  return (
    <main className="h-dvh w-full bg-[radial-gradient(ellipse_at_top,oklch(0.22_0.04_150)_0%,oklch(0.10_0.02_150)_100%)] text-foreground overflow-hidden relative">

      {/* ── EXIT DIALOG ─────────────────────────────────────────────────────── */}
      {showExitDialog && (
        <ConfirmDialog
          title="Leave Game?"
          message="You'll be disconnected from the table. Any chips in the pot will be forfeited."
          confirmLabel="Leave" cancelLabel="Stay"
          onCancel={() => setShowExitDialog(false)}
          onConfirm={() => window.location.reload()}
        />
      )}

      {/* ── REVEAL OVERLAY — absolute z-5, BEHIND cards (z-10/z-20) ─────────── */}
      {isRevealPhase && (
        <div className="absolute inset-0 z-[5] bg-black/55 pointer-events-none" />
      )}

      {/* ── SHOWDOWN BANNER ──────────────────────────────────────────────────── */}
      {isShowdown && showdownData && (
        <div className="fixed inset-0 z-[150] pointer-events-none flex items-center justify-center">
          <div className="bg-black/90 border-y border-[color:var(--color-gold)]/40 backdrop-blur-md py-4 w-full text-center">
            <h2 className="font-display text-base sm:text-3xl font-bold gold-text mb-2">
              {showdownData.winner.playerName || showdownData.winner} Wins!
            </h2>
            {showdownData.isBluff ? (
              <p className="text-gray-300 italic text-xs">Opponent folded</p>
            ) : showdownData.hands ? (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-4">
                {showdownData.hands.map((h: any, i: number) => {
                  const isWinner = h.playerId === showdownData.winner.playerId;
                  return (
                    <div key={i} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs",
                      isWinner ? "bg-[color:var(--color-gold)]/20 border border-[color:var(--color-gold)]/50" : "bg-white/5")}>
                      <span className="font-bold text-white">{h.playerName}:</span>
                      <span className="text-[color:var(--color-chip-teal)] font-bold">{h.rankName}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="text-[color:var(--color-gold)]/70 animate-pulse mt-2 font-display tracking-widest text-[8px] uppercase">
              Next hand starting...
            </p>
          </div>
        </div>
      )}

      {/* ── FIXED TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="fixed top-2.5 left-2.5 right-2.5 z-30 flex items-start justify-between pointer-events-none">
        {/* Left: exit + room code */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button onClick={() => setShowExitDialog(true)}
            className="w-7 h-7 grid place-items-center rounded-full bg-black/50 gold-border shrink-0">
            <LogOut className="w-3 h-3 text-[color:var(--color-gold)] rotate-180" />
          </button>
          <span className="font-display text-[7px] tracking-[0.25em] text-[color:var(--color-gold)]/70 bg-black/40 px-2 py-0.5 rounded-full border border-white/10 whitespace-nowrap">
            {roomCode}
          </span>
        </div>
        {/* Right: phase badge (unified timer — big countdown during reveals) */}
        <PhaseBadge
          phase={phase}
          timer={timer}
          showCountdown={isRevealPhase}
        />
      </div>

      {/* ── FELT TABLE OVAL ───────────────────────────────────────────────────── */}
      <div className="felt-surface absolute inset-x-[4%] top-[11%] bottom-[4%] rounded-[50%] -z-10 shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" />

      {/* ── OPPONENTS — slightly higher, z-10 → above reveal overlay ─────────── */}
      <div className="absolute top-[11%] left-0 right-0 flex justify-center items-start gap-3 sm:gap-6 px-2 z-10">
        {opponents.map((opp, idx) => {
          const oppTurnTimeLeft = turnTimer?.playerId === opp.id ? turnTimer.timeLeft : null;
          return (
            <div key={idx} className={cn("flex flex-col items-center gap-1.5", opp.folded && "opacity-30 grayscale")}>
              <PlayerSeat
                name={opp.name} chips={opp.chips} bet={opp.currentBet}
                avatar={opp.name.charAt(0).toUpperCase()}
                active={opp.isCurrentTurn && !isShowdown}
                folded={opp.folded}
                turnTimeLeft={oppTurnTimeLeft}
              />
              <div className="flex -space-x-1.5">
                {opp.hand.map((c, ci) => (
                  <PlayingCard key={ci} card={c as any} size="xs" faceUp={c.faceUp}
                    highlight={isDrawReveal && c.faceUp} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CENTER — pot (ChipStack sm) & action log ──────────────────────────── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
        <div className="px-3 pt-5 pb-2 rounded-xl bg-black/50 gold-border backdrop-blur-md shadow-xl">
          <ChipStack amount={Math.max(1, gameState.pot)} variant={potChipVariant} size="sm" />
        </div>
        <div className="text-[7px] sm:text-[10px] text-gray-300 bg-black/30 px-2 py-0.5 rounded-full border border-white/10 max-w-[160px] sm:max-w-[260px] truncate text-center">
          {actionLog}
        </div>
      </div>

      {/* ── HERO AREA — z-20, above reveal overlay ────────────────────────────── */}
      {myPlayer && (
        <div className="absolute bottom-[10%] left-4 right-[100px] sm:right-[136px] z-20 flex items-center gap-2">
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

      {/* ── FIXED ACTION BAR — bottom-right ───────────────────────────────────── */}
      <div className="fixed bottom-2.5 right-2.5 z-40 flex flex-col gap-1.5 items-stretch w-[92px] sm:w-[120px]">
        {showDraw && (
          <>
            <p className="font-display text-[6px] tracking-widest uppercase gold-text text-center bg-black/60 px-1.5 py-0.5 rounded-full gold-border leading-tight">
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

      {/* ── BET SLIDER — slides in from right ────────────────────────────────── */}
      <div className={cn(
        "fixed z-[110] bottom-2.5 right-2.5 w-[172px] sm:w-[210px]",
        "bg-black/95 border border-[color:var(--color-gold)]/50 rounded-2xl p-3.5 backdrop-blur-2xl shadow-2xl",
        "transform transition-all duration-300 ease-out",
        showBetSlider ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none",
      )}>
        <p className="font-display text-[7px] tracking-widest uppercase text-gray-500 mb-1">
          {myTurnData?.currentBet === 0 ? "Bet Amount" : "Raise To"}
        </p>
        {/* Chip stack amount display */}
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
                className="py-1 text-[7px] font-semibold rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white uppercase tracking-wider transition-colors">
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
