import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export type Phase = 'waiting' | 'memoryReveal' | 'firstBetting' | 'draw' | 'discardReveal' | 'drawReveal' | 'secondBetting' | 'showdown';

export interface CardData {
  suit: '♠' | '♥' | '♦' | '♣' | null;
  value: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | null;
  faceUp: boolean;
  isInitiallyFaceUp?: boolean;
  isInitiallyHidden?: boolean;
  isReplacement?: boolean;
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  currentBet: number;
  folded: boolean;
  isAllIn: boolean;
  isHost: boolean;
  isCurrentTurn: boolean;
  disconnected?: boolean;
  hand: CardData[];
}

export interface GameState {
  roomCode: string;
  pot: number;
  currentBet: number;
  phase: Phase;
  currentPlayerIndex: number;
  players: Player[];
  timeLeft: number;
}

export interface YourTurnData {
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  maxBet: number;
  minBet: number;
}

export interface DiscardEntry {
  playerId: string;
  playerName: string;
  cards: CardData[];
}

export interface DiscardRevealData {
  timer: number;
  discards: DiscardEntry[];
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [inGame, setInGame] = useState(false);
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [matchTimedOut, setMatchTimedOut] = useState(false);
  const pendingMatchRef = useRef<{ userId: string; username: string } | null>(null);
  const playerIdRef = useRef<string>('');
  const roomCodeRef = useRef<string>('');
  const currentUserRef = useRef<{ userId: string } | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myTurnData, setMyTurnData] = useState<YourTurnData | null>(null);
  const [actionLog, setActionLog] = useState<string>('');
  const [timer, setTimer] = useState<number | null>(null);
  const [showdownData, setShowdownData] = useState<any | null>(null);
  const [discardRevealData, setDiscardRevealData] = useState<DiscardRevealData | null>(null);
  const [selectedDrawCards, setSelectedDrawCards] = useState<number[]>([]);
  const [hasDiscarded, setHasDiscarded] = useState<boolean>(false);
  const [turnTimer, setTurnTimer] = useState<{ playerId: string; timeLeft: number } | null>(null);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [disconnectNotice, setDisconnectNotice] = useState<{ playerName: string; reconnecting: boolean } | null>(null);
  const [roomClosedMsg, setRoomClosedMsg] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    let initialConnectDone = false;
    newSocket.on('connect', () => {
      if (!initialConnectDone) { initialConnectDone = true; return; }
      // Socket reconnected — attempt to rejoin if we were in a room
      if (roomCodeRef.current && currentUserRef.current) {
        newSocket.emit('rejoinGame', {
          userId: currentUserRef.current.userId,
          roomCode: roomCodeRef.current,
        }, (res: any) => {
          if (res?.success) {
            setPlayerId(res.playerId);
            playerIdRef.current = res.playerId;
            setIsHost(res.isHost);
          } else {
            // Room is gone — reset to menu
            setInGame(false);
            setRoomCode('');
            setGameState(null);
            setDisconnectNotice(null);
            roomCodeRef.current = '';
            currentUserRef.current = null;
          }
        });
      }
    });

    newSocket.on('matchFound', ({ roomCode: rc }: { roomCode: string }) => {
      const pending = pendingMatchRef.current;
      if (!pending) return;
      newSocket.emit('joinMatchedGame', { roomCode: rc, userId: pending.userId, username: pending.username }, (res: any) => {
        if (res?.success) {
          const upperRc = rc.toUpperCase();
          setRoomCode(upperRc);
          roomCodeRef.current = upperRc;
          setPlayerId(res.playerId);
          playerIdRef.current = res.playerId;
          setIsHost(res.isHost);
          pendingMatchRef.current = null;
        }
      });
    });

    newSocket.on('matchTimeout', () => {
      pendingMatchRef.current = null;
      setMatchTimedOut(true);
    });

    newSocket.on('roomClosed', (msg: string) => {
      setInGame(false);
      setRoomCode('');
      setGameState(null);
      setDisconnectNotice(null);
      roomCodeRef.current = '';
      currentUserRef.current = null;
      setRoomClosedMsg(msg);
    });

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
      setTimer(state.timeLeft > 0 ? state.timeLeft : null);

      const me = state.players.find(p => p.id === playerIdRef.current);
      if (me) setIsHost(me.isHost);

      if (state.phase !== 'waiting' && state.phase !== 'showdown') {
        setInGame(true);
        setShowdownData(null);
      }

      if (state.phase !== 'draw') {
        setSelectedDrawCards([]);
        setHasDiscarded(false);
      }

      if (state.phase !== 'firstBetting' && state.phase !== 'secondBetting') {
        setTurnTimer(null);
      }
    });

    newSocket.on('turnTimer', (data: { playerId: string; timeLeft: number } | null) => {
      setTurnTimer(data);
    });

    newSocket.on('yourTurn', (data: YourTurnData) => {
      setMyTurnData(data);
    });

    newSocket.on('yourTurnNotification', () => {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      const original = document.title;
      document.title = '🃏 Your Turn! — PokerUrMemory';
      setTimeout(() => { document.title = original; }, 3000);
    });

    newSocket.on('actionLog', (msg: string) => {
      setActionLog(msg);
    });

    newSocket.on('timerUpdate', (time: number) => {
      setTimer(time > 0 ? time : null);
    });

    newSocket.on('drawPhaseStart', () => {
      setHasDiscarded(false);
      setSelectedDrawCards([]);
      setMyTurnData(null);
      setDiscardRevealData(null);
    });

    newSocket.on('discardRevealStart', (data: DiscardRevealData) => {
      setDiscardRevealData(data);
      setHasDiscarded(true);
      setMyTurnData(null);
    });

    newSocket.on('drawRevealStart', () => {
      setDiscardRevealData(null);
      setHasDiscarded(true);
      setMyTurnData(null);
    });

    newSocket.on('showdown', (data: any) => {
      setShowdownData(data);
      setMyTurnData(null);
      setInGame(true);
      const handStr = data.hands?.map((h: any) => `${h.playerName}: ${h.rankName}`).join(' · ');
      setGameLogs(prev => [`${data.winner.playerName} wins $${data.pot} with ${data.winner.rankName}${handStr ? ' — ' + handStr : ''}`, ...prev].slice(0, 60));
    });

    newSocket.on('bluffWin', (data: any) => {
      setShowdownData({ isBluff: true, winner: { playerName: data.winner }, amount: data.amount });
      setMyTurnData(null);
      setInGame(true);
      setGameLogs(prev => [`${data.winner} wins $${data.amount} (all others folded)`, ...prev].slice(0, 60));
    });

    newSocket.on('gameOver', (data: any) => {
      setGameLogs(prev => [`🏆 GAME OVER — ${data.winnerName} wins with $${data.chips}!`, ...prev].slice(0, 60));
    });

    newSocket.on('playerDisconnected', ({ playerName }: { playerId: string; playerName: string }) => {
      setDisconnectNotice({ playerName, reconnecting: true });
    });

    newSocket.on('playerLeft', ({ playerName }: { playerName?: string }) => {
      setDisconnectNotice(prev =>
        prev ? { playerName: prev.playerName, reconnecting: false } : null
      );
      setTimeout(() => setDisconnectNotice(null), 3000);
    });

    newSocket.on('playerRejoined', ({ playerName }: { playerName: string }) => {
      setDisconnectNotice(null);
      setActionLog(`${playerName} reconnected.`);
    });

    return () => { newSocket.close(); };
  }, []);

  const findGame = useCallback((userId: string, username: string) => {
    if (!socket) return;
    pendingMatchRef.current = { userId, username };
    currentUserRef.current = { userId };
    setMatchTimedOut(false);
    socket.emit('findGame', { userId, username });
  }, [socket]);

  const cancelSearch = useCallback(() => {
    if (!socket) return;
    pendingMatchRef.current = null;
    setMatchTimedOut(false);
    socket.emit('cancelSearch');
  }, [socket]);

  const nextHand = useCallback(() => {
    if (!socket) return;
    socket.emit('nextHand', { roomCode }, (res: any) => {
      if (res?.success) setShowdownData(null);
    });
  }, [socket, roomCode]);

  const playAction = useCallback((action: string, amount = 0) => {
    if (!socket) return;
    socket.emit('playerAction', { roomCode, action, amount });
    setMyTurnData(null);
  }, [socket, roomCode]);

  const toggleDrawCard = useCallback((index: number) => {
    if (hasDiscarded || gameState?.phase !== 'draw') return;
    setSelectedDrawCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) { newSet.delete(index); }
      else if (newSet.size < 4) { newSet.add(index); }
      const arr = Array.from(newSet);
      socket?.emit('playerSelectCards', { roomCode, selectedIndices: arr });
      return arr;
    });
  }, [hasDiscarded, gameState, socket, roomCode]);

  const confirmDiscard = useCallback(() => {
    if (hasDiscarded || !socket) return;
    setHasDiscarded(true);
    socket.emit('playerConfirmDiscard', { roomCode });
  }, [hasDiscarded, socket, roomCode]);

  const dismissRoomClosed = useCallback(() => {
    setRoomClosedMsg(null);
  }, []);

  const leaveGame = useCallback(() => {
    socket?.emit('leaveRoom', { roomCode });
    setInGame(false);
    setRoomCode('');
    setGameState(null);
    setMyTurnData(null);
    setShowdownData(null);
    setGameLogs([]);
    setDisconnectNotice(null);
    roomCodeRef.current = '';
    currentUserRef.current = null;
  }, [socket, roomCode]);

  return {
    socket,
    inGame,
    roomCode,
    playerId,
    isHost,
    gameState,
    myTurnData,
    actionLog,
    timer,
    showdownData,
    discardRevealData,
    selectedDrawCards,
    hasDiscarded,
    turnTimer,
    gameLogs,
    matchTimedOut,
    disconnectNotice,
    roomClosedMsg,
    dismissRoomClosed,
    findGame,
    cancelSearch,
    nextHand,
    playAction,
    toggleDrawCard,
    confirmDiscard,
    leaveGame,
  };
}
