require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { setupSocketHandlers } = require('./socketHandlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const rooms = new Map();
setupSocketHandlers(io, rooms);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown: tell connected clients the server is going down and clear any
// running per-room timers so a deploy/restart doesn't leave games hung.
function shutdown(signal) {
    console.log(`${signal} received — shutting down.`);
    io.emit('roomClosed', 'Server is restarting. Please rejoin in a moment.');
    rooms.forEach(room => room.clearAllTimers?.());
    io.close(() => {
        server.close(() => process.exit(0));
    });
    // Hard exit if connections don't drain promptly.
    setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
