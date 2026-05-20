const { GameRoom } = require('./gameRoom');
const { recordGameResult, supabase } = require('./supabase');
const crypto = require('crypto');

// ── In-memory matchmaking queue ───────────────────────────────────────────────
// Each entry: { socketId, userId, username, queueTimeout }
const waitingPlayers = [];
const GATHER_WINDOW_MS = 3000;  // after 2 players found, wait up to 3s for more
const QUEUE_TIMEOUT_MS = 20000; // 20s personal timeout per player
let gatherTimer = null;

// ── User socket registry (for invite routing) ─────────────────────────────────
// Each user has at most one active socket. Re-registering replaces the old one.
const userSockets = new Map();    // userId -> socketId
const socketUsers = new Map();    // socketId -> { userId, username, avatarUrl }

// ── Lobby state ───────────────────────────────────────────────────────────────
// lobby = { id, hostUserId, members: Map<userId, { socketId, username, avatarUrl }>, invites: Set<userId> }
const lobbies = new Map();        // lobbyId -> lobby
const userLobby = new Map();      // userId -> lobbyId

function newLobbyId() {
  return crypto.randomBytes(6).toString('hex');
}

function serializeLobby(lobby) {
  return {
    id: lobby.id,
    hostUserId: lobby.hostUserId,
    members: Array.from(lobby.members.entries()).map(([userId, m]) => ({
      userId, username: m.username, avatarUrl: m.avatarUrl,
    })),
  };
}

function broadcastLobby(io, lobby) {
  const payload = serializeLobby(lobby);
  for (const m of lobby.members.values()) {
    io.to(m.socketId).emit('lobby:update', payload);
  }
}

function destroyLobby(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  for (const userId of lobby.members.keys()) userLobby.delete(userId);
  lobbies.delete(lobbyId);
}

function leaveLobby(io, userId) {
  const lobbyId = userLobby.get(userId);
  if (!lobbyId) return null;
  const lobby = lobbies.get(lobbyId);
  if (!lobby) { userLobby.delete(userId); return null; }

  lobby.members.delete(userId);
  userLobby.delete(userId);

  if (lobby.members.size === 0) {
    destroyLobby(lobbyId);
    return null;
  }

  // Promote a new host if the old host left
  if (lobby.hostUserId === userId) {
    lobby.hostUserId = lobby.members.keys().next().value;
  }

  broadcastLobby(io, lobby);
  return lobby;
}

function removeWaiting(socketId) {
  const idx = waitingPlayers.findIndex(p => p.socketId === socketId);
  if (idx < 0) return;
  clearTimeout(waitingPlayers[idx].queueTimeout);
  waitingPlayers.splice(idx, 1);
  // If a gather timer is running but we've dropped below 2 players, cancel it
  if (gatherTimer && waitingPlayers.length < 2) {
    clearTimeout(gatherTimer);
    gatherTimer = null;
  }
}

function generateRoomCode(rooms) {
  let code;
  do { code = Math.random().toString(36).substring(2, 8).toUpperCase(); } while (rooms.has(code));
  return code;
}

function formMatch(rooms, io) {
  if (waitingPlayers.length < 2) return;
  if (gatherTimer) { clearTimeout(gatherTimer); gatherTimer = null; }

  const batch = waitingPlayers.splice(0, 4);
  batch.forEach(p => clearTimeout(p.queueTimeout));

  const roomCode = generateRoomCode(rooms);
  const room = new GameRoom(roomCode, null, io);
  room.expectedPlayerCount = batch.length;
  room.matchedUserIds = batch.map(p => p.userId);
  rooms.set(roomCode, room);

  // Write game session to Supabase for stats (fire-and-forget)
  supabase
    .from('game_sessions')
    .insert({ room_code: roomCode, player_count: batch.length, status: 'forming' })
    .select()
    .single()
    .then(({ data }) => { if (data) room.gameSessionId = data.id; });

  batch.forEach(p => io.to(p.socketId).emit('matchFound', { roomCode }));
  console.log(`[matchmaking] ${batch.length} players → room ${roomCode}`);
}

function tryMatch(rooms, io) {
  // 4 players: start immediately, no need to wait
  if (waitingPlayers.length >= 4) {
    formMatch(rooms, io);
    return;
  }
  // 2-3 players: start a short gather window to collect more, then start
  if (waitingPlayers.length >= 2 && !gatherTimer) {
    gatherTimer = setTimeout(() => {
      gatherTimer = null;
      formMatch(rooms, io);
    }, GATHER_WINDOW_MS);
  }
}

// ── Socket handlers ───────────────────────────────────────────────────────────

const RECONNECT_GRACE_MS = 60_000;

function setupSocketHandlers(io, rooms) {
  // ── Auth: verify the Supabase access token at the handshake ──────────────────
  // The verified user id is the ONLY source of identity for the socket. Clients can
  // no longer claim to be an arbitrary userId — anything they send is ignored in
  // favour of socket.data.userId derived from the JWT here.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    socket.data.userId = null;
    if (!token) return next(); // allow unauthenticated connection; gated per-event below
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) socket.data.userId = data.user.id;
    } catch (err) {
      console.error('[auth] token verification failed:', err?.message ?? err);
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id, socket.data.userId ? '(authenticated)' : '(anonymous)');

    // ── User registration (for invite routing) ────────────────────────────────

    socket.on('auth:register', ({ username, avatarUrl }) => {
      // Identity is the verified token's user id — never the client-supplied value.
      const userId = socket.data.userId;
      if (!userId || !username) return;

      // If this user had another live socket, evict it from the registry.
      // (Don't disconnect it — they may be on two tabs, the older tab just loses invite routing.)
      const prevSocketId = userSockets.get(userId);
      if (prevSocketId && prevSocketId !== socket.id) {
        socketUsers.delete(prevSocketId);
      }

      userSockets.set(userId, socket.id);
      socketUsers.set(socket.id, { userId, username, avatarUrl: avatarUrl ?? null });

      // If they were in a lobby on a previous socket, refresh that lobby's record
      const lobbyId = userLobby.get(userId);
      if (lobbyId) {
        const lobby = lobbies.get(lobbyId);
        if (lobby && lobby.members.has(userId)) {
          const m = lobby.members.get(userId);
          m.socketId = socket.id;
          m.username = username;
          m.avatarUrl = avatarUrl ?? null;
          broadcastLobby(io, lobby);
        }
      }
    });

    // ── Lobby: create ─────────────────────────────────────────────────────────

    socket.on('lobby:create', (_, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const me = socketUsers.get(socket.id);
      if (!me) { cb({ success: false, error: 'Not registered' }); return; }

      // If user is already in a lobby, leave it first
      if (userLobby.has(me.userId)) leaveLobby(io, me.userId);

      const lobby = {
        id: newLobbyId(),
        hostUserId: me.userId,
        members: new Map([[me.userId, { socketId: socket.id, username: me.username, avatarUrl: me.avatarUrl }]]),
      };
      lobbies.set(lobby.id, lobby);
      userLobby.set(me.userId, lobby.id);

      cb({ success: true, lobby: serializeLobby(lobby) });
    });

    // ── Lobby: leave ──────────────────────────────────────────────────────────

    socket.on('lobby:leave', () => {
      const me = socketUsers.get(socket.id);
      if (!me) return;
      leaveLobby(io, me.userId);
      socket.emit('lobby:update', null);
    });

    // ── Lobby: invite a friend ────────────────────────────────────────────────

    socket.on('lobby:invite', ({ toUserId }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const me = socketUsers.get(socket.id);
      if (!me) { cb({ success: false, error: 'Not registered' }); return; }

      const lobbyId = userLobby.get(me.userId);
      const lobby = lobbyId ? lobbies.get(lobbyId) : null;
      if (!lobby) { cb({ success: false, error: 'Not in a lobby' }); return; }
      if (lobby.hostUserId !== me.userId) { cb({ success: false, error: 'Only the host can invite' }); return; }
      if (lobby.members.size >= 4) { cb({ success: false, error: 'Lobby is full' }); return; }
      if (lobby.members.has(toUserId)) { cb({ success: false, error: 'Already in lobby' }); return; }

      const targetSocketId = userSockets.get(toUserId);
      if (!targetSocketId) { cb({ success: false, error: 'User is offline' }); return; }

      io.to(targetSocketId).emit('lobby:incomingInvite', {
        lobbyId: lobby.id,
        fromUserId: me.userId,
        fromUsername: me.username,
        fromAvatarUrl: me.avatarUrl,
      });

      cb({ success: true });
    });

    // ── Lobby: accept invite ──────────────────────────────────────────────────

    socket.on('lobby:acceptInvite', ({ lobbyId }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const me = socketUsers.get(socket.id);
      if (!me) { cb({ success: false, error: 'Not registered' }); return; }

      const lobby = lobbies.get(lobbyId);
      if (!lobby) { cb({ success: false, error: 'Lobby no longer exists' }); return; }
      if (lobby.members.size >= 4) { cb({ success: false, error: 'Lobby is full' }); return; }

      // Leave any previous lobby first
      if (userLobby.has(me.userId) && userLobby.get(me.userId) !== lobbyId) {
        leaveLobby(io, me.userId);
      }

      lobby.members.set(me.userId, {
        socketId: socket.id, username: me.username, avatarUrl: me.avatarUrl,
      });
      userLobby.set(me.userId, lobby.id);

      broadcastLobby(io, lobby);
      cb({ success: true, lobby: serializeLobby(lobby) });
    });

    // ── Lobby: decline invite ─────────────────────────────────────────────────

    socket.on('lobby:declineInvite', ({ lobbyId, fromUserId }) => {
      const me = socketUsers.get(socket.id);
      if (!me) return;
      const inviterSocketId = userSockets.get(fromUserId);
      if (inviterSocketId) {
        io.to(inviterSocketId).emit('lobby:inviteDeclined', {
          lobbyId, byUserId: me.userId, byUsername: me.username,
        });
      }
    });

    // ── Lobby: start (host kicks off the game) ────────────────────────────────

    socket.on('lobby:start', (_, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const me = socketUsers.get(socket.id);
      if (!me) { cb({ success: false, error: 'Not registered' }); return; }

      const lobbyId = userLobby.get(me.userId);
      const lobby = lobbyId ? lobbies.get(lobbyId) : null;
      if (!lobby) { cb({ success: false, error: 'Not in a lobby' }); return; }
      if (lobby.hostUserId !== me.userId) { cb({ success: false, error: 'Only the host can start' }); return; }
      if (lobby.members.size < 2) { cb({ success: false, error: 'Need at least 2 players' }); return; }

      // Validate all member socket IDs are still connected
      const connectedMembers = [];
      for (const [userId, member] of lobby.members) {
        const socketId = member.socketId;
        const connectedSocket = io.sockets.sockets.get(socketId);
        if (connectedSocket) {
          connectedMembers.push({ userId, member });
        } else {
          console.log(`[lobby] Removing disconnected member ${member.username} (socket ${socketId} not found)`);
        }
      }

      // Update lobby members to only include connected ones
      if (connectedMembers.length < 2) {
        lobby.members.clear();
        for (const { userId, member } of connectedMembers) {
          lobby.members.set(userId, member);
        }
        if (lobby.members.size < 2) {
          cb({ success: false, error: 'Not enough connected players' });
          broadcastLobby(io, lobby);
          return;
        }
        // If host disconnected, promote new host
        if (!lobby.members.has(lobby.hostUserId)) {
          lobby.hostUserId = lobby.members.keys().next().value;
        }
        broadcastLobby(io, lobby);
        return;
      }

      const roomCode = generateRoomCode(rooms);
      const room = new GameRoom(roomCode, null, io);
      room.expectedPlayerCount = lobby.members.size;
      room.matchedUserIds = Array.from(lobby.members.keys());
      rooms.set(roomCode, room);

      // Persist session for stats (fire-and-forget)
      supabase
        .from('game_sessions')
        .insert({ room_code: roomCode, player_count: lobby.members.size, status: 'forming' })
        .select()
        .single()
        .then(({ data }) => { if (data) room.gameSessionId = data.id; });

      // First clear the lobby state on every client (prevents stale "Not in a lobby"
      // errors if matchFound is delayed or the member tries to re-start).
      // Then send matchFound so clients can join the game.
      for (const m of lobby.members.values()) {
        io.to(m.socketId).emit('lobby:update', null);
      }
      for (const m of lobby.members.values()) {
        io.to(m.socketId).emit('matchFound', { roomCode });
      }
      destroyLobby(lobby.id);

      cb({ success: true, roomCode });
    });

    // ── Matchmaking ───────────────────────────────────────────────────────────

    socket.on('findGame', ({ username }) => {
      const userId = socket.data.userId;
      if (!userId) { socket.emit('matchTimeout'); return; }
      // Remove any stale entry from a previous search for this user
      const stale = waitingPlayers.findIndex(p => p.userId === userId);
      if (stale >= 0) removeWaiting(waitingPlayers[stale].socketId);

      const queueTimeout = setTimeout(() => {
        removeWaiting(socket.id);
        socket.emit('matchTimeout');
        console.log(`[matchmaking] ${username} timed out`);
      }, QUEUE_TIMEOUT_MS);

      waitingPlayers.push({ socketId: socket.id, userId, username, queueTimeout });
      console.log(`[matchmaking] ${username} searching… (${waitingPlayers.length} waiting)`);
      tryMatch(rooms, io);
    });

    socket.on('cancelSearch', () => {
      const p = waitingPlayers.find(p => p.socketId === socket.id);
      if (p) {
        removeWaiting(socket.id);
        console.log(`[matchmaking] ${p.username} cancelled search (${waitingPlayers.length} waiting)`);
      }
    });

    // ── Join a matchmade room ─────────────────────────────────────────────────

    socket.on('joinMatchedGame', ({ roomCode, username }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const userId = socket.data.userId;
      if (!userId) { cb({ success: false, error: 'Not authenticated' }); return; }
      const room = rooms.get(roomCode?.toUpperCase());

      if (!room) { cb({ success: false, error: 'Room not found' }); return; }
      // Only players who were actually matched/invited into this room may join.
      if (room.matchedUserIds.length && !room.matchedUserIds.includes(userId)) {
        cb({ success: false, error: 'Not invited to this room' }); return;
      }

      const added = room.addPlayer(socket.id, username, userId);
      if (!added) { cb({ success: false, error: 'Room is full' }); return; }
      socket.join(roomCode.toUpperCase());

      cb({ success: true, playerId: socket.id, isHost: room.players.size === 1 });

      io.to(roomCode.toUpperCase()).emit('lobbyUpdate', {
        players: Array.from(room.players.values()).map(p => ({
          id: p.id, name: p.name, chips: p.chips, isHost: p.isHost,
        })),
      });

      room.onGameOver = (players) => {
        recordGameResult({ gameSessionId: room.gameSessionId, players }).catch(err => {
          console.error('[stats] recordGameResult failed:', err);
        });
      };

      if (room.players.size >= room.expectedPlayerCount) {
        setTimeout(() => {
          if (room.gamePhase === 'waiting') room.startNewHand();
        }, 1500);
      }
    });

    // ── In-game actions ───────────────────────────────────────────────────────

    socket.on('playerAction', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room) return;
      room.playerAction(socket.id, data.action, data.amount);
    });

    socket.on('playerSelectCards', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room) return;
      room.playerSelectCards(socket.id, data.selectedIndices);
    });

    socket.on('playerConfirmDiscard', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room) return;
      room.playerConfirmDiscard(socket.id);
    });

    socket.on('nextHand', (data, callback) => {
      const room = rooms.get(data.roomCode);
      if (!room) { if (typeof callback === 'function') callback({ success: false }); return; }
      const player = room.getPlayer(socket.id);
      if (!player?.isHost) { if (typeof callback === 'function') callback({ success: false }); return; }
      room.startNewHand();
      if (typeof callback === 'function') callback({ success: true });
    });

    socket.on('rejoinGame', ({ roomCode: rc }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const userId = socket.data.userId;
      if (!userId) { cb({ success: false, error: 'Not authenticated' }); return; }
      const roomKey = rc?.toUpperCase();
      const room = rooms.get(roomKey);

      if (!room) { cb({ success: false, error: 'Room not found' }); return; }

      const entry = Array.from(room.players.entries()).find(([, p]) => p.userId === userId);
      if (!entry) { cb({ success: false, error: 'Player not in room' }); return; }

      const [oldSocketId, player] = entry;

      if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
        player.disconnectTimeout = null;
      }
      player.disconnected = false;
      player.id = socket.id;

      // Rebuild Map to preserve insertion order while swapping the key
      const newPlayers = new Map();
      for (const [id, p] of room.players) {
        newPlayers.set(id === oldSocketId ? socket.id : id, p);
      }
      room.players = newPlayers;

      socket.join(roomKey);
      io.to(roomKey).emit('playerRejoined', { playerName: player.name });
      room.broadcastState();

      cb({ success: true, playerId: socket.id, isHost: player.isHost });
      console.log(`[reconnect] ${player.name} rejoined room ${roomKey}`);
    });

    socket.on('leaveRoom', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room) return;

      const leavingName = room.getPlayer(socket.id)?.name ?? 'Opponent';
      const wasActiveGame = room.gamePhase !== 'waiting';

      const isEmpty = room.removePlayer(socket.id);
      socket.leave(data.roomCode);

      if (isEmpty) {
        room.clearAllTimers();
        rooms.delete(data.roomCode);
        return;
      }

      // Always tell remaining players someone left
      io.to(data.roomCode).emit('playerLeft', {
        playerId: socket.id,
        playerName: leavingName,
        playerCount: room.getPlayerCount(),
      });

      if (wasActiveGame && room.getPlayerCount() < 2) {
        // Can't continue — end the game immediately
        room.clearAllTimers();
        setTimeout(() => {
          rooms.delete(data.roomCode);
          io.to(data.roomCode).emit('roomClosed', `${leavingName} left. Game over!`);
        }, 3000);
      } else {
        // Game can continue with remaining players
        room.broadcastState();
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Remove from matchmaking queue if they were waiting
      removeWaiting(socket.id);

      // Drop registry entry + leave any open lobby
      const me = socketUsers.get(socket.id);
      if (me) {
        // Only clear the user registry if this is still the active socket for that user
        if (userSockets.get(me.userId) === socket.id) {
          userSockets.delete(me.userId);
          leaveLobby(io, me.userId);
        }
        socketUsers.delete(socket.id);
      }

      rooms.forEach((room, roomCode) => {
        const player = room.getPlayer(socket.id);
        if (!player) return;

        player.disconnected = true;

        // Auto-confirm draw for disconnected player so the phase doesn't stall
        if (room.gamePhase === 'draw') {
          room.playerConfirmDiscard(socket.id);
        }

        player.disconnectTimeout = setTimeout(() => {
          const playerName = room.getPlayer(socket.id)?.name ?? player.name;
          const wasActiveGame = room.gamePhase !== 'waiting';
          const isEmpty = room.removePlayer(socket.id);

          if (isEmpty) {
            room.clearAllTimers();
            rooms.delete(roomCode);
            io.to(roomCode).emit('roomClosed', 'All players left, room closed.');
          } else if (wasActiveGame && room.getPlayerCount() < 2) {
            // Not enough players to keep playing
            room.clearAllTimers();
            rooms.delete(roomCode);
            io.to(roomCode).emit('roomClosed', `${playerName} never came back. Game over!`);
          } else {
            io.to(roomCode).emit('playerLeft', {
              playerId: socket.id,
              playerName,
              playerCount: room.getPlayerCount(),
            });
            room.broadcastState();
          }
        }, RECONNECT_GRACE_MS);

        io.to(roomCode).emit('playerDisconnected', {
          playerId: socket.id,
          playerName: player.name,
        });
        room.broadcastState();
      });
    });
  });
}

module.exports = { setupSocketHandlers };
