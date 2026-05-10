import { useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { PlayingCard } from "./components/poker/PlayingCard";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { cn } from "./lib/utils";
import { Clock, Eye, EyeOff, Coins, LogOut } from "lucide-react";

// Types mapping to server state
type Phase = "waiting" | "memoryReveal" | "firstBetting" | "draw" | "drawReveal" | "secondBetting" | "showdown";

function PhaseBadge({ phase, timer }: { phase: Phase; timer?: number | null }) {
  const map: Record<Phase, string> = {
    waiting: "Waiting",
    memoryReveal: "Memory Reveal",
    firstBetting: "First Betting",
    draw: "Draw Phase",
    drawReveal: "Replacement Reveal",
    secondBetting: "Second Betting",
    showdown: "Showdown",
  };
  
  const isEye = phase === "memoryReveal" || phase === "drawReveal";
  
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 gold-border backdrop-blur-sm">
      {isEye ? (
        <Eye className="w-3 h-3 text-[color:var(--color-gold)]" />
      ) : (
        <EyeOff className="w-3 h-3 text-[color:var(--color-gold)]" />
      )}
      <span className="font-display text-[9px] sm:text-[11px] font-semibold tracking-widest uppercase gold-text">
        {map[phase]}
      </span>
      {typeof timer === "number" && (
        <span className="flex items-center gap-0.5 text-[9px] sm:text-[11px] font-bold text-[color:var(--color-gold)]">
          <Clock className="w-2.5 h-2.5" />
          {timer}s
        </span>
      )}
    </div>
  );
}

function PlayerSeat({
  name,
  chips,
  bet,
  active,
  avatar,
  folded,
  isHero
}: {
  name: string;
  chips: number;
  bet?: number;
  active?: boolean;
  avatar: string;
  folded?: boolean;
  isHero?: boolean;
}) {
  return (
    <div className={cn("relative flex flex-col", isHero ? "items-center" : "items-center")}>
      {active && !folded && (
        <div className={cn(
          "absolute whitespace-nowrap z-20 px-2 py-0.5 rounded-full bg-[color:var(--color-gold)] text-black font-display font-bold text-[8px] sm:text-[12px] tracking-widest uppercase shadow-[0_0_20px_rgba(212,168,67,0.8)] transition-all animate-in zoom-in fade-in",
          isHero 
            ? "sm:-top-12 sm:left-1/2 sm:-translate-x-1/2 landscape:-left-24 landscape:top-1/2 landscape:-translate-y-1/2 landscape:sm:left-1/2 landscape:sm:-translate-x-1/2 landscape:sm:top-auto landscape:sm:translate-y-0 landscape:sm:-top-14 portrait:-bottom-8 portrait:left-1/2 portrait:-translate-x-1/2" 
            : "-top-6 left-1/2 -translate-x-1/2 sm:-top-14"
        )}>
          {isHero ? "Your Turn" : "Thinking..."}
        </div>
      )}
      <div
        className={cn(
          "flex items-center gap-1.5 sm:gap-4 rounded-full bg-black/60 backdrop-blur-md px-1.5 py-1 sm:px-4 sm:py-2.5 pr-2.5 sm:pr-6 transition-opacity",
          active && !folded ? "gold-border ring-2 ring-[color:var(--color-gold)]/50 scale-105 sm:scale-110 shadow-[0_0_30px_rgba(212,168,67,0.3)]" : "border border-white/10",
          folded && "opacity-40 grayscale"
        )}
      >
        <div
          className={cn(
            "w-7 h-7 sm:w-14 sm:h-14 rounded-full grid place-items-center font-display font-bold text-[10px] sm:text-xl shrink-0",
            "bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] text-[color:var(--color-felt-deep)] shadow-lg",
          )}
        >
          {avatar}
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="font-display text-[9px] sm:text-lg font-semibold tracking-wider uppercase text-foreground/90 truncate max-w-[60px] sm:max-w-none">
            {name}
          </span>
          <span className="text-[9px] sm:text-base font-bold gold-text">${chips.toLocaleString()}</span>
        </div>
        {typeof bet === "number" && bet > 0 && (
          <div className="ml-0.5 sm:ml-1 pl-1.5 sm:pl-2.5 border-l border-white/10 text-[8px] sm:text-[10px] text-[color:var(--color-gold)]/90 leading-tight">
            <div className="opacity-60 uppercase tracking-wider text-[7px] sm:text-[9px]">Bet</div>
            <div className="font-bold">${bet}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  variant = "ghost",
  onClick,
  className,
  disabled
}: {
  label: React.ReactNode;
  variant?: "primary" | "ghost";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 sm:h-14 rounded-lg sm:rounded-xl font-display tracking-widest uppercase text-[8px] sm:text-sm font-bold transition-all px-4 sm:px-8",
        variant === "primary"
          ? "bg-gradient-to-b from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] text-[color:var(--color-felt-deep)] hover:brightness-110 border border-black/30 shadow-[0_4px_14px_rgba(0,0,0,0.5)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          : "bg-black/45 text-[color:var(--color-gold)] gold-border hover:bg-black/60",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      {label}
    </Button>
  );
}

export default function App() {
  const {
    uiState,
    roomCode,
    playerId,
    isHost,
    lobbyPlayers,
    gameState,
    myTurnData,
    actionLog,
    timer,
    showdownData,
    selectedDrawCards,
    hasDiscarded,
    createRoom,
    joinRoom,
    startGame,
    nextHand,
    playAction,
    toggleDrawCard,
    confirmDiscard
  } = useSocket();

  const [playerNameInput, setPlayerNameInput] = useState("Player");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [raiseAmount, setRaiseAmount] = useState<number[]>([100]);
  const [showBetSlider, setShowBetSlider] = useState(false);

  // --- JOIN SCREEN ---
  if (uiState === "join") {
    return (
      <div className="h-dvh bg-[var(--color-background)] flex items-center justify-center p-4">
        <div className="bg-black/60 border border-[color:var(--color-gold)]/30 rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl backdrop-blur-md">
          <h1 className="font-display text-2xl sm:text-3xl font-bold gold-text mb-2">PokerUrMemory</h1>
          <p className="text-xs sm:text-sm text-gray-400 mb-6 sm:mb-8">5-Card Draw with a Memory Twist</p>
          
          <input
            type="text"
            placeholder="Your Name"
            value={playerNameInput}
            onChange={e => setPlayerNameInput(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 sm:py-3 text-white mb-4 sm:mb-6 focus:border-[color:var(--color-gold)] outline-none text-sm"
          />
          
          <ActionButton 
            variant="primary" 
            label="Create New Game" 
            className="w-full mb-4 sm:mb-6"
            onClick={() => createRoom(playerNameInput || "Player")}
          />
          
          <div className="flex items-center gap-4 my-4 sm:my-6 opacity-50">
            <div className="flex-1 h-px bg-white"></div>
            <span className="text-xs tracking-widest">OR</span>
            <div className="flex-1 h-px bg-white"></div>
          </div>
          
          <input
            type="text"
            placeholder="ROOM CODE"
            value={roomCodeInput}
            onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 sm:py-3 text-white mb-3 sm:mb-4 focus:border-[color:var(--color-gold)] outline-none uppercase text-center tracking-widest text-sm"
            maxLength={6}
          />
          
          <ActionButton 
            label="Join Game" 
            className="w-full"
            onClick={() => joinRoom(roomCodeInput, playerNameInput || "Player")}
          />
        </div>
      </div>
    );
  }

  // --- LOBBY SCREEN ---
  if (uiState === "lobby") {
    return (
      <div className="h-dvh bg-[var(--color-background)] flex items-center justify-center p-4">
        <div className="bg-black/60 border border-[color:var(--color-gold)]/30 rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl backdrop-blur-md">
          <h1 className="font-display text-xl sm:text-2xl font-bold gold-text mb-4 sm:mb-6">Game Lobby</h1>
          
          <div className="bg-[color:var(--color-gold)]/10 border border-[color:var(--color-gold)]/30 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-xs text-[color:var(--color-gold)]/60 tracking-widest mb-1">ROOM CODE</p>
            <p className="font-display text-2xl sm:text-3xl font-bold gold-text tracking-widest">{roomCode}</p>
          </div>
          
          <div className="text-left mb-6 sm:mb-8">
            <p className="text-sm text-gray-400 mb-3">Players ({lobbyPlayers.length}/4):</p>
            <div className="space-y-2">
              {lobbyPlayers.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 p-2.5 sm:p-3 rounded-lg">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[color:var(--color-gold)] text-black flex items-center justify-center font-bold text-sm">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{p.name} {p.id === playerId ? "(You)" : ""}</p>
                    <p className="text-xs text-gray-400">{p.isHost ? "Host" : "Guest"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {isHost ? (
            <ActionButton 
              variant="primary" 
              label="Start Game" 
              className="w-full"
              disabled={lobbyPlayers.length < 2}
              onClick={startGame}
            />
          ) : (
            <p className="text-sm text-gray-400 italic">Waiting for host to start the game...</p>
          )}
        </div>
      </div>
    );
  }

  // --- GAME SCREEN ---
  if (!gameState) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const opponents = gameState.players.filter(p => p.id !== playerId);
  const phase = gameState.phase;

  // Derive exact UI states from server state
  const isDrawReveal = phase === "drawReveal";
  const isDrawPhase = phase === "draw";
  const isShowdown = phase === "showdown" || showdownData !== null;
  const isBettingPhase = phase === "firstBetting" || phase === "secondBetting";
  const isMemoryReveal = phase === "memoryReveal";
  
  // Is it my turn to act?
  const myTurnActive = myTurnData !== null && !isShowdown && !isDrawReveal;

  return (
    <main className="h-dvh w-full flex flex-col bg-[radial-gradient(ellipse_at_top,oklch(0.22_0.04_150)_0%,oklch(0.10_0.02_150)_100%)] text-foreground overflow-hidden relative">
      
      {/* ===== FULL-SCREEN REVEAL TIMER ===== */}
      {(isMemoryReveal || phase === 'drawReveal') && typeof timer === "number" && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center bg-black/40 transition-opacity duration-300">
          <div className="relative flex flex-col items-center">
            <span className="font-display text-[10px] sm:text-lg tracking-[0.3em] uppercase text-[color:var(--color-gold)] mb-1 sm:mb-2 drop-shadow-md animate-in fade-in slide-in-from-bottom-2">
              {isMemoryReveal ? "Memorize the cards!" : "Revealing Discards!"}
            </span>
            <span 
              className="font-display font-black leading-none text-[70px] sm:text-[120px] animate-pulse"
              style={{
                color: 'var(--color-gold)',
                textShadow: '0 0 40px rgba(212,168,67,0.8), 0 0 80px rgba(212,168,67,0.4)',
                opacity: 0.95,
              }}
            >
              {timer}
            </span>
          </div>
        </div>
      )}

      {/* ===== SHOWDOWN BANNER ===== */}
      {isShowdown && showdownData && (
        <div className="fixed inset-0 z-[150] pointer-events-none flex items-center justify-center">
          <div className="bg-black/85 border-y border-[color:var(--color-gold)]/50 backdrop-blur-md py-4 sm:py-6 w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.8)]">
            <h2 className="font-display text-xl sm:text-3xl font-bold gold-text drop-shadow-[0_0_15px_rgba(212,168,67,0.5)] mb-2">
              {showdownData.winner.playerName || showdownData.winner} Wins!
            </h2>
            
            {showdownData.isBluff ? (
              <p className="text-gray-300 italic text-xs sm:text-base">Opponent folded</p>
            ) : showdownData.hands ? (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-4">
                {showdownData.hands.map((h: any, i: number) => {
                  const isWinner = h.playerId === showdownData.winner.playerId;
                  return (
                    <div key={i} className={cn("flex items-center gap-2 px-3 py-1 rounded-lg", isWinner ? "bg-[color:var(--color-gold)]/20 border border-[color:var(--color-gold)]/50" : "bg-white/5")}>
                      <span className="font-bold text-white text-[10px] sm:text-xs">{h.playerName}:</span>
                      <span className="text-[9px] sm:text-xs text-[color:var(--color-chip-teal)] font-bold">{h.rankName}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="text-[color:var(--color-gold)]/70 animate-pulse mt-2 font-display tracking-widest text-[9px] sm:text-xs uppercase">Next hand starting...</p>
          </div>
        </div>
      )}

      {/* ===== TOP BAR ===== */}
      <header className="flex items-center justify-between px-3 sm:px-4 pt-2 pb-1 shrink-0 z-20">
        <button onClick={() => window.location.reload()} className="w-7 h-7 sm:w-9 sm:h-9 grid place-items-center rounded-full bg-black/40 gold-border">
          <LogOut className="w-3 h-3 sm:w-4 sm:h-4 text-[color:var(--color-gold)] rotate-180" />
        </button>
        <div className="flex flex-col items-center">
          <span className="font-display text-[8px] sm:text-[10px] tracking-[0.3em] text-[color:var(--color-gold)]/80">
            ROOM CODE: {roomCode}
          </span>
          <span className="font-display text-xs sm:text-base font-bold gold-text">
            PokerUrMemory
          </span>
        </div>
        <div className="w-7 sm:w-9"></div>
      </header>

      {/* ===== TABLE AREA — fills remaining space ===== */}
      <section className="flex-1 min-h-0 relative z-10 px-1 sm:px-6 flex flex-col overflow-hidden">
        <div className="relative h-full w-full max-w-7xl mx-auto flex flex-col items-center justify-between py-0 sm:py-6">
          
          {/* Phase Badge - Absolute Top Right on Desktop */}
          <div className="absolute top-2 right-2 sm:top-0 sm:right-0 z-50 sm:scale-125 origin-top-right">
            <PhaseBadge phase={phase} timer={(!isMemoryReveal && phase !== 'drawReveal') ? timer : null} />
          </div>
          
          {/* Felt Background */}
          <div className="absolute inset-x-2 sm:inset-x-0 top-[2%] bottom-[2%] rounded-[42%/45%] sm:rounded-[40%/50%] felt-surface -z-10 shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" />

          {/* === OPPONENTS (Top — horizontal layout in landscape) === */}
          <div className="flex justify-center items-start gap-2 sm:gap-4 w-full px-2 sm:px-6 shrink-0 z-10 pt-1 sm:pt-4">
            {opponents.map((opp, idx) => {
              const total = opponents.length;
              let transformClass = "";
              if (total === 3) {
                if (idx === 0) transformClass = "sm:translate-y-4 sm:rotate-[8deg] origin-bottom-right";
                if (idx === 1) transformClass = "sm:-translate-y-2 z-10";
                if (idx === 2) transformClass = "sm:translate-y-4 sm:-rotate-[8deg] origin-bottom-left";
              } else if (total === 2) {
                if (idx === 0) transformClass = "sm:translate-y-2 sm:rotate-[6deg] origin-bottom-right";
                if (idx === 1) transformClass = "sm:translate-y-2 sm:-rotate-[6deg] origin-bottom-left";
              }

              return (
                <div key={idx} className={cn("flex flex-row items-center gap-1 sm:flex-col sm:gap-1 flex-1 min-w-0 transition-all duration-500 justify-center", transformClass, opp.folded && "opacity-25 grayscale")}>
                  <PlayerSeat 
                    name={opp.name} 
                    chips={opp.chips} 
                    bet={opp.currentBet} 
                    avatar={opp.name.charAt(0).toUpperCase()} 
                    active={opp.isCurrentTurn && !isShowdown}
                    folded={opp.folded}
                  />
                  <div className="flex justify-center -space-x-1 sm:space-x-0.5">
                    {opp.hand.map((c, ci) => (
                      <PlayingCard
                        key={ci}
                        card={c as any}
                        size="xs"
                        faceUp={c.faceUp}
                        highlight={isDrawReveal && c.faceUp}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* === CENTER TABLE INFO (Pot & Log) === */}
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-6 z-10 shrink min-h-0 flex-wrap px-2">
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-3xl bg-black/40 gold-border shadow-2xl backdrop-blur-md">
              <span className="font-display text-[7px] sm:text-xs tracking-[0.2em] uppercase text-[color:var(--color-gold)]/80">Pot</span>
              <Coins className="w-3 h-3 sm:w-6 sm:h-6 text-[color:var(--color-gold)]" />
              <span className="font-display text-sm sm:text-4xl font-bold gold-text leading-none">
                ${gameState.pot.toLocaleString()}
              </span>
            </div>
            <div className="text-[7px] sm:text-base text-gray-300 bg-black/30 px-2 py-0.5 sm:px-6 sm:py-2 rounded-full border border-white/5 shadow-inner backdrop-blur-sm truncate max-w-[200px] sm:max-w-none">
              {actionLog}
            </div>
          </div>

          {/* === HERO AREA (Bottom — horizontal in landscape) === */}
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 shrink-0 w-full z-20 pb-1 sm:pb-2">
            {myPlayer && (
              <>
                <PlayerSeat 
                  name={myPlayer.name} 
                  chips={myPlayer.chips} 
                  bet={myPlayer.currentBet} 
                  avatar={myPlayer.name.charAt(0).toUpperCase()} 
                  active={myTurnActive}
                  folded={myPlayer.folded}
                  isHero={true}
                />
                <div className="flex justify-center gap-0.5 sm:gap-1.5">
                  {myPlayer.hand.map((c, i) => {
                    const isClickable = isDrawPhase && !hasDiscarded && !myPlayer.folded;
                    const isSelected = selectedDrawCards.includes(i);
                    
                    return (
                      <PlayingCard
                        key={i}
                        card={c as any}
                        faceUp={true}
                        size="sm"
                        selected={isSelected}
                        highlight={isSelected || (isDrawReveal && c.isReplacement && c.faceUp)}
                        onClick={isClickable ? () => toggleDrawCard(i) : undefined}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== FIXED OVERLAY ACTION BAR (No layout shift!) ===== */}
      <div className="fixed z-[100] pointer-events-none 
                      bottom-0 inset-x-0 pb-2 px-2 
                      sm:bottom-4 sm:right-4 sm:left-auto sm:w-[180px]
                      flex flex-col justify-end">
        
        {/* Draw Controls */}
        <div className={cn(
          "w-full mx-auto pointer-events-auto transition-all duration-300 ease-out transform",
          (isDrawPhase && !myPlayer?.folded && !hasDiscarded) ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none absolute"
        )}>
          <div className="flex flex-col items-center gap-1.5">
            <p className="font-display text-[8px] tracking-widest uppercase gold-text bg-black/60 px-3 py-1 rounded-full gold-border backdrop-blur-md shadow-lg text-center leading-tight">
              Discard<br className="hidden sm:block" />({selectedDrawCards.length}/4)
            </p>
            <ActionButton 
              variant="primary" 
              label={selectedDrawCards.length === 0 ? "Stand Pat" : `Discard (${selectedDrawCards.length})`}
              onClick={confirmDiscard}
              className="w-full shadow-2xl"
            />
          </div>
        </div>

        {/* Main Betting Controls */}
        <div className={cn(
          "w-full mx-auto pointer-events-auto transition-all duration-300 ease-out transform",
          (myTurnActive && isBettingPhase && !showBetSlider && myTurnData) ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none absolute"
        )}>
          <div className="grid grid-cols-3 sm:grid-cols-1 gap-1.5 bg-black/70 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl gold-border backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
            <ActionButton 
              label="Fold" 
              onClick={() => playAction('fold')} 
            />
            
            {myTurnData?.canCheck ? (
              <ActionButton 
                label="Check" 
                variant="primary"
                onClick={() => playAction('check')} 
              />
            ) : (
              <ActionButton 
                label={
                  <div className="flex flex-col items-center leading-tight">
                    <span>Call</span>
                    <span className="text-[7px] font-sans font-normal opacity-80">${myTurnData ? myTurnData.currentBet - myTurnData.playerBet : 0}</span>
                  </div>
                }
                variant="primary"
                onClick={() => playAction('call')} 
                disabled={!myTurnData?.canCall}
              />
            )}

            <ActionButton 
              label={myTurnData?.currentBet === 0 ? "Bet" : "Raise"}
              onClick={() => {
                const minVal = myTurnData!.currentBet === 0 ? myTurnData!.minBet : myTurnData!.minRaise;
                setRaiseAmount([Math.min(minVal, myTurnData!.maxBet)]);
                setShowBetSlider(true);
              }} 
              disabled={!myTurnData?.canRaise}
            />
          </div>
        </div>
      </div>

      {/* ===== SLIDE-UP/IN BET SLIDER UI ===== */}
      <div className={cn(
        "fixed z-[110] bg-black/95 border border-[color:var(--color-gold)]/50 backdrop-blur-2xl shadow-2xl transform transition-transform duration-300 ease-out",
        "bottom-0 inset-x-0 border-x-0 border-b-0 rounded-t-2xl pb-4 px-3 pt-4",
        "sm:bottom-4 sm:right-4 sm:left-auto sm:w-[200px] sm:rounded-2xl sm:p-3 sm:border",
        showBetSlider ? "translate-y-0 sm:translate-x-0 opacity-100" : "translate-y-full sm:translate-y-0 sm:translate-x-[120%] opacity-0 sm:opacity-100"
      )}>
        <div className="w-full flex flex-col h-full">
          <div className="flex sm:flex-col items-center sm:items-center justify-between sm:justify-center mb-3">
            <span className="font-display text-[9px] tracking-widest uppercase text-gray-400 sm:mb-1">
              {myTurnData?.currentBet === 0 ? "Bet" : "Raise"}
            </span>
            <span className="font-display text-lg sm:text-2xl font-bold gold-text drop-shadow-md">${raiseAmount[0]}</span>
          </div>
          
          <div className="mb-4 px-2">
            <Slider 
              value={raiseAmount} 
              onValueChange={setRaiseAmount} 
              min={myTurnData ? (myTurnData.currentBet === 0 ? myTurnData.minBet : myTurnData.minRaise) : 0} 
              max={myTurnData ? myTurnData.maxBet : 100} 
              step={1} 
              className="py-2"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {['Min', '½ Pot', 'Pot', 'All In'].map((label, idx) => {
              const pot = gameState.pot;
              const min = myTurnData ? (myTurnData.currentBet === 0 ? myTurnData.minBet : myTurnData.minRaise) : 0;
              let val = min;
              if (label === '½ Pot') val = Math.max(min, Math.floor(pot / 2));
              if (label === 'Pot') val = Math.max(min, pot);
              if (label === 'All In') val = myTurnData ? myTurnData.maxBet : 100;
              val = Math.min(val, myTurnData ? myTurnData.maxBet : 100);

              return (
                <button 
                  key={idx}
                  onClick={() => setRaiseAmount([val])}
                  className="w-full py-1 text-[8px] font-semibold rounded bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white transition-colors uppercase tracking-wider"
                >
                  {label}
                </button>
              )
            })}
          </div>
          
          <div className="flex sm:flex-col gap-1.5 mt-auto">
            <ActionButton 
              variant="primary" 
              label="Confirm" 
              className="flex-[2] sm:w-full"
              onClick={() => {
                const amt = raiseAmount[0];
                if (myTurnData && amt >= myTurnData.maxBet) {
                  playAction('allIn');
                } else {
                  playAction(myTurnData?.currentBet === 0 ? 'bet' : 'raise', amt);
                }
                setShowBetSlider(false);
              }}
            />
            <ActionButton label="Cancel" onClick={() => setShowBetSlider(false)} className="flex-1 sm:w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
