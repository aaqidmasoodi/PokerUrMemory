import { useState, useEffect, useRef, Fragment } from "react";
import { useSocket, type DiscardEntry, type Phase } from "./hooks/useSocket";
import { useAuth } from "./hooks/useAuth";
import { usePresence } from "./hooks/usePresence";
import { LandingScreen } from "./screens/LandingScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { MainMenuScreen } from "./screens/MainMenuScreen";
import { MatchmakingScreen } from "./screens/MatchmakingScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { RulesScreen, RulesBody, AboutScreen } from "./screens/RulesScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { ScheduledGamesScreen } from "./screens/ScheduledGamesScreen";
import { PracticeSetupScreen } from "./screens/PracticeSetupScreen";
import { WaitingRoomScreen } from "./screens/WaitingRoomScreen";
import { TableLayoutEditor } from "./screens/TableLayoutEditor";
import { IncomingInviteModal } from "./components/IncomingInviteModal";
import { PlayerStatsModal } from "./components/PlayerStatsModal";
import { PokerBackground } from "./components/PokerBackground";
import { PlayingCard } from "./components/poker/PlayingCard";
import { PlayerSeat, PlayerNameDisplay, LayoutBox } from "./components/poker/PlayerSeat";
import { ChipStack } from "./components/poker/ChipStack";
import {
  type TableLayout,
  loadTableLayout, saveTableLayout, baseSizeForCount, cardSpacingForCount, clampCount, DEFAULT_TABLE_LAYOUT,
} from "./lib/tableLayout";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { cn } from "./lib/utils";
import { Clock, Eye, LogOut, Volume2, VolumeX, ScrollText, X, BookOpen } from "lucide-react";


type AppScreen = 'menu' | 'matchmaking' | 'profile' | 'settings' | 'tableLayout' | 'rules' | 'about' | 'lobby' | 'scheduled' | 'practice';

let _globalMuted = false;
function playSound(file: string, volume = 0.55) {
  if (_globalMuted) return;
  try { const a = new Audio(`/sounds/${file}`); a.volume = volume; a.play().catch(() => {}); } catch {}
}

function speak(text: string) {
  if (_globalMuted || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// ─── Phase badge ─────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<Phase, string> = {
  waiting: "Waiting", memoryReveal: "Memory", firstBetting: "Betting",
  draw: "Draw", discardReveal: "Discards", drawReveal: "Reveal", secondBetting: "Betting", showdown: "Showdown",
};

function phaseTimer(phase: Phase, timer?: number | null): number | null {
  // Betting phases use the per-turn ring on the seat, not the global timer badge.
  const isBetting = phase === "firstBetting" || phase === "secondBetting";
  if (isBetting) return null;
  const t = typeof timer === "number" ? timer : null;
  return t != null && t > 0 ? t : null;
}

function PhaseBadge({ phase }: { phase: Phase }) {
  const isEye = phase === "memoryReveal" || phase === "drawReveal";
  return (
    <div className="pointer-events-none">
      <div className="flex items-center gap-1.5 rounded-2xl bg-white/90 gold-border backdrop-blur-sm shadow-md px-2.5 py-1.5">
        {isEye
          ? <Eye className="w-3 h-3 text-[color:var(--color-gold)]" />
          : <Clock className="w-3 h-3 text-[color:var(--color-gold)]" />
        }
        <span className="font-display text-[9px] sm:text-[11px] font-semibold tracking-widest uppercase gold-text whitespace-nowrap">
          {PHASE_LABELS[phase]}
        </span>
      </div>
    </div>
  );
}

// Big countdown — rendered on its own row *below* the rules/log buttons so it
// never stacks on top of an opponent's cards.
function TimerBadge({ phase, timer }: { phase: Phase; timer?: number | null }) {
  const displayTimer = phaseTimer(phase, timer);
  if (displayTimer == null) return null;
  const timerColor = "var(--color-gold)";
  return (
    <div className="pointer-events-none flex items-center justify-center rounded-2xl bg-white/90 gold-border backdrop-blur-sm shadow-md px-4 py-1">
      <span
        className="font-display font-black leading-none tabular-nums text-[34px] sm:text-[48px]"
        style={{ color: timerColor, textShadow: `0 0 18px ${timerColor}99, 0 0 40px ${timerColor}44` }}
      >
        {displayTimer}
      </span>
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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)] px-4">
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

// ─── Scheduled game ready toast ───────────────────────────────────────────────

function ScheduledGameToast({
  data,
  inGame,
  onAccept,
  onDecline,
}: {
  data: { roomCode: string; hostName: string; joinWindowSecs: number };
  inGame: boolean;
  onAccept: (leaveFirst: boolean) => Promise<{ success: boolean; error?: string }>;
  onDecline: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(data.joinWindowSecs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(t); onDecline(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = async (leaveFirst: boolean) => {
    setBusy(true);
    const res = await onAccept(leaveFirst);
    if (res.error) { setError(res.error); setBusy(false); }
  };

  const pct = (secondsLeft / data.joinWindowSecs) * 100;

  return (
    <div
      className="fixed left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-[350]
        bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-black/[0.07]
        overflow-hidden
        animate-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Countdown bar */}
      <div className="h-[3px] bg-gray-100">
        <div
          className="h-full bg-[color:var(--color-blue)] transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-3.5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-[color:var(--color-blue)]/10 grid place-items-center text-base">
            🃏
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[12px] text-gray-900 leading-tight">
              Scheduled game starting!
            </p>
            <p className="text-[11px] text-gray-500 leading-snug mt-0.5 truncate">
              <span className="font-semibold text-gray-700">{data.hostName}</span> launched the table
            </p>
          </div>
          <span className="shrink-0 font-display font-bold text-[11px] text-[color:var(--color-blue)] tabular-nums">
            {secondsLeft}s
          </span>
        </div>

        {error && (
          <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 mb-2.5 leading-snug">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onDecline}
            disabled={busy}
            className="flex-1 h-9 rounded-xl font-display tracking-wider uppercase text-[10px] font-bold
              bg-gray-100 text-gray-500 border border-gray-200
              active:scale-[0.97] transition-all disabled:opacity-50"
          >
            Decline
          </button>
          {inGame ? (
            <button
              onClick={() => handleAccept(true)}
              disabled={busy}
              className="flex-1 h-9 rounded-xl font-display tracking-wider uppercase text-[10px] font-bold
                bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
                text-white border border-black/10 shadow
                active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {busy ? 'Joining…' : 'Leave & Join'}
            </button>
          ) : (
            <button
              onClick={() => handleAccept(false)}
              disabled={busy}
              className="flex-1 h-9 rounded-xl font-display tracking-wider uppercase text-[10px] font-bold
                bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
                text-white border border-black/10 shadow
                active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {busy ? 'Joining…' : 'Join Game'}
            </button>
          )}
        </div>
      </div>
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
  const { authState, user, profile, signInWithGoogle, signInWithFacebook, signOut, createProfile, updateProfile } = useAuth();
  const {
    socket,
    inGame, playerId, gameState,
    myTurnData, actionLog, timer, showdownData, nextHandCountdown, discardRevealData, selectedDrawCards, hasDiscarded,
    turnTimer, gameLogs, disconnectNotice, roomClosedMsg, dismissRoomClosed,
    matchTimedOut, findGame, cancelSearch, startPractice,
    playAction, toggleDrawCard, confirmDiscard, leaveGame,
    lobby, lobbyTransitioning, incomingInvite, inviteDeclinedNotice,
    registerUser, createLobby, leaveLobby, inviteToLobby, acceptInvite, declineInvite, startLobby, startScheduledGame,
    scheduledGameReady, acceptScheduledGame, dismissScheduledGameReady,
    waitingRoom, beginScheduledGame, leaveWaitingRoom,
  } = useSocket();
  const onlineUserIds = usePresence(profile?.id ?? null, profile?.username ?? null);

  const [appScreen, setAppScreen] = useState<AppScreen>('menu');
  const [showRules, setShowRules] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState<number[]>([5]);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [viewingOpponent, setViewingOpponent] = useState<{ userId: string; name: string } | null>(null);
  // Per-device opponent layout (position + size per opponent count). Loaded once
  // from localStorage; the editor persists every change.
  const [tableLayout, setTableLayout] = useState<TableLayout>(() => loadTableLayout());
  const handleLayoutChange = (l: TableLayout) => { setTableLayout(l); saveTableLayout(l); };

  useEffect(() => {
    _globalMuted = muted;
    return () => { _globalMuted = false; };
  }, [muted]);

  const menuClickSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio("/sounds/Menu_Button_Click.wav");
    a.preload = "auto";
    menuClickSoundRef.current = a;
  }, []);
  useEffect(() => {
    if (inGame) return;
    const handleClick = (e: MouseEvent) => {
      if (_globalMuted) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.closest("button")) {
        const audio = menuClickSoundRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.volume = 0.4;
        audio.play().catch(() => {});
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [inGame]);

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
  const prevTurnPlayerRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = gameState?.phase;
    if (!phase) return;

    const currentTurnPlayer = gameState.players?.find(p => p.isCurrentTurn && !p.folded);
    const currentPlayerId = currentTurnPlayer?.id;

    if (phase !== prevPhaseRef.current) {
      if (phase === 'memoryReveal') {
        setFlashAction(null);
        setTimeout(() => { playSound('card_flip.wav'); speak("Memorise the cards"); }, 300);
      } else if (prevPhaseRef.current === 'memoryReveal' && phase === 'firstBetting') {
        setTimeout(() => { playSound('card_flip.wav'); speak("Cards hidden"); }, 300);
      } else if (phase === 'drawReveal') {
      setTimeout(() => { playSound('card_flip.wav'); speak("Memorise drawn cards"); }, 300);
    } else if (phase === 'discardReveal') {
      setTimeout(() => { playSound('card_flip.wav'); speak("Showing discards"); }, 300);
    } else if (phase === 'draw') {
      speak("Pick cards to discard");
    }
    prevPhaseRef.current = phase;
    }

    if (phase !== 'showdown' && currentPlayerId && currentPlayerId !== prevTurnPlayerRef.current) {
      if (currentPlayerId === playerId) {
        speak("Your turn");
      } else if (currentTurnPlayer) {
        speak(`${currentTurnPlayer.name}'s turn`);
      }
      prevTurnPlayerRef.current = currentPlayerId;
    }
  }, [gameState?.phase, gameState?.currentPlayerIndex]);

  useEffect(() => {
    if (showdownData?.winner) {
      const winnerName = showdownData.winner.playerName;
      setTimeout(() => speak(`${winnerName} wins`), 500);
    }
  }, [showdownData]);

  // ── AUTH SCREENS ──────────────────────────────────────────────────────────────
  if (authState === 'loading') return (
    <div className="h-full flex flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)]">
      <div className="w-8 h-8 border-2 border-[color:var(--color-blue)]/30 border-t-[color:var(--color-blue)] rounded-full animate-spin" />
      <button
        onClick={signOut}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
  if (authState === 'landing') return <div className="h-full bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)] relative"><PokerBackground /><LandingScreen onLogin={signInWithGoogle} onFacebookLogin={signInWithFacebook} /></div>;
  if (authState === 'onboarding' && user) return <div className="h-full bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)] relative"><PokerBackground /><OnboardingScreen user={user} onComplete={createProfile} /></div>;

  // ── NON-GAME SCREENS ──────────────────────────────────────────────────────────
  if (!inGame) {
    let screen: React.ReactNode;

    if (roomClosedMsg) {
      screen = (
        <div className="h-dvh flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)] p-6">
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
    } else if (waitingRoom) {
      screen = (
        <WaitingRoomScreen
          waitingRoom={waitingRoom}
          myPlayerId={playerId}
          onStart={beginScheduledGame}
          onLeave={() => { leaveWaitingRoom(); setAppScreen('menu'); }}
        />
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
    } else if (appScreen === 'scheduled') {
      screen = (
        <ScheduledGamesScreen
          profile={profile!}
          onBack={() => setAppScreen('menu')}
          onLaunchGame={startScheduledGame}
        />
      );
    } else if (appScreen === 'practice') {
      screen = (
        <PracticeSetupScreen
          onBack={() => setAppScreen('menu')}
          onStart={(bots, difficulty) => startPractice(bots, difficulty)}
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
          onOpenLayout={() => setAppScreen('tableLayout')}
          onBack={() => setAppScreen('menu')}
          onSignOut={signOut}
        />
      );
    } else if (appScreen === 'tableLayout') {
      screen = (
        <TableLayoutEditor
          layout={tableLayout}
          onChange={handleLayoutChange}
          onBack={() => setAppScreen('settings')}
        />
      );
    } else if (appScreen === 'rules') {
      screen = <RulesScreen onBack={() => setAppScreen('menu')} />;
    } else if (appScreen === 'about') {
      screen = <AboutScreen onBack={() => setAppScreen('menu')} />;
    } else {
      screen = (
        <MainMenuScreen
          profile={profile!}
          onStartGame={() => setAppScreen('matchmaking')}
          onPlayWithComputer={() => setAppScreen('practice')}
          onPlayWithFriends={() => setAppScreen('lobby')}
          onScheduledGames={() => setAppScreen('scheduled')}
          onProfile={() => setAppScreen('profile')}
          onSettings={() => setAppScreen('settings')}
          onRules={() => setAppScreen('rules')}
          onAbout={() => setAppScreen('about')}
        />
      );
    }

    return (
      <div className="h-full bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)]">
        <PokerBackground />
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
        {scheduledGameReady && (
          <ScheduledGameToast
            data={scheduledGameReady}
            inGame={inGame}
            onAccept={async (leaveFirst) => {
              if (leaveFirst) leaveGame();
              return acceptScheduledGame(scheduledGameReady.roomCode);
            }}
            onDecline={dismissScheduledGameReady}
          />
        )}
        {inviteDeclinedNotice && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[350] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-red-50 border border-red-300 text-red-700 font-display text-[10px] tracking-widest uppercase"
            style={{ top: 'calc(3.5rem + var(--safe-top))' }}
          >
            {inviteDeclinedNotice.byUsername} declined
          </div>
        )}
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
  const amSittingOut    = !!myPlayer?.sittingOut;
  const myTurnActive    = myTurnData !== null && !isShowdown && !isDrawReveal && !isDiscardReveal && !amSittingOut;
  const showDraw      = isDrawPhase && !myPlayer?.folded && !hasDiscarded && !amSittingOut;
  const showBetting   = myTurnActive && isBettingPhase && !showBetSlider && !!myTurnData;

  const potChipVariant = gameState.pot >= 500 ? "gold" : gameState.pot >= 200 ? "blue" : "red";
  const heroTurnTimeLeft = turnTimer?.playerId === playerId ? turnTimer.timeLeft : null;

  const currentTurnPlayer = gameState.players.find(p => p.isCurrentTurn && !p.folded);
  const infoMsg = (() => {
    if (amSittingOut)    return { text: "Sitting out — you’ll join next hand", urgent: false };
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
    <main className="h-dvh w-full bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)] text-foreground overflow-hidden relative">
      <PokerBackground />

      {/* ── EXIT DIALOG ── */}
      {showExitDialog && (
        <ConfirmDialog
          title="Leave Game?"
          message="You'll be disconnected from the table. Any chips in the pot will be forfeited."
          confirmLabel="Leave" cancelLabel="Stay"
          onCancel={() => setShowExitDialog(false)}
          onConfirm={() => { setShowExitDialog(false); setAppScreen('menu'); leaveGame(); }}
        />
      )}

      {scheduledGameReady && (
        <ScheduledGameToast
          data={scheduledGameReady}
          inGame={inGame}
          onAccept={async (leaveFirst) => {
            if (leaveFirst) leaveGame();
            return acceptScheduledGame(scheduledGameReady.roomCode);
          }}
          onDecline={dismissScheduledGameReady}
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
            <h2 className="font-display text-base sm:text-3xl font-bold gold-text mb-2 flex items-center justify-center gap-1.5 flex-wrap">
              <PlayerNameDisplay name={showdownData.winner.playerName} nameCls="text-base sm:text-3xl" /> Wins!
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
                      <span className="font-bold text-foreground flex items-center gap-0.5"><PlayerNameDisplay name={h.playerName} nameCls="text-[10px] sm:text-xs" />:</span>
                      <span className="text-[color:var(--color-chip-teal)] font-bold">{h.description ?? h.rankName}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {nextHandCountdown != null && nextHandCountdown > 0 ? (
              <div className="mt-2.5 flex items-center justify-center gap-2">
                <span className="font-display tracking-widest text-[9px] sm:text-[11px] uppercase text-gray-500">
                  Next round in
                </span>
                <span
                  className="font-display font-black tabular-nums text-[color:var(--color-gold)] text-xl sm:text-3xl leading-none"
                  style={{ textShadow: '0 0 16px rgba(212,168,67,0.5)' }}
                >
                  {nextHandCountdown}
                </span>
              </div>
            ) : (
              <p className="text-[color:var(--color-gold)] animate-pulse mt-2 font-display tracking-widest text-[8px] uppercase opacity-80">
                Next round starting…
              </p>
            )}
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
          style={{ top: 'calc(3.5rem + var(--safe-top))' }}
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
          top:   'calc(0.625rem + var(--safe-top))',
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

        {/* Right: phase badge + rules + log on top, big timer below */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
          <div className="flex items-start gap-1.5">
            <PhaseBadge phase={phase} />
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
          <TimerBadge phase={phase} timer={timer} />
        </div>
      </div>

      {/* ── FELT TABLE OVAL ── */}
      <div className="felt-surface absolute inset-x-[4%] top-[7%] bottom-[4%] rounded-[50%] -z-10 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]" />

      {/* ── OPPONENTS ── */}
      {/* Each element is a direct child of <main> (no pointer-events-none wrapper)
          to avoid a WebKit bug where touch events don't reach pointer-events:auto
          children of a pointer-events:none parent on iOS Safari. */}
      {(() => {
        const oppCount = clampCount(opponents.length);
        const seats = tableLayout[oppCount];
        const baseSize = baseSizeForCount(opponents.length);
        const cardSpacing = cardSpacingForCount(opponents.length);
        return opponents.map((opp, idx) => {
          const oppTurnTimeLeft = turnTimer?.playerId === opp.id ? turnTimer.timeLeft : null;
          const seat = seats[idx] ?? seats[seats.length - 1] ?? DEFAULT_TABLE_LAYOUT[oppCount][0];
          return (
            <Fragment key={idx}>
              {/* Name tag — interactive (tap to view stats). touch-action:manipulation
                  kills the 300 ms iOS tap delay without disabling scrolling. */}
              <LayoutBox
                el={seat.nameTag}
                className={cn("z-10", opp.sittingOut && "opacity-50")}
              >
                <button
                  type="button"
                  onClick={() => opp.userId && setViewingOpponent({ userId: opp.userId, name: opp.name })}
                  disabled={!opp.userId}
                  className="active:scale-[0.95] transition-transform disabled:cursor-default flex flex-col items-center"
                  style={{ touchAction: 'manipulation' }}
                  title={opp.userId ? "View stats" : undefined}
                >
                  <PlayerSeat
                    name={opp.name} chips={opp.chips} bet={opp.currentBet}
                    avatar={!opp.userId ? '🤖' : opp.name.charAt(0).toUpperCase()}
                    active={opp.isCurrentTurn && !isShowdown && !opp.disconnected && !opp.sittingOut}
                    folded={opp.folded}
                    disconnected={opp.disconnected}
                    turnTimeLeft={oppTurnTimeLeft}
                    size={baseSize}
                    flashLabel={flashAction?.playerId === opp.id ? flashAction.label : undefined}
                  />
                  {opp.sittingOut && (
                    <span className="mt-0.5 font-display text-[7px] sm:text-[8px] tracking-widest uppercase text-white/60 bg-black/30 px-1.5 py-0.5 rounded-full">
                      Sitting out
                    </span>
                  )}
                </button>
              </LayoutBox>

              {/* Cards — display only, never interactive. pointer-events:none
                  prevents the card <button> elements from eating taps that
                  should reach the name tag above. */}
              <LayoutBox
                el={seat.cards}
                className={cn("z-10 pointer-events-none", opp.sittingOut && "opacity-50")}
              >
                <div className={cn("flex", cardSpacing)}>
                  {opp.hand.map((c, ci) => (
                    <PlayingCard
                      key={ci} card={c as any} size="sm" faceUp={c.faceUp}
                      highlight={isDrawReveal && c.faceUp}
                      className={opp.folded ? "opacity-30 grayscale" : undefined}
                    />
                  ))}
                </div>
              </LayoutBox>
            </Fragment>
          );
        });
      })()}

      {/* ── CENTER — pot + action log ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5 lg:gap-2.5">
        <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-5 py-1.5 lg:py-2.5 rounded-full bg-white/90 gold-border backdrop-blur-md shadow-md whitespace-nowrap">
          <div
            className="w-3.5 h-3.5 lg:w-5 lg:h-5 rounded-full shrink-0 shadow-md"
            style={{ backgroundColor: potChipVariant === "gold" ? "var(--color-gold)" : potChipVariant === "blue" ? "var(--color-chip-blue)" : "var(--color-chip-red)" }}
          />
          <span className="font-display font-bold gold-text text-[11px] sm:text-sm lg:text-xl xl:text-2xl">
            {gameState.pot.toLocaleString()}pts
          </span>
        </div>
        <div className={cn(
          "px-4 py-2 rounded-2xl text-center shadow-md max-w-[200px] sm:max-w-[280px] transition-colors duration-300",
          infoMsg.urgent
            ? "bg-[color:var(--color-blue)] border border-[color:var(--color-blue-soft)]"
            : "bg-white/90 border border-black/[0.08]",
        )}>
          <p className={cn(
            "font-display font-bold leading-tight text-[13px] sm:text-[15px] lg:text-xl xl:text-2xl",
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
        <>
          {/* Own name tag (independently positioned) */}
          <LayoutBox el={tableLayout.hero.nameTag} className="z-20">
            <PlayerSeat
              name={myPlayer.name} chips={myPlayer.chips} bet={myPlayer.currentBet}
              avatar={myPlayer.name.charAt(0).toUpperCase()}
              active={myTurnActive} folded={myPlayer.folded}
              turnTimeLeft={heroTurnTimeLeft}
              flashLabel={flashAction?.playerId === myPlayer.id ? flashAction.label : undefined}
            />
          </LayoutBox>

          {/* Own cards (independently positioned) */}
          <LayoutBox el={tableLayout.hero.cards} className="z-20">
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
          </LayoutBox>
        </>
      )}

      {/* ── FIXED ACTION BAR ── */}
      <div
        className="fixed z-40 flex flex-col gap-1.5 lg:gap-2 items-stretch w-[112px] sm:w-[140px] lg:w-[180px] xl:w-[220px]"
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
                      {myTurnData!.currentBet - myTurnData!.playerBet}pts
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
          "fixed top-0 right-0 h-full z-[210] w-[280px] sm:w-[320px] lg:w-[400px] xl:w-[480px] flex flex-col",
          "bg-white/97 border-l border-[color:var(--color-gold)]/30 shadow-2xl backdrop-blur-xl",
          "transform transition-transform duration-300 ease-out",
          showLog ? "translate-x-0" : "translate-x-full",
        )}
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
          "fixed top-0 right-0 h-full z-[210] w-[300px] sm:w-[360px] lg:w-[440px] xl:w-[520px] flex flex-col",
          "bg-white/97 border-l border-[color:var(--color-gold)]/30 shadow-2xl backdrop-blur-xl",
          "transform transition-transform duration-300 ease-out",
          showRules ? "translate-x-0" : "translate-x-full",
        )}
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
          "fixed z-[110] w-[224px] sm:w-[264px] lg:w-[320px] xl:w-[380px]",
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
        <div className="pt-2 mb-3 flex items-center justify-center gap-3">
          <ChipStack amount={raiseAmount[0]} variant="red" size="sm" showLabel={false} />
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black gold-text tabular-nums text-5xl sm:text-6xl leading-none">
              {raiseAmount[0]}
            </span>
            <span className="font-display text-[10px] tracking-widest uppercase text-gray-400">pts</span>
          </div>
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
          {(["Min", "½ Pot", "Pot", "Max"] as const).map((label, idx) => {
            const pot = gameState.pot;
            const min = myTurnData ? (myTurnData.currentBet === 0 ? myTurnData.minBet : myTurnData.minRaise) : 0;
            let val = min;
            if (label === "½ Pot") val = Math.max(min, Math.floor(pot / 2));
            if (label === "Pot")   val = Math.max(min, pot);
            if (label === "Max") val = myTurnData ? myTurnData.maxBet : 100;
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

      {viewingOpponent && (
        <PlayerStatsModal
          userId={viewingOpponent.userId}
          fallbackName={viewingOpponent.name}
          onClose={() => setViewingOpponent(null)}
        />
      )}
    </main>
  );
}
