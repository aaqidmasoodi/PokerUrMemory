const { GameRoom } = require('./gameRoom');

// Grace period before a disconnected player is removed from their room (ms)
const RECONNECT_GRACE_MS = 60_000;

function setupSocketHandlers(io, rooms) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // On every new connection, check whether this socket should restore a session
        // The client will emit 'playerReconnect' if it has a stored session.

        socket.on('createRoom', (data, callback) => {
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const room = new GameRoom(roomCode, socket.id, io);
            room.addPlayer(socket.id, data.playerName);
            socket.join(roomCode);
            rooms.set(roomCode, room);

            callback({
                success: true,
                roomCode,
                playerId: socket.id,
                isHost: true,
            });
        });

        socket.on('joinRoom', (data, callback) => {
            const room = rooms.get(data.roomCode);

            if (!room) {
                callback({ success: false, error: 'Room not found' });
                return;
            }

            if (room.getPlayerCount() >= 4) {
                callback({ success: false, error: 'Room is full' });
                return;
            }

            room.addPlayer(socket.id, data.playerName);
            socket.join(data.roomCode);

            callback({
                success: true,
                playerId: socket.id,
                isHost: false,
            });

            io.to(data.roomCode).emit('playerJoined', {
                playerId: socket.id,
                playerName: data.playerName,
                playerCount: room.getPlayerCount(),
            });

            io.to(data.roomCode).emit('lobbyUpdate', {
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    chips: p.chips,
                    isHost: p.isHost,
                })),
            });
        });

        socket.on('startGame', (data, callback) => {
            const room = rooms.get(data.roomCode);
            if (!room) { callback({ success: false, error: 'Room not found' }); return; }

            const player = room.getPlayer(socket.id);
            if (!player || !player.isHost) { callback({ success: false, error: 'Only host can start game' }); return; }

            if (room.getPlayerCount() < 2) { callback({ success: false, error: 'Need at least 2 players' }); return; }

            room.startNewHand();
            callback({ success: true });
        });

        socket.on('getRoomInfo', (data, callback) => {
            const room = rooms.get(data.roomCode);
            if (!room) { callback({ error: 'Room not found' }); return; }

            callback({
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    chips: p.chips,
                    isHost: p.isHost,
                })),
                roomCode: data.roomCode,
            });
        });

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
            if (!room) { callback({ success: false, error: 'Room not found' }); return; }

            const player = room.getPlayer(socket.id);
            if (!player || !player.isHost) { callback({ success: false, error: 'Only host can start next hand' }); return; }

            room.startNewHand();
            callback({ success: true });
        });

        // Reconnection: client sends this after a page refresh if it has a stored session
        socket.on('playerReconnect', (data, callback) => {
            const cb = typeof callback === 'function' ? callback : () => {};
            const room = rooms.get(data.roomCode);

            if (!room) {
                cb({ success: false, error: 'Room not found' });
                return;
            }

            // Find the disconnected player by name
            const existing = Array.from(room.players.values()).find(
                p => p.name === data.playerName && p.disconnected
            );

            if (!existing) {
                cb({ success: false, error: 'No reconnectable slot found' });
                return;
            }

            // Cancel the removal timeout
            if (existing.disconnectTimeout) {
                clearTimeout(existing.disconnectTimeout);
                existing.disconnectTimeout = null;
            }

            // Remap the player to the new socket
            room.players.delete(existing.id);
            existing.id = socket.id;
            existing.disconnected = false;
            room.players.set(socket.id, existing);

            socket.join(data.roomCode);
            room.broadcastState();

            cb({ success: true, isHost: existing.isHost, playerId: socket.id });
            console.log(`Player ${existing.name} reconnected to room ${data.roomCode}`);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);

            rooms.forEach((room, roomCode) => {
                const player = room.getPlayer(socket.id);
                if (!player) return;

                // Mark as disconnected and give a grace period before removing
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
                                id: p.id,
                                name: p.name,
                                chips: p.chips,
                                isHost: p.isHost,
                            })),
                        });
                    }
                }, RECONNECT_GRACE_MS);

                // Notify others that this player is temporarily disconnected
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
