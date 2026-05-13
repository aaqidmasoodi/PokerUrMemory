import { useEffect, useState, useCallback } from 'react';
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

export type UIState = 'join' | 'lobby' | 'game';

const SESSION_KEY = 'pokermemory_session';

function saveSession(roomCode: string, playerName: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerName }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function loadSession(): { roomCode: string; playerName: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  const [uiState, setUiState] = useState<UIState>('join');
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myTurnData, setMyTurnData] = useState<YourTurnData | null>(null);
  const [actionLog, setActionLog] = useState<string>('Waiting for game to start...');
  const [timer, setTimer] = useState<number | null>(null);
  const [showdownData, setShowdownData] = useState<any | null>(null);
  const [discardRevealData, setDiscardRevealData] = useState<DiscardRevealData | null>(null);

  const [selectedDrawCards, setSelectedDrawCards] = useState<number[]>([]);
  const [hasDiscarded, setHasDiscarded] = useState<boolean>(false);
  const [turnTimer, setTurnTimer] = useState<{ playerId: string; timeLeft: number } | null>(null);
  const [gameLogs, setGameLogs] = useState<string[]>([]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    // Attempt reconnect on every new connection (handles page refresh)
    newSocket.on('connect', () => {
      const session = loadSession();
      if (session) {
        newSocket.emit('playerReconnect', session, (res: any) => {
          if (res?.success) {
            setRoomCode(session.roomCode);
            setPlayerId(res.playerId);
            setIsHost(res.isHost);
            setUiState('game');
          } else {
            // Session is stale — clear it and stay on join screen
            clearSession();
          }
        });
      }
    });

    newSocket.on('roomClosed', (msg: string) => {
      clearSession();
      alert(msg);
      setUiState('join');
      setRoomCode('');
      setGameState(null);
    });

    newSocket.on('lobbyUpdate', (data: any) => {
      setLobbyPlayers(data.players);
    });

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
      setTimer(state.timeLeft > 0 ? state.timeLeft : null);

      if (state.phase !== 'waiting' && state.phase !== 'showdown') {
        setUiState('game');
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
      // Vibrate on mobile (Android Chrome; iOS Safari ignores this)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      // Flash the page title so the player notices even in background tabs
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

    newSocket.on('drawRevealStart', (_data: any) => {
      setDiscardRevealData(null);
      setHasDiscarded(true);
      setMyTurnData(null);
    });

    newSocket.on('showdown', (data: any) => {
      setShowdownData(data);
      setMyTurnData(null);
      setUiState('game');
      const handStr = data.hands?.map((h: any) => `${h.playerName}: ${h.rankName}`).join(' · ');
      setGameLogs(prev => [`${data.winner.playerName} wins $${data.pot} with ${data.winner.rankName}${handStr ? ' — ' + handStr : ''}`, ...prev].slice(0, 60));
    });

    newSocket.on('bluffWin', (data: any) => {
      setShowdownData({
        isBluff: true,
        winner: { playerName: data.winner },
        amount: data.amount,
      });
      setMyTurnData(null);
      setUiState('game');
      setGameLogs(prev => [`${data.winner} wins $${data.amount} (all others folded)`, ...prev].slice(0, 60));
    });

    newSocket.on('gameOver', (data: any) => {
      setGameLogs(prev => [`🏆 GAME OVER — ${data.winnerName} wins with $${data.chips}!`, ...prev].slice(0, 60));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = useCallback((playerName: string) => {
    if (!socket) return;
    socket.emit('createRoom', { playerName }, (response: any) => {
      if (response.success) {
        setRoomCode(response.roomCode);
        setPlayerId(response.playerId);
        setIsHost(response.isHost);
        setUiState('lobby');
        setLobbyPlayers([{ name: playerName, isHost: true, id: response.playerId }]);
        saveSession(response.roomCode, playerName);
      } else {
        alert('Failed to create room');
      }
    });
  }, [socket]);

  const joinRoom = useCallback((roomCodeInput: string, playerName: string) => {
    if (!socket) return;
    const normalizedCode = roomCodeInput.trim().toUpperCase();
    socket.emit('joinRoom', { roomCode: normalizedCode, playerName }, (response: any) => {
      if (response.success) {
        setRoomCode(normalizedCode);
        setPlayerId(response.playerId);
        setIsHost(response.isHost);
        setUiState('lobby');
        saveSession(normalizedCode, playerName);
      } else {
        alert(response.error || 'Failed to join room');
      }
    });
  }, [socket]);

  const startGame = useCallback(() => {
    if (!socket) return;
    socket.emit('startGame', { roomCode }, (response: any) => {
      if (!response.success) alert(response.error);
    });
  }, [socket, roomCode]);

  const nextHand = useCallback(() => {
    if (!socket) return;
    socket.emit('nextHand', { roomCode }, (response: any) => {
      if (!response.success) alert(response.error);
      else setShowdownData(null);
    });
  }, [socket, roomCode]);

  const playAction = useCallback((action: string, amount: number = 0) => {
    if (!socket) return;
    socket.emit('playerAction', { roomCode, action, amount });
    setMyTurnData(null);
  }, [socket, roomCode]);

  const toggleDrawCard = useCallback((index: number) => {
    if (hasDiscarded || gameState?.phase !== 'draw') return;

    setSelectedDrawCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else if (newSet.size < 4) {
        newSet.add(index);
      }
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

  const leaveLobby = useCallback(() => {
    clearSession();
    if (socket && roomCode) socket.emit('leaveRoom', { roomCode });
    setUiState('join');
    setRoomCode('');
    setLobbyPlayers([]);
  }, [socket, roomCode]);

  const leaveGame = useCallback(() => {
    clearSession();
    socket?.disconnect();
    setUiState('join');
    setRoomCode('');
    setGameState(null);
    setMyTurnData(null);
    setShowdownData(null);
  }, [socket]);

  return {
    socket,
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
    discardRevealData,
    selectedDrawCards,
    hasDiscarded,
    turnTimer,

    gameLogs,
    createRoom,
    joinRoom,
    startGame,
    nextHand,
    playAction,
    toggleDrawCard,
    confirmDiscard,
    leaveLobby,
    leaveGame,
  };
}
