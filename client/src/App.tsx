import { useState, useEffect, useRef } from "react";
import { useSocket, type DiscardEntry } from "./hooks/useSocket";
import { useAuth } from "./hooks/useAuth";
import { usePresence } from "./hooks/usePresence";
import { LandingScreen } from "./screens/LandingScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { MainMenuScreen } from "./screens/MainMenuScreen";
import { MatchmakingScreen } from "./screens/MatchmakingScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { RulesScreen, RulesBody } from "./screens/RulesScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { IncomingInviteModal } from "./components/IncomingInviteModal";
import { PlayingCard } from "./components/poker/PlayingCard";
import { ChipStack } from "./components/poker/ChipStack";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { cn } from "./lib/utils";
import { Clock, Eye, LogOut, Volume2, VolumeX, ScrollText, X, WifiOff, BookOpen } from "lucide-react";


type Phase = "waiting" | "memoryReveal" | "firstBetting" | "draw" | "discardReveal" | "drawReveal" | "secondBetting" | "showdown";
type AppScreen = 'menu' | 'matchmaking' | 'profile' | 'settings' | 'rules' | 'lobby';

let _globalMuted = false;
function playSound(file: string, volume = 0.55) {
  if (_globalMuted) return;
  try { const a = new Audio(`/sounds/${file}`); a.volume = volume; a.play().catch(() => {}); } catch {}
}

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
  normal:  { pill: "gap-1.5 pl-1 pr-2.5 py-1",       avatar: "w-6 h-6 sm:w-8 sm:h-8 text-[9px] sm:text-sm", name: "text-[8px] sm:text-[11px] max-w-[52px] sm:max-w-[80px]", chips: "text-[7px] sm:text-[10px]", showBet: true,  ringPad: 5, numCls: "text-[15px]", flashCls: "text-[14px] sm:text-[18px]" },
  compact: { pill: "gap-1 pl-0.5 pr-2 py-0.5",         avatar: "w-5 h-5 text-[7px]",                           name: "text-[7px] max-w-[36px]",                               chips: "text-[6px]",               showBet: true,  ringPad: 3, numCls: "text-[11px]", flashCls: "text-[10px] sm:text-[12px]" },
  mini:    { pill: "gap-0.5 pl-0.5 pr-1.5 py-[1px]",   avatar: "w-4 h-4 text-[6px]",                           name: "text-[6px] max-w-[26px]",                               chips: "text-[5px]",               showBet: true,  ringPad: 2, numCls: "text-[10px]", flashCls: "text-[8px] sm:text-[10px]" },
} as const;

function PlayerSeat({
  name, chips, bet, active, avatar, folded, turnTimeLeft, size = "normal",
  flashLabel, disconnected,
}: {
  name: string; chips: number; bet?: number; active?: boolean;
  avatar: string; folded?: boolean; turnTimeLeft?: number | null;
  size?: "normal" | "compact" | "mini";
  flashLabel?: string; disconnected?: boolean;
}) {
  const cfg = SEAT_CFG[size];
  const showRing = active && !folded && turnTimeLeft != null;
  const pct  = showRing ? (turnTimeLeft! / 30) * 100 : 100;
  const timerColor = showRing
    ? turnTimeLeft! > 18 ? "#22c55e"
    : turnTimeLeft! > 10 ? "#f59e0b"
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
        boxShadow: turnTimeLeft! <= 10 ? `0 0 18px 3px ${timerColor}99` : undefined,
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
                  <span className="font-bold text-white text-[10px] sm:text-[12px]">${bet}</span>
                  <span className="text-[4px] uppercase text-white/70 tracking-wider">bet</span>
                </div>
              )}
            </div>
          ) : (
            /* Normal: show avatar, name, chips */
            <>
              <div
                className={cn(
                  "shrink-0 rounded-full grid place-items-center font-display font-bold text-white",
                  cfg.avatar,
                  !showRing && "bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)]",
                )}
                style={showRing ? { backgroundColor: timerColor } : undefined}
              >
                {showRing ? <span className="font-black tabular-nums">{turnTimeLeft}</span> : disconnected ? <WifiOff className="w-3 h-3" /> : avatar}
              </div>
              <div className="flex flex-col leading-none">
                <span className={cn("font-display font-semibold uppercase truncate text-gray-900", cfg.name)}>
                  {name}
                </span>
                <span className={cn("font-bold text-gray-700", cfg.chips)}>
                  ${chips.toLocaleString()}
                </span>
              </div>
            </>
          )}
          {/* Bet - always show and bigger */}
          {!showAction && cfg.showBet && typeof bet === "number" && bet > 0 && (
            <div className="flex flex-col items-center pl-2 border-l border-gray-300 ml-1">
              <span className="font-bold text-gray-800 text-[10px] sm:text-[12px]">${bet}</span>
              <span className="text-[5px] uppercase text-gray-500 tracking-wider">bet</span>
            </div>
          )}
        </div>
      </div>

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
        "h-12 rounded-xl font-display tracking-wider uppercase text-[12px] font-bold transition-all px-3",
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
  const maxAngle = Math.min((total - 1) * 10, 36);
  const step = maxAngle / (total - 1);
  const angle = -maxAngle / 2 + step * index;
  const lift = Math.abs(angle) * 0.5;
  return `rotate(${angle}deg) translateY(${lift}px)`;
}

function DiscardGroup({ entry, myPlayerId }: { entry: DiscardEntry; myPlayerId: string }) {
  const cardWidth = 36;
  const fanOverlap = 28;
  const containerW = entry.cards.length <= 1
    ? cardWidth
    : cardWidth + fanOverlap * (entry.cards.length - 1);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={cn(
        "text-[9px] uppercase tracking-widest font-display px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm",
        entry.playerId === myPlayerId
          ? "bg-[color:var(--color-blue)] text-white border border-[color:var(--color-blue-soft)]"
          : "gold-text bg-white/90 gold-border",
      )}>
        {entry.playerId === myPlayerId ? "You" : entry.playerName}
      </span>

      {entry.cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[82px]">
          <span className="text-[9px] text-gray-500 italic tracking-wide">Stand Pat</span>
        </div>
      ) : (
        <div className="relative" style={{ width: containerW, height: 82 }}>
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
  discards, timer, myPlayerId,
}: {
  discards: DiscardEntry[];
  timer: number | null;
  myPlayerId: string;
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
          <DiscardGroup key={entry.playerId} entry={entry} myPlayerId={myPlayerId} />
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


// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { authState, user, profile, signInWithGoogle, signOut, createProfile, updateProfile } = useAuth();
  const {
    socket,
    inGame, playerId, gameState,
    myTurnData, actionLog, timer, showdownData, discardRevealData, selectedDrawCards, hasDiscarded,
    turnTimer, gameLogs, disconnectNotice, roomClosedMsg, dismissRoomClosed,
    matchTimedOut, findGame, cancelSearch,
    playAction, toggleDrawCard, confirmDiscard, leaveGame,
    lobby, lobbyTransitioning, incomingInvite, inviteDeclinedNotice,
    registerUser, createLobby, leaveLobby, inviteToLobby, acceptInvite, declineInvite, startLobby,
  } = useSocket();
  const onlineUserIds = usePresence(profile?.id ?? null, profile?.username ?? null);

  const [appScreen, setAppScreen] = useState<AppScreen>('menu');
  const [showRules, setShowRules] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState<number[]>([100]);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => { _globalMuted = muted; }, [muted]);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    meta.content = "#e8eef5";
  }, [inGame]);

  // Track game start for smooth transition
  const [gameJustStarted, setGameJustStarted] = useState(false);
  const prevInGame = useRef(false);
  useEffect(() => {
    if (prevInGame.current === false && inGame === true) {
      setGameJustStarted(true);
      const t = setTimeout(() => setGameJustStarted(false), 800);
      return () => clearTimeout(t);
    }
    if (prevInGame.current && !inGame) {
      setAppScreen('menu');
      setShowExitDialog(false);
    }
    prevInGame.current = inGame;
  }, [inGame]);

  // Clear exit dialog when joining a new game
  useEffect(() => {
    if (inGame) {
      setShowExitDialog(false);
    }
  }, [inGame]);

  // Start/stop matchmaking when the screen is shown
  useEffect(() => {
    if (appScreen === 'matchmaking' && !inGame && profile) {
      findGame(profile.id, profile.username);
      return () => cancelSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appScreen, inGame]);

  // Register the user with the server once the socket is connected and the profile is loaded
  useEffect(() => {
    if (!socket || !profile) return;
    registerUser(profile.id, profile.username, profile.avatar_url);
  }, [socket, profile, registerUser]);

  const [flashAction, setFlashAction] = useState<{ playerId: string; label: string; color: string } | null>(null);
  const gsRef = useRef(gameState);
  gsRef.current = gameState;

  useEffect(() => {
    const gs = gsRef.current;
    if (!gs || !actionLog) return;
    for (const p of gs.players) {
      if (!actionLog.startsWith(p.name + ' ')) continue;
      const rest = actionLog.slice(p.name.length + 1).toLowerCase();
      let label = '', color = '';
      if      (rest.startsWith('folds') || rest.startsWith('timed out')) { label = 'FOLD';    color = '#ef4444'; }
      else if (rest.startsWith('checks'))    { label = 'CHECK';   color = '#22c55e'; }
      else if (rest.startsWith('calls'))     { label = 'CALL';    color = '#3b82f6'; }
      else if (rest.startsWith('bets'))      { label = 'BET';     color = '#f59e0b'; }
      else if (rest.startsWith('raises'))    { label = 'RAISE';   color = '#f59e0b'; }
      else if (rest.startsWith('goes all'))  { label = 'ALL IN!'; color = '#dc2626'; }
      if (label) {
        setFlashAction({ playerId: p.id, label, color });
        playSound(label === 'FOLD' ? 'player_fold.wav' : 'player_bet.wav');
        const t = setTimeout(() => setFlashAction(null), 2500);
        return () => clearTimeout(t);
      }
      break;
    }
  }, [actionLog]);

  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = gameState?.phase;
    if (!phase || phase === prevPhaseRef.current) return;
    if (phase === 'memoryReveal') {
      setFlashAction(null);
      playSound('card_flip.wav');
    } else if (phase === 'drawReveal' || phase === 'discardReveal') {
      playSound('card_flip.wav');
    }
    prevPhaseRef.current = phase;
  }, [gameState?.phase]);

  // ── AUTH SCREENS ──────────────────────────────────────────────────────────────
  if (authState === 'loading') return (
    <div className="h-dvh flex flex-col items-center justify-center gap-6 bg-[var(--color-background)]">
      <div className="w-8 h-8 border-2 border-[color:var(--color-blue)]/30 border-t-[color:var(--color-blue)] rounded-full animate-spin" />
      <button
        onClick={signOut}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
  if (authState === 'landing') return <LandingScreen onLogin={signInWithGoogle} />;
  if (authState === 'onboarding' && user) return <OnboardingScreen user={user} onComplete={createProfile} />;

  // ── NON-GAME SCREENS ──────────────────────────────────────────────────────────
  if (!inGame) {
    let screen: React.ReactNode;

    if (roomClosedMsg) {
      screen = (
        <div className="h-dvh flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
          <div className="bg-white border border-[color:var(--color-gold)]/30 rounded-2xl p-6 max-w-[280px] w-full shadow-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-[color:var(--color-gold)]/10 border border-[color:var(--color-gold)]/30 grid place-items-center mx-auto mb-4">
              <LogOut className="w-4 h-4 text-[color:var(--color-gold)]" />
            </div>
            <h3 className="font-display text-base font-bold gold-text mb-2">Game Over</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">{roomClosedMsg}</p>
            <ActionButton
              label="Back to Menu"
              variant="primary"
              className="w-full"
              onClick={() => { dismissRoomClosed(); setAppScreen('menu'); }}
            />
          </div>
        </div>
      );
    } else if (appScreen === 'matchmaking') {
      screen = (
        <MatchmakingScreen
          timedOut={matchTimedOut}
          onCancel={() => setAppScreen('menu')}
        />
      );
    } else if (appScreen === 'lobby') {
      screen = (
        <LobbyScreen
          profile={profile!}
          lobby={lobby}
          lobbyTransitioning={lobbyTransitioning}
          onlineUserIds={onlineUserIds}
          onCreateLobby={async () => {
            const res = await createLobby();
            return { success: res.success, error: res.error };
          }}
          onLeaveLobby={leaveLobby}
          onInvite={async (toUserId) => inviteToLobby(toUserId)}
          onStart={async () => startLobby()}
          onBack={() => setAppScreen('menu')}
        />
      );
    } else if (appScreen === 'profile') {
      screen = (
        <ProfileScreen profile={profile!} onSave={updateProfile} onBack={() => setAppScreen('menu')} />
      );
    } else if (appScreen === 'settings') {
      screen = (
        <SettingsScreen
          profile={profile!}
          muted={muted}
          onToggleMute={() => setMuted(m => !m)}
          onBack={() => setAppScreen('menu')}
          onSignOut={signOut}
        />
      );
    } else if (appScreen === 'rules') {
      screen = <RulesScreen onBack={() => setAppScreen('menu')} />;
    } else {
      screen = (
        <MainMenuScreen
          profile={profile!}
          onStartGame={() => setAppScreen('matchmaking')}
          onPlayWithFriends={() => setAppScreen('lobby')}
          onProfile={() => setAppScreen('profile')}
          onSettings={() => setAppScreen('settings')}
          onRules={() => setAppScreen('rules')}
        />
      );
    }

    return (
      <>
        {gameJustStarted && !gameState && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[var(--color-background)]">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[color:var(--color-blue)] border-t-transparent rounded-full animate-spin" />
              <p className="font-display text-sm tracking-wider uppercase text-gray-500">Starting game…</p>
            </div>
          </div>
        )}
        {screen}
        {incomingInvite && (
          <IncomingInviteModal
            invite={incomingInvite}
            onAccept={async () => {
              const res = await acceptInvite(incomingInvite.lobbyId);
              if (res.success) setAppScreen('lobby');
            }}
            onDecline={() => declineInvite(incomingInvite.lobbyId, incomingInvite.fromUserId)}
          />
        )}
        {inviteDeclinedNotice && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[350] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-red-50 border border-red-300 text-red-700 font-display text-[10px] tracking-widest uppercase"
            style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
          >
            {inviteDeclinedNotice.byUsername} declined
          </div>
        )}
      </>
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

  const currentTurnPlayer = gameState.players.find(p => p.isCurrentTurn && !p.folded);
  const infoMsg = (() => {
    if (isMemoryReveal)  return { text: "Memorise the Cards!",  urgent: false };
    if (isDrawReveal)    return { text: "Memorise Drawn Cards",  urgent: false };
    if (isDiscardReveal) return { text: "Showing Discards…",    urgent: false };
    if (isShowdown)      return { text: "Showdown!",             urgent: false };
    if (myTurnActive)    return { text: "Your Turn!", urgent: true };
    if (showDraw)        return { text: "Pick Cards to Discard", urgent: true };
    if (currentTurnPlayer) {
      if (currentTurnPlayer.id === playerId) return { text: "Your Turn!", urgent: true };
      return { text: `${currentTurnPlayer.name}'s Turn`, urgent: false };
    }
    return { text: actionLog, urgent: false };
  })();

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
        <DiscardRevealOverlay discards={discardRevealData.discards} timer={timer} myPlayerId={playerId} />
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

      {/* ── DISCONNECT NOTICE ── */}
      {disconnectNotice && (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg",
            "font-display text-[10px] tracking-widest uppercase whitespace-nowrap",
            "transition-all duration-300",
            disconnectNotice.reconnecting
              ? "bg-amber-50 border border-amber-300 text-amber-800"
              : "bg-red-50 border border-red-300 text-red-700",
          )}
          style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
        >
          <span className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            disconnectNotice.reconnecting ? "bg-amber-400 animate-pulse" : "bg-red-400",
          )} />
          {disconnectNotice.reconnecting
            ? `${disconnectNotice.playerName} disconnected...`
            : `${disconnectNotice.playerName} left the game`}
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
        {/* Left: exit + mute */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setShowExitDialog(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/90 gold-border shadow-sm shrink-0"
          >
            <LogOut className="w-3 h-3 text-[color:var(--color-gold)] rotate-180" />
            <span className="font-display text-[9px] tracking-wider uppercase gold-text font-semibold">Exit Game</span>
          </button>
          <button
            onClick={() => setMuted(m => !m)}
            className="w-8 h-8 grid place-items-center rounded-full bg-white/80 gold-border shadow-sm shrink-0"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted
              ? <VolumeX className="w-3.5 h-3.5 text-gray-400" />
              : <Volume2 className="w-3.5 h-3.5 text-[color:var(--color-gold)]" />
            }
          </button>
        </div>

        {/* Right: phase badge + rules + log */}
        <div className="flex items-start gap-1.5 pointer-events-auto">
          <PhaseBadge phase={phase} timer={timer} />
          <button
            onClick={() => setShowRules(r => !r)}
            className="w-8 h-8 grid place-items-center rounded-full bg-white/90 gold-border shadow-sm shrink-0"
            title="Rules"
          >
            <BookOpen className="w-3.5 h-3.5 text-[color:var(--color-gold)]" />
          </button>
          <button
            onClick={() => setShowLog(l => !l)}
            className="w-8 h-8 grid place-items-center rounded-full bg-white/90 gold-border shadow-sm shrink-0"
            title="Game Log"
          >
            <ScrollText className="w-3.5 h-3.5 text-[color:var(--color-gold)]" />
          </button>
        </div>
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
          const cardSize = "sm";
          const cardSpacing = opponents.length >= 3 ? "-space-x-3" : opponents.length >= 2 ? "-space-x-2" : "-space-x-1";
          return (
            <div key={idx} className="flex flex-col items-center gap-0.5">
              <PlayerSeat
                name={opp.name} chips={opp.chips} bet={opp.currentBet}
                avatar={opp.name.charAt(0).toUpperCase()}
                active={opp.isCurrentTurn && !isShowdown && !opp.disconnected}
                folded={opp.folded}
                disconnected={opp.disconnected}
                turnTimeLeft={oppTurnTimeLeft}
                size={seatSize}
                flashLabel={flashAction?.playerId === opp.id ? flashAction.label : undefined}
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
        <div className={cn(
          "px-4 py-2 rounded-2xl text-center shadow-md max-w-[200px] sm:max-w-[280px] transition-colors duration-300",
          infoMsg.urgent
            ? "bg-[color:var(--color-blue)] border border-[color:var(--color-blue-soft)]"
            : "bg-white/90 border border-black/[0.08]",
        )}>
          <p className={cn(
            "font-display font-bold leading-tight text-[13px] sm:text-[15px]",
            infoMsg.urgent ? "text-white" : "text-foreground/90",
          )}>
            {infoMsg.urgent && (
              <span className="inline-block w-2 h-2 rounded-full bg-white mr-1.5 align-middle animate-ping opacity-75" />
            )}
            {infoMsg.text}
          </p>
        </div>
      </div>

      {/* ── HERO AREA ── */}
      {myPlayer && (
        <div
          className="absolute right-[120px] sm:right-[152px] z-20 flex items-start gap-2"
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
            flashLabel={flashAction?.playerId === myPlayer.id ? flashAction.label : undefined}
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
        className="fixed z-40 flex flex-col gap-1.5 items-stretch w-[112px] sm:w-[140px]"
        style={{
          bottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
          right:  'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        {showDraw && (
          <>
            <p className="font-display text-[9px] tracking-widest uppercase blue-text text-center bg-white/90 px-2 py-1 rounded-full blue-border leading-tight shadow-sm">
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

      {/* ── GAME LOG PANEL ── */}
      {showLog && (
        <div
          className="fixed inset-0 z-[200]"
          onClick={() => setShowLog(false)}
        />
      )}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-[210] w-[280px] sm:w-[320px] flex flex-col",
          "bg-white/97 border-l border-[color:var(--color-gold)]/30 shadow-2xl backdrop-blur-xl",
          "transform transition-transform duration-300 ease-out",
          showLog ? "translate-x-0" : "translate-x-full",
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07]">
          <span className="font-display text-xs tracking-widest uppercase gold-text font-semibold">Game Log</span>
          <button onClick={() => setShowLog(false)} className="w-7 h-7 grid place-items-center rounded-full hover:bg-gray-100">
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-1.5">
          {gameLogs.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center mt-6 italic">No rounds played yet…</p>
          ) : gameLogs.map((log, i) => (
            <div key={i} className={cn(
              "text-[10px] leading-snug px-2.5 py-2 rounded-lg",
              i === 0 ? "bg-[color:var(--color-gold)]/10 border border-[color:var(--color-gold)]/25 font-semibold" : "bg-gray-50 border border-black/[0.05]",
            )}>
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* ── RULES PANEL ── */}
      {showRules && (
        <div
          className="fixed inset-0 z-[200]"
          onClick={() => setShowRules(false)}
        />
      )}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-[210] w-[300px] sm:w-[360px] flex flex-col",
          "bg-white/97 border-l border-[color:var(--color-gold)]/30 shadow-2xl backdrop-blur-xl",
          "transform transition-transform duration-300 ease-out",
          showRules ? "translate-x-0" : "translate-x-full",
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07]">
          <span className="font-display text-xs tracking-widest uppercase gold-text font-semibold">How to Play</span>
          <button onClick={() => setShowRules(false)} className="w-7 h-7 grid place-items-center rounded-full hover:bg-gray-100">
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <RulesBody />
        </div>
      </div>

      {/* ── BET SLIDER ── */}
      <div
        className={cn(
          "fixed z-[110] w-[224px] sm:w-[264px]",
          "bg-white/97 border border-[color:var(--color-gold)]/40 rounded-2xl p-3.5 backdrop-blur-2xl shadow-xl",
          "transform transition-all duration-300 ease-out",
          showBetSlider ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none",
        )}
        style={{
          bottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
          right:  'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <p className="font-display text-[9px] tracking-widest uppercase text-gray-500 mb-1">
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
                className="py-2.5 text-[11px] font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 uppercase tracking-wider transition-colors">
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
