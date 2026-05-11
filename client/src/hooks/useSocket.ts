import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type Phase = 'waiting' | 'memoryReveal' | 'firstBetting' | 'draw' | 'drawReveal' | 'secondBetting' | 'showdown';

export interface CardData {
  suit: '♠' | '♥' | '♦' | '♣' | null;
  value: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | null;
  faceUp: boolean;
  isInitiallyFaceUp?: boolean;
  isInitiallyHidden?: boolean;
  isHidden?: boolean;
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

// Inferred UI state
export type UIState = 'join' | 'lobby' | 'game';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // High-level App State
  const [uiState, setUiState] = useState<UIState>('join');
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);
  
  // Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myTurnData, setMyTurnData] = useState<YourTurnData | null>(null);
  const [actionLog, setActionLog] = useState<string>('Waiting for game to start...');
  const [timer, setTimer] = useState<number | null>(null);
  const [showdownData, setShowdownData] = useState<any | null>(null);
  
  // Client-side interactions
  const [selectedDrawCards, setSelectedDrawCards] = useState<number[]>([]);
  const [hasDiscarded, setHasDiscarded] = useState<boolean>(false);
  const [turnTimer, setTurnTimer] = useState<{ playerId: string; timeLeft: number } | null>(null);

  useEffect(() => {
    // We connect to the same host (the express server serves the react app)
    const newSocket = io();
    setSocket(newSocket);



    newSocket.on('roomClosed', (msg: string) => {
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

    newSocket.on('yourTurnNotification', (_data: { message: string, phase: string }) => {
      // Optional: Toast notification here
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
      setMyTurnData(null); // Hide betting controls
    });

    newSocket.on('drawRevealStart', (_data: any) => {
      setHasDiscarded(true);
      setMyTurnData(null);
    });

    newSocket.on('showdown', (data: any) => {
      setShowdownData(data);
      setMyTurnData(null);
      setUiState('game');
    });

    newSocket.on('bluffWin', (data: any) => {
      setShowdownData({
        isBluff: true,
        winner: { playerName: data.winner },
        amount: data.amount
      });
      setMyTurnData(null);
      setUiState('game');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Actions
  const createRoom = useCallback((playerName: string) => {
    if (!socket) return;
    socket.emit('createRoom', { playerName }, (response: any) => {
      if (response.success) {
        setRoomCode(response.roomCode);
        setPlayerId(response.playerId);
        setIsHost(response.isHost);
        setUiState('lobby');
        setLobbyPlayers([{ name: playerName, isHost: true, id: response.playerId }]);
      } else {
        alert('Failed to create room');
      }
    });
  }, [socket]);

  const joinRoom = useCallback((roomCodeInput: string, playerName: string) => {
    if (!socket) return;
    socket.emit('joinRoom', { roomCode: roomCodeInput, playerName }, (response: any) => {
      if (response.success) {
        setRoomCode(roomCodeInput);
        setPlayerId(response.playerId);
        setIsHost(response.isHost);
        setUiState('lobby');
        // Will get lobbyUpdate soon
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
    setMyTurnData(null); // Hide controls optimistically
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
      
      socket?.emit('playerSelectCards', {
        roomCode,
        selectedIndices: arr
      });
      
      return arr;
    });
  }, [hasDiscarded, gameState, socket, roomCode]);

  const confirmDiscard = useCallback(() => {
    if (hasDiscarded || !socket) return;
    setHasDiscarded(true);
    socket.emit('playerConfirmDiscard', { roomCode });
  }, [hasDiscarded, socket, roomCode]);

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
    selectedDrawCards,
    hasDiscarded,
    turnTimer,

    createRoom,
    joinRoom,
    startGame,
    nextHand,
    playAction,
    toggleDrawCard,
    confirmDiscard
  };
}
