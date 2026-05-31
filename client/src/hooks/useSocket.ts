import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../lib/supabase';

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
  userId?: string | null;
  name: string;
  chips: number;
  currentBet: number;
  folded: boolean;
  isAllIn: boolean;
  isHost: boolean;
  isCurrentTurn: boolean;
  disconnected?: boolean;
  sittingOut?: boolean;
  hand: CardData[];
}

export interface WaitingRoomState {
  roomCode: string;
  players: { id: string; userId: string | null; name: string; isHost: boolean; disconnected?: boolean }[];
  count: number;
  target: number;
  canStart: boolean;
  deadline: number | null;
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

export interface LobbyMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface Lobby {
  id: string;
  hostUserId: string;
  members: LobbyMember[];
}

export interface IncomingInvite {
  lobbyId: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
}

export interface ShowdownHandEntry {
  playerId: string;
  playerName: string;
  hand: CardData[];
  rankName: string;
  description?: string;
}

export interface ShowdownData {
  isBluff?: boolean;
  winner: { playerId?: string; playerName: string; rankName?: string; description?: string };
  amount?: number;
  hands?: ShowdownHandEntry[];
  winnings?: { playerId: string; amount: number }[];
  pot?: number;
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
  const currentUserRef = useRef<{ userId: string; username: string } | null>(null);
  const avatarRef = useRef<string | null>(null);
  // Latest Supabase access token — read by the socket handshake so the server can
  // verify identity (auth) instead of trusting client-supplied user ids.
  const tokenRef = useRef<string | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myTurnData, setMyTurnData] = useState<YourTurnData | null>(null);
  const [actionLog, setActionLog] = useState<string>('');
  const [timer, setTimer] = useState<number | null>(null);
  const [showdownData, setShowdownData] = useState<ShowdownData | null>(null);
  const [nextHandCountdown, setNextHandCountdown] = useState<number | null>(null);
  const [discardRevealData, setDiscardRevealData] = useState<DiscardRevealData | null>(null);
  const [selectedDrawCards, setSelectedDrawCards] = useState<number[]>([]);
  const [hasDiscarded, setHasDiscarded] = useState<boolean>(false);
  const [turnTimer, setTurnTimer] = useState<{ playerId: string; timeLeft: number } | null>(null);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [disconnectNotice, setDisconnectNotice] = useState<{ playerName: string; reconnecting: boolean } | null>(null);
  const [roomClosedMsg, setRoomClosedMsg] = useState<string | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [lobbyTransitioning, setLobbyTransitioning] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [inviteDeclinedNotice, setInviteDeclinedNotice] = useState<{ byUsername: string } | null>(null);
  const inviteDeclinedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scheduledGameReady, setScheduledGameReady] = useState<{
    roomCode: string;
    hostName: string;
    gameId: string;
    joinWindowSecs: number;
  } | null>(null);
  const [waitingRoom, setWaitingRoom] = useState<WaitingRoomState | null>(null);

  useEffect(() => {
    // The handshake auth is a function so socket.io re-reads the freshest token on
    // every (re)connect — including after we set it post-login and reconnect.
    // In the browser build VITE_SERVER_URL is empty → same-origin. In the Capacitor
    // (Android) build the app is served from https://localhost, so it's set to the
    // deployed server's absolute URL.
    // When a server URL is set (Capacitor build) the app origin is https://localhost,
    // which makes Socket.IO's initial polling request cross-origin and CORS-blocked.
    // Skipping polling and going straight to WebSocket sidesteps this: browsers don't
    // enforce CORS on WS upgrades, and WebSocket is more efficient on mobile anyway.
    const serverUrl = import.meta.env.VITE_SERVER_URL || '';
    const newSocket = io(serverUrl, {
      // Async auth callback: called on every connect/reconnect right before the
      // handshake packet is sent. Fetching the session here guarantees the server
      // always gets a valid token even on the very first connect (before auth has
      // resolved) or after a background token refresh.
      auth: async (cb) => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        tokenRef.current = token;
        cb({ token: token ?? '' });
      },
      ...(serverUrl ? { transports: ['websocket'] } : {}),
    });
    setSocket(newSocket);

    // ── Named handlers (improves stack traces and breakpoint targeting) ──────────

    let initialConnectDone = false;
    function onConnect() {
      if (currentUserRef.current) {
        newSocket.emit('auth:register', {
          username: currentUserRef.current.username,
          avatarUrl: avatarRef.current,
        });
      }
      if (!initialConnectDone) { initialConnectDone = true; return; }
      // Socket reconnected — attempt to rejoin if we were in a room
      if (roomCodeRef.current && currentUserRef.current) {
        newSocket.emit('rejoinGame', { roomCode: roomCodeRef.current }, (res: any) => {
          if (res?.success) {
            setPlayerId(res.playerId);
            playerIdRef.current = res.playerId;
            setIsHost(res.isHost);
          } else {
            // Room is gone — reset to menu. Keep currentUserRef: the user's identity
            // outlives a single game, and nulling it makes the next matchFound abort
            // (the lobby "stuck on Starting Game…" bug).
            setInGame(false);
            setRoomCode('');
            setGameState(null);
            setDisconnectNotice(null);
            roomCodeRef.current = '';
          }
        });
      }
    }

    function onMatchFound({ roomCode: rc }: { roomCode: string }) {
      // Identity comes from the matchmaking queue (pendingMatchRef) or, for
      // lobby-started games, from the registered current user.
      const ident = pendingMatchRef.current ?? currentUserRef.current;
      if (!ident) return;
      // The server-side lobby is gone the moment matchFound fires — clear it so
      // neither device can re-click "Start game" against a now-deleted lobby.
      setLobby(null);
      setLobbyTransitioning(true);
      newSocket.emit('joinMatchedGame', { roomCode: rc, username: ident.username }, (res: any) => {
        if (res?.success) {
          const upperRc = rc.toUpperCase();
          setRoomCode(upperRc);
          roomCodeRef.current = upperRc;
          setPlayerId(res.playerId);
          playerIdRef.current = res.playerId;
          setIsHost(res.isHost);
          pendingMatchRef.current = null;
        } else {
          setLobbyTransitioning(false);
        }
      });
    }

    function onRoomClosed(msg: string) {
      setInGame(false);
      setRoomCode('');
      setGameState(null);
      setDisconnectNotice(null);
      setWaitingRoom(null);
      roomCodeRef.current = '';
      // Do NOT null currentUserRef here — the user's identity persists beyond a
      // single game. Nulling it broke subsequent lobby games: matchFound would see
      // ident = null and silently abort, leaving the host's opponent stuck on
      // "Starting Game…" forever.
      setRoomClosedMsg(msg);
    }

    function onGameState(state: GameState) {
      setGameState(state);
      setTimer(state.timeLeft > 0 ? state.timeLeft : null);

      const me = state.players.find(p => p.id === playerIdRef.current);
      if (me) setIsHost(me.isHost);

      if (state.phase !== 'waiting' && state.phase !== 'showdown') {
        setInGame(true);
        setShowdownData(null);
        setNextHandCountdown(null);
        setWaitingRoom(null);
      }
      if (state.phase !== 'draw') {
        setSelectedDrawCards([]);
        setHasDiscarded(false);
      }
      if (state.phase !== 'firstBetting' && state.phase !== 'secondBetting') {
        setTurnTimer(null);
      }
    }

    newSocket.on('connect', onConnect);
    newSocket.on('matchFound', onMatchFound);
    newSocket.on('matchTimeout', () => { pendingMatchRef.current = null; setMatchTimedOut(true); });
    newSocket.on('roomClosed', onRoomClosed);
    newSocket.on('gameState', onGameState);

    newSocket.on('turnTimer', (data: { playerId: string; timeLeft: number } | null) => {
      setTurnTimer(data);
    });

    newSocket.on('yourTurn', (data: YourTurnData) => {
      setMyTurnData(data);
    });

    newSocket.on('yourTurnNotification', () => {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      const original = document.title;
      document.title = '🃏 Your Turn: PokerUrMemory';
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

    newSocket.on('showdown', (data: ShowdownData) => {
      setShowdownData(data);
      setMyTurnData(null);
      setInGame(true);
      const handStr = data.hands?.map(h => `${h.playerName}: ${h.description ?? h.rankName}`).join(' · ');
      setGameLogs(prev => [`${data.winner.playerName} wins ${data.pot}pts with ${data.winner.description ?? data.winner.rankName}${handStr ? ': ' + handStr : ''}`, ...prev].slice(0, 60));
    });

    newSocket.on('nextHandCountdown', (seconds: number) => {
      setNextHandCountdown(seconds);
    });

    newSocket.on('bluffWin', (data: { winner: string; amount: number }) => {
      setShowdownData({ isBluff: true, winner: { playerName: data.winner }, amount: data.amount });
      setMyTurnData(null);
      setInGame(true);
      setGameLogs(prev => [`${data.winner} wins ${data.amount}pts (all others folded)`, ...prev].slice(0, 60));
    });

    newSocket.on('gameOver', (data: { winnerName: string; chips: number }) => {
      setGameLogs(prev => [`🏆 GAME OVER: ${data.winnerName} wins with ${data.chips}pts!`, ...prev].slice(0, 60));
    });

    newSocket.on('playerDisconnected', ({ playerName }: { playerId: string; playerName: string }) => {
      setDisconnectNotice({ playerName, reconnecting: true });
    });

    newSocket.on('playerLeft', ({ playerName }: { playerName?: string }) => {
      setDisconnectNotice(prev =>
        prev ? { playerName: playerName ?? prev.playerName, reconnecting: false } : null
      );
      setTimeout(() => setDisconnectNotice(null), 3000);
    });

    newSocket.on('playerRejoined', ({ playerName }: { playerName: string }) => {
      setDisconnectNotice(null);
      setActionLog(`${playerName} reconnected.`);
    });

    // ── Lobby / invites ────────────────────────────────────────────────────────
    newSocket.on('lobby:update', (data: Lobby | null) => {
      setLobby(data);
      if (data === null) setLobbyTransitioning(false);
    });

    newSocket.on('lobby:incomingInvite', (data: IncomingInvite) => {
      setIncomingInvite(data);
    });

    newSocket.on('scheduled:gameReady', (data: { roomCode: string; hostName: string; gameId: string; joinWindowSecs: number }) => {
      setScheduledGameReady(data);
    });

    newSocket.on('waitingRoom', (data: WaitingRoomState) => {
      setWaitingRoom(data);
    });

    newSocket.on('lobby:inviteDeclined', ({ byUsername }: { byUsername: string }) => {
      if (inviteDeclinedTimerRef.current) clearTimeout(inviteDeclinedTimerRef.current);
      setInviteDeclinedNotice({ byUsername });
      inviteDeclinedTimerRef.current = setTimeout(() => {
        inviteDeclinedTimerRef.current = null;
        setInviteDeclinedNotice(null);
      }, 3000);
    });

    return () => {
      if (inviteDeclinedTimerRef.current) clearTimeout(inviteDeclinedTimerRef.current);
      newSocket.close();
    };
  }, []);

  // Clear lobby + transition state when game actually starts
  useEffect(() => {
    if (inGame && (lobby || lobbyTransitioning)) {
      setLobby(null);
      setLobbyTransitioning(false);
    }
  }, [inGame, lobby, lobbyTransitioning]);

  const findGame = useCallback((userId: string, username: string) => {
    if (!socket) return;
    pendingMatchRef.current = { userId, username };
    currentUserRef.current = { userId, username };
    setMatchTimedOut(false);
    socket.emit('findGame', { username });
  }, [socket]);

  const cancelSearch = useCallback(() => {
    if (!socket) return;
    pendingMatchRef.current = null;
    setMatchTimedOut(false);
    socket.emit('cancelSearch');
  }, [socket]);

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

  const registerUser = useCallback(async (userId: string, username: string, avatarUrl: string | null) => {
    currentUserRef.current = { userId, username };
    avatarRef.current = avatarUrl;
    if (!socket) return;

    // Make sure the socket handshake carries the current access token so the server
    // can verify identity. If the token changed since we connected, reconnect to
    // re-run the handshake (auth callback re-reads tokenRef on connect).
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (token && tokenRef.current !== token) {
      tokenRef.current = token;
      socket.disconnect().connect(); // the 'connect' handler re-emits auth:register
      return;
    }
    socket.emit('auth:register', { username, avatarUrl });
  }, [socket]);

  const createLobby = useCallback((): Promise<{ success: boolean; lobby?: Lobby; error?: string }> => {
    const emit = () => new Promise<{ success: boolean; lobby?: Lobby; error?: string }>(resolve => {
      if (!socket) return resolve({ success: false, error: 'Not connected' });
      socket.emit('lobby:create', null, (res: any) => resolve(res ?? { success: false }));
    });
    return (async () => {
      let res = await emit();
      // Defensive: if the user record was lost (server restart, race) re-register and retry once
      if (!res.success && res.error === 'Not registered' && currentUserRef.current) {
        socket?.emit('auth:register', {
          username: currentUserRef.current.username,
          avatarUrl: avatarRef.current,
        });
        res = await emit();
      }
      if (res.success && res.lobby) setLobby(res.lobby);
      return res;
    })();
  }, [socket]);

  const leaveLobby = useCallback(() => {
    socket?.emit('lobby:leave');
    setLobby(null);
    setLobbyTransitioning(false);
  }, [socket]);

  const inviteToLobby = useCallback((toUserId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      if (!socket) return resolve({ success: false, error: 'Not connected' });
      socket.emit('lobby:invite', { toUserId }, (res: any) => resolve(res ?? { success: false }));
    });
  }, [socket]);

  const acceptInvite = useCallback((lobbyId: string): Promise<{ success: boolean; lobby?: Lobby; error?: string }> => {
    return new Promise(resolve => {
      if (!socket) return resolve({ success: false, error: 'Not connected' });
      socket.emit('lobby:acceptInvite', { lobbyId }, (res: any) => {
        if (res?.success && res.lobby) setLobby(res.lobby);
        setIncomingInvite(null);
        resolve(res ?? { success: false });
      });
    });
  }, [socket]);

  const declineInvite = useCallback((lobbyId: string, fromUserId: string) => {
    socket?.emit('lobby:declineInvite', { lobbyId, fromUserId });
    setIncomingInvite(null);
  }, [socket]);

  const startLobby = useCallback((): Promise<{ success: boolean; roomCode?: string; error?: string }> => {
    return new Promise(resolve => {
      if (!socket) return resolve({ success: false, error: 'Not connected' });
      socket.emit('lobby:start', null, (res: any) => resolve(res ?? { success: false }));
    });
  }, [socket]);

  const startScheduledGame = useCallback((gameId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      if (!socket) return resolve({ success: false, error: 'Not connected' });
      socket.emit('scheduled:start', { gameId }, (res: any) => resolve(res ?? { success: false }));
    });
  }, [socket]);

  const acceptScheduledGame = useCallback((roomCode: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      if (!socket) return resolve({ success: false, error: 'Not connected' });
      setScheduledGameReady(null);
      socket.emit('scheduled:accept', { roomCode }, (res: any) => resolve(res ?? { success: false }));
    });
  }, [socket]);

  const dismissScheduledGameReady = useCallback(() => {
    setScheduledGameReady(null);
  }, []);

  const beginScheduledGame = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      if (!socket) return resolve({ success: false, error: 'Not connected' });
      socket.emit('scheduled:beginNow', null, (res: any) => resolve(res ?? { success: false }));
    });
  }, [socket]);

  const leaveWaitingRoom = useCallback(() => {
    if (waitingRoom) socket?.emit('leaveRoom', { roomCode: waitingRoom.roomCode });
    setWaitingRoom(null);
    setRoomCode('');
    roomCodeRef.current = '';
  }, [socket, waitingRoom]);

  const dismissInvite = useCallback(() => setIncomingInvite(null), []);

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
    // Do NOT null currentUserRef — user identity must survive game exit so
    // the next matchFound handler can call joinMatchedGame correctly.
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
    nextHandCountdown,
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
    playAction,
    toggleDrawCard,
    confirmDiscard,
    leaveGame,
    lobby,
    lobbyTransitioning,
    incomingInvite,
    inviteDeclinedNotice,
    registerUser,
    createLobby,
    leaveLobby,
    inviteToLobby,
    acceptInvite,
    declineInvite,
    startLobby,
    startScheduledGame,
    scheduledGameReady,
    acceptScheduledGame,
    dismissScheduledGameReady,
    waitingRoom,
    beginScheduledGame,
    leaveWaitingRoom,
    dismissInvite,
  };
}
