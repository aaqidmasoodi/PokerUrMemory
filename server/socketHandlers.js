const { GameRoom } = require('./gameRoom');
const { recordGameResult, supabase } = require('./supabase');

// ── In-memory matchmaking queue ───────────────────────────────────────────────
// Each entry: { socketId, userId, username, queueTimeout }
const waitingPlayers = [];
const GATHER_WINDOW_MS = 3000;  // after 2 players found, wait up to 3s for more
const QUEUE_TIMEOUT_MS = 20000; // 20s personal timeout per player
let gatherTimer = null;

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
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ── Matchmaking ───────────────────────────────────────────────────────────

    socket.on('findGame', ({ userId, username }) => {
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

    socket.on('joinMatchedGame', ({ roomCode, userId, username }, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      const room = rooms.get(roomCode?.toUpperCase());

      if (!room) { cb({ success: false, error: 'Room not found' }); return; }
      if (room.players.size >= 4) { cb({ success: false, error: 'Room is full' }); return; }

      room.addPlayer(socket.id, username, userId);
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

    socket.on('leaveRoom', (data) => {
      const room = rooms.get(data.roomCode);
      if (!room) return;
      const isEmpty = room.removePlayer(socket.id);
      socket.leave(data.roomCode);
      if (isEmpty) {
        room.clearAllTimers();
        rooms.delete(data.roomCode);
      } else {
        io.to(data.roomCode).emit('lobbyUpdate', {
          players: Array.from(room.players.values()).map(p => ({
            id: p.id, name: p.name, chips: p.chips, isHost: p.isHost,
          })),
        });
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Remove from matchmaking queue if they were waiting
      removeWaiting(socket.id);

      rooms.forEach((room, roomCode) => {
        const player = room.getPlayer(socket.id);
        if (!player) return;

        player.disconnected = true;
        player.disconnectTimeout = setTimeout(() => {
          const isEmpty = room.removePlayer(socket.id);
          if (isEmpty) {
            room.clearAllTimers();
            rooms.delete(roomCode);
            io.to(roomCode).emit('roomClosed', 'All players left, room closed.');
          } else {
            io.to(roomCode).emit('playerLeft', {
              playerId: socket.id,
              playerCount: room.getPlayerCount(),
            });
            io.to(roomCode).emit('lobbyUpdate', {
              players: Array.from(room.players.values()).map(p => ({
                id: p.id, name: p.name, chips: p.chips, isHost: p.isHost,
              })),
            });
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
