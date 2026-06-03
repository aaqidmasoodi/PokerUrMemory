const { GameRoom } = require('./gameRoom');
const { recordGameResult, recordHand, supabase } = require('./supabase');
const { VALID_DIFFICULTIES } = require('./botPlayer');
const crypto = require('crypto');

// ── In-memory matchmaking queue ───────────────────────────────────────────────
// Each entry: { socketId, userId, username, queueTimeout }
const waitingPlayers = [];
const GATHER_WINDOW_MS = 3000;  // after 2 players found, wait up to 3s for more
const QUEUE_TIMEOUT_MS = 20000; // 20s personal timeout per player
const RECONNECT_GRACE_MS = 60_000; // grace window for a dropped socket to come back
let gatherTimer = null;

// ── User socket registry (for invite routing) ─────────────────────────────────
// Each user has at most one active socket. Re-registering replaces the old one.
const userSockets = new Map();    // userId -> socketId
const socketUsers = new Map();    // socketId -> { userId, username, avatarUrl }

// ── Verified-token cache ───────────────────────────────────────────────────────
// Mobile PWA sockets drop and reconnect constantly, and each reconnect reuses the
// SAME Supabase access token until it refreshes (~1h). Calling supabase.auth.getUser()
// on every handshake means a network round-trip per reconnect — the first thing to
// throttle at scale. Cache the verified userId keyed by token until the token's own
// expiry, so a reconnect with an already-seen token costs nothing.
const tokenCache = new Map();     // token -> { userId, expMs }

// Pull the `exp` claim (seconds) out of a JWT without verifying it — only used to
// bound how long we trust an already-verified token. Returns ms, or 0 if unparseable.
function jwtExpMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// Drop expired entries periodically so the cache can't grow unbounded as tokens rotate.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokenCache) {
    if (entry.expMs <= now) tokenCache.delete(token);
  }
}, 10 * 60 * 1000).unref();

// ── Lobby state ───────────────────────────────────────────────────────────────
// lobby = { id, hostUserId, members: Map<userId, { socketId, username, avatarUrl }>, invites: Set<userId> }
const lobbies = new Map();        // lobbyId -> lobby
const userLobby = new Map();      // userId -> lobbyId
const lobbyLeaveTimers = new Map(); // userId -> timeout (deferred lobby removal on disconnect)

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

// A lobby member's socket dropping (mobile backgrounding, network blip) should NOT
// instantly kick them out — that's why a host would suddenly be told "need more
// players". Defer the removal; a reconnect (auth:register) cancels it.
function cancelLobbyLeave(userId) {
  const t = lobbyLeaveTimers.get(userId);
  if (t) { clearTimeout(t); lobbyLeaveTimers.delete(userId); }
}

function scheduleLobbyLeave(io, userId) {
  if (!userLobby.has(userId)) return;
  cancelLobbyLeave(userId);
  lobbyLeaveTimers.set(userId, setTimeout(() => {
    lobbyLeaveTimers.delete(userId);
    leaveLobby(io, userId);
  }, RECONNECT_GRACE_MS));
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

function setupSocketHandlers(io, rooms) {
  // ── Auth: verify the Supabase access token at the handshake ──────────────────
  // The verified user id is the ONLY source of identity for the socket. Clients can
  // no longer claim to be an arbitrary userId — anything they send is ignored in
  // favour of socket.data.userId derived from the JWT here.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    socket.data.userId = null;
    if (!token) return next(); // allow unauthenticated connection; gated per-event below

    const now = Date.now();
    const cached = tokenCache.get(token);
    if (cached && cached.expMs > now) {
      socket.data.userId = cached.userId; // cache hit — no Supabase round-trip
      return next();
    }

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        socket.data.userId = data.user.id;
        // Only cache when the token carries a sane future expiry to trust against.
        const expMs = jwtExpMs(token);
        if (expMs > now) tokenCache.set(token, { userId: data.user.id, expMs });
      }
    } catch (err) {
      console.error('[auth] token verification failed:', err?.message ?? err);
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id, socket.data.userId ? '(authenticated)' : '(anonymous)');

    // ── User registration (for invite routing) ────────────────────────────────

    socket.on('auth:register', async ({ username, avatarUrl }) => {
      // Identity is the verified token's user id — never the client-supplied value.
      // If the handshake verification failed (Render cold start, network hiccup during
      // middleware), socket.data.userId will be null. Re-attempt with the same handshake
      // token so the user doesn't have to reconnect.
      let userId = socket.data.userId;
      if (!userId) {
        const token = socket.handshake.auth?.token;
        if (token) {
          const now = Date.now();
          const cached = tokenCache.get(token);
          if (cached && cached.expMs > now) {
            userId = socket.data.userId = cached.userId;
          } else {
            try {
              const { data, error } = await supabase.auth.getUser(token);
              if (!error && data?.user) {
                userId = socket.data.userId = data.user.id;
                const expMs = jwtExpMs(token);
                if (expMs > now) tokenCache.set(token, { userId, expMs });
              }
            } catch {}
          }
        }
      }
      if (!userId || !username) return;

      // If this user had another live socket, evict it from the registry.
      // (Don't disconnect it — they may be on two tabs, the older tab just loses invite routing.)
      const prevSocketId = userSockets.get(userId);
      if (prevSocketId && prevSocketId !== socket.id) {
        socketUsers.delete(prevSocketId);
      }

      userSockets.set(userId, socket.id);
      socketUsers.set(socket.id, { userId, username, avatarUrl: avatarUrl ?? null });

      // They're back — cancel any pending lobby removal from a brief disconnect.
      cancelLobbyLeave(userId);

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
      cancelLobbyLeave(me.userId);
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

    // ── Scheduled game: host launches the table ───────────────────────────────

    socket.on('scheduled:start', async ({ gameId }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const me = socketUsers.get(socket.id);
      if (!me) { cb({ success: false, error: 'Not registered' }); return; }

      try {
        const { data: game, error: gErr } = await supabase
          .from('scheduled_games')
          .select('*')
          .eq('id', gameId)
          .eq('status', 'open')
          .single();

        if (gErr || !game) { cb({ success: false, error: 'Game not found or already started' }); return; }
        if (game.host_id !== me.userId) { cb({ success: false, error: 'Only the host can start' }); return; }

        // Allow launching up to 5 min early to handle clock drift / eager hosts
        const scheduledAt = new Date(game.scheduled_at).getTime();
        if (scheduledAt > Date.now() + 5 * 60 * 1000) {
          cb({ success: false, error: 'Too early — wait until the scheduled time' }); return;
        }

        const { data: reservations } = await supabase
          .from('scheduled_game_reservations')
          .select('user_id, username, avatar_url')
          .eq('game_id', gameId);

        // Only include players who are online right now
        const connectedPlayers = [];
        for (const r of (reservations || [])) {
          const sid = userSockets.get(r.user_id);
          if (sid && io.sockets.sockets.get(sid)) {
            connectedPlayers.push({ userId: r.user_id, socketId: sid, username: r.username });
          }
        }

        // Need at least host + 1 other online
        if (connectedPlayers.length < 2) {
          cb({ success: false, error: 'Need at least 2 players online to start' }); return;
        }

        const JOIN_WINDOW_SECS = 60;
        const roomCode = generateRoomCode(rooms);
        const room = new GameRoom(roomCode, null, io);
        // expectedPlayerCount = all online reserved players (the waiting-room target).
        // The host starts manually once ≥2 are in; the join window is the auto-start fallback.
        room.expectedPlayerCount = connectedPlayers.length;
        room.matchedUserIds = connectedPlayers.map(p => p.userId);
        room.invitedPlayers = connectedPlayers.map(p => ({ userId: p.userId, name: p.username }));
        room.manualStart = true;
        room.joinDeadline = Date.now() + JOIN_WINDOW_SECS * 1000;
        rooms.set(roomCode, room);

        // Persist session for stats (fire-and-forget)
        supabase
          .from('game_sessions')
          .insert({ room_code: roomCode, player_count: connectedPlayers.length, status: 'forming' })
          .select().single()
          .then(({ data }) => { if (data) room.gameSessionId = data.id; });

        // Mark the scheduled slot as live so it disappears from the lobby list
        supabase
          .from('scheduled_games')
          .update({ status: 'live', room_code: roomCode })
          .eq('id', gameId)
          .then(() => {});

        // After the join window, start with whoever showed up (≥2) or close the room
        room.joinWindowTimer = setTimeout(() => {
          room.joinWindowTimer = null;
          if (room.gamePhase !== 'waiting') return; // already started via count-based path
          if (room.players.size >= 2) {
            console.log(`[scheduled] join window closed — starting ${roomCode} with ${room.players.size} players`);
            room.startNewHand();
          } else {
            console.log(`[scheduled] join window closed — not enough players, closing ${roomCode}`);
            io.to(roomCode).emit('roomClosed', 'Not enough players joined in time');
            rooms.delete(roomCode);
          }
        }, JOIN_WINDOW_SECS * 1000);

        // Host joins immediately — they initiated the launch
        io.to(socket.id).emit('matchFound', { roomCode });

        // All other online reserved players get an invite notification
        for (const p of connectedPlayers) {
          if (p.userId === me.userId) continue;
          io.to(p.socketId).emit('scheduled:gameReady', {
            roomCode,
            hostName: me.username,
            gameId,
            joinWindowSecs: JOIN_WINDOW_SECS,
          });
        }

        console.log(`[scheduled] ${me.username} launched ${gameId} → ${roomCode} (${connectedPlayers.length} online)`);
        cb({ success: true, roomCode });
      } catch (err) {
        console.error('[scheduled:start] error', err);
        cb({ success: false, error: 'Server error' });
      }
    });

    // ── Scheduled game: reserved player accepts the join invite ──────────────

    socket.on('scheduled:accept', ({ roomCode }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const me = socketUsers.get(socket.id);
      if (!me) { cb({ success: false, error: 'Not registered' }); return; }

      const rc = roomCode?.toUpperCase();
      const room = rooms.get(rc);
      if (!room) { cb({ success: false, error: 'This game has already closed' }); return; }
      if (!room.matchedUserIds.includes(me.userId)) { cb({ success: false, error: 'You were not invited to this game' }); return; }
      if (room.getPlayerCount() >= 4) { cb({ success: false, error: 'This table is full' }); return; }

      // Reject if still mid-game in a *different* room (client should "Leave & Join" first).
      const alreadyInGame = [...socket.rooms]
        .filter(r => r !== socket.id && r !== rc)
        .some(r => rooms.has(r) && rooms.get(r).gamePhase !== 'waiting');
      if (alreadyInGame) { cb({ success: false, error: 'Finish your current game first' }); return; }

      // Reuse the existing matchFound → joinMatchedGame pipeline. If the hand has
      // already started, joinMatchedGame seats them as a sit-out until the next deal.
      socket.emit('matchFound', { roomCode: rc });
      cb({ success: true });
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

    // ── Practice: start a game against computer players ───────────────────────

    socket.on('practice:start', (payload, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const userId = socket.data.userId;
      if (!userId) { cb({ success: false, error: 'Not authenticated' }); return; }

      // 1–3 bots → a 2–4 seat table (mirrors the human game's max of 4).
      const requested = Number(payload && payload.bots);
      const botCount = Math.max(1, Math.min(3, Number.isFinite(requested) ? requested : 1));

      // Difficulty drives the bot heuristic; fall back to medium on anything unknown.
      const reqDiff = payload && payload.difficulty;
      const difficulty = VALID_DIFFICULTIES.includes(reqDiff) ? reqDiff : 'medium';

      const roomCode = generateRoomCode(rooms);
      const room = new GameRoom(roomCode, null, io);
      room.isPractice = true;
      room.expectedPlayerCount = botCount + 1; // bots + the human
      room.matchedUserIds = [userId];          // only this user may join

      // Exactly three bot identities — shuffled so seat order is random,
      // then sliced to botCount. All assigned names are always unique.
      const BOT_NAMES = ['PokerSolitaire', 'PokerPatience', 'PokerAA88'];
      const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < botCount; i++) room.addBot(names[i], difficulty);

      rooms.set(roomCode, room);

      // Reuse the standard matchFound → joinMatchedGame pipeline. Once the human
      // joins, players.size hits expectedPlayerCount and the hand auto-starts.
      io.to(socket.id).emit('matchFound', { roomCode });
      console.log(`[practice] ${userId} vs ${botCount} ${difficulty} bot(s) → room ${roomCode}`);
      cb({ success: true, roomCode });
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

      // A player joining while a hand is already running sits out until the next deal.
      const joinsMidGame = room.gamePhase !== 'waiting';
      const added = room.addPlayer(socket.id, username, userId, joinsMidGame);
      if (!added) { cb({ success: false, error: 'Room is full' }); return; }
      socket.join(roomCode.toUpperCase());

      cb({ success: true, playerId: socket.id, isHost: room.players.size === 1 });

      io.to(roomCode.toUpperCase()).emit('lobbyUpdate', {
        players: Array.from(room.players.values()).map(p => ({
          id: p.id, name: p.name, chips: p.chips, isHost: p.isHost,
        })),
      });

      // Practice games are solo training vs bots — never recorded to stats and
      // never tied to a scheduled-game slot. On finish, just drop the room so it
      // doesn't linger in the map (bots never disconnect to trigger cleanup).
      if (room.isPractice) {
        room.onGameOver = () => { rooms.delete(roomCode.toUpperCase()); };
      } else {
        room.onGameOver = (players) => {
          recordGameResult({ gameSessionId: room.gameSessionId, players }).catch(err => {
            console.error('[stats] recordGameResult failed:', err);
          });
          // Free up the host's scheduling slot so they can book new games.
          supabase
            .from('scheduled_games')
            .update({ status: 'completed' })
            .eq('room_code', roomCode.toUpperCase())
            .eq('status', 'live')
            .then(() => {});
        };

        room.onHandComplete = (snapshot) => {
          recordHand({ gameSessionId: room.gameSessionId, ...snapshot }).catch(err => {
            console.error('[stats] recordHand failed:', err);
          });
        };
      }

      if (joinsMidGame) {
        // Show the spectator the live table; they'll be dealt in next hand.
        room.broadcastState();
      } else if (room.manualStart) {
        // Scheduled game — sit in the waiting room until the host starts.
        room.broadcastWaitingRoom();
      } else if (room.players.size >= room.expectedPlayerCount) {
        // Matchmade / lobby game — auto-start once everyone expected has joined.
        setTimeout(() => {
          if (room.gamePhase === 'waiting') room.startNewHand();
        }, 1500);
      }
    });

    // ── Scheduled game: host starts the table manually ──────────────────────────

    socket.on('scheduled:beginNow', (_, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      // Find the room this socket is sitting in (waiting phase, manual start).
      let room = null, rc = null;
      for (const r of socket.rooms) {
        if (r === socket.id) continue;
        const candidate = rooms.get(r);
        if (candidate && candidate.manualStart) { room = candidate; rc = r; break; }
      }
      if (!room) { cb({ success: false, error: 'Waiting room not found' }); return; }
      if (room.gamePhase !== 'waiting') { cb({ success: false, error: 'Game already started' }); return; }

      const me = room.getPlayer(socket.id);
      if (!me || !me.isHost) { cb({ success: false, error: 'Only the host can start' }); return; }
      if (room.getPlayerCount() < 2) { cb({ success: false, error: 'Need at least 2 players' }); return; }

      if (room.joinWindowTimer) { clearTimeout(room.joinWindowTimer); room.joinWindowTimer = null; }
      console.log(`[scheduled] host started ${rc} with ${room.getPlayerCount()} players`);
      room.startNewHand();
      cb({ success: true });
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

    socket.on('rejoinGame', ({ roomCode: rc }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const userId = socket.data.userId;
      if (!userId) { cb({ success: false, error: 'Not authenticated' }); return; }
      const roomKey = rc?.toUpperCase();
      const room = rooms.get(roomKey);

      if (!room) { cb({ success: false, error: 'Room not found' }); return; }

      // Match by verified userId. Prefer a disconnected seat (the one actually
      // waiting to be reclaimed) over a still-connected one.
      const entries = Array.from(room.players.entries()).filter(([, p]) => p.userId === userId);
      const entry = entries.find(([, p]) => p.disconnected) ?? entries[0];
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

      // A practice table belongs to its single human. The moment they leave, tear
      // the whole room down — the remaining seats are only bots.
      if (room.isPractice) {
        room.clearAllTimers();
        rooms.delete(data.roomCode);
        return;
      }

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
      } else if (!wasActiveGame && room.manualStart) {
        // Still in the pre-game waiting room — refresh the seat list.
        room.broadcastWaitingRoom();
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
          // Don't kick them out of the lobby instantly — mobile sockets drop and
          // reconnect all the time. Defer it; auth:register cancels on return.
          scheduleLobbyLeave(io, me.userId);
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

          // Practice room: the human didn't come back within the grace window, so
          // close the whole table (bots must never outlive their human).
          if (room.isPractice) {
            room.clearAllTimers();
            rooms.delete(roomCode);
            return;
          }

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
            if (room.manualStart && room.gamePhase === 'waiting') room.broadcastWaitingRoom();
            else room.broadcastState();
          }
        }, RECONNECT_GRACE_MS);

        io.to(roomCode).emit('playerDisconnected', {
          playerId: socket.id,
          playerName: player.name,
        });
        if (room.manualStart && room.gamePhase === 'waiting') room.broadcastWaitingRoom();
        else room.broadcastState();
      });
    });
  });
}

module.exports = { setupSocketHandlers };
