const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const HAND_RANKS = [
    'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'
];

const rooms = new Map();

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value, faceUp: false, isHidden: false });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

class GameRoom {
    constructor(roomCode, hostId) {
        this.roomCode = roomCode;
        this.hostId = hostId;
        this.players = new Map();
        this.deck = [];
        this.pot = 0;
        this.currentBet = 0;
        this.currentPlayerIndex = 0;
        this.gamePhase = 'waiting';
        this.isDrawPhase = false;
        this.playersActedThisRound = 0;
        this.revealTimer = null;
        this.revealTimeLeft = 0;
        this.selectedCards = new Map();
        this.tempRevealCards = [];
    }

    addPlayer(socketId, name) {
        if (this.players.size >= 4) return false;
        this.players.set(socketId, {
            id: socketId,
            name: name,
            chips: 100,
            hand: [],
            currentBet: 0,
            folded: false,
            isAllIn: false,
            isHost: this.players.size === 0
        });
        return true;
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
        if (this.players.size === 0) {
            return true;
        }
        return false;
    }

    getPlayer(socketId) {
        return this.players.get(socketId);
    }

    getPlayerByIndex(index) {
        const playerArray = Array.from(this.players.values());
        return playerArray[index];
    }

    getPlayerIndex(socketId) {
        const playerArray = Array.from(this.players.keys());
        return playerArray.indexOf(socketId);
    }

    getPlayerCount() {
        return this.players.size;
    }

    startNewHand() {
        this.deck = createDeck();
        this.pot = 0;
        this.currentBet = 0;
        this.currentPlayerIndex = 0;
        this.gamePhase = 'memoryReveal';
        this.isDrawPhase = false;
        this.playersActedThisRound = 0;
        this.selectedCards.clear();
        this.tempRevealCards = [];

        this.players.forEach(player => {
            player.hand = [];
            player.currentBet = 0;
            player.folded = false;
            player.isAllIn = false;
        });

        this.dealInitialCards();
    }

    dealInitialCards() {
        this.players.forEach((player, id) => {
            for (let i = 0; i < 4; i++) {
                const card = this.deck.pop();
                card.faceUp = true;
                card.isInitiallyFaceUp = true;
                player.hand.push(card);
            }
            const hiddenCard = this.deck.pop();
            hiddenCard.faceUp = false;
            hiddenCard.isInitiallyHidden = true;
            player.hand.push(hiddenCard);
        });

        this.broadcastState();
        this.startMemoryRevealTimer();
    }

    startMemoryRevealTimer() {
        this.revealTimeLeft = 20;
        io.to(this.roomCode).emit('timerUpdate', this.revealTimeLeft);

        this.revealTimer = setInterval(() => {
            this.revealTimeLeft--;
            io.to(this.roomCode).emit('timerUpdate', this.revealTimeLeft);

            if (this.revealTimeLeft <= 0) {
                clearInterval(this.revealTimer);
                this.endMemoryRevealPhase();
            }
        }, 1000);
    }

    endMemoryRevealPhase() {
        this.gamePhase = 'firstBetting';
        this.playersActedThisRound = 0;
        
        const playerArray = Array.from(this.players.values());
        this.currentPlayerIndex = Math.floor(Math.random() * playerArray.length);

        this.players.forEach((player, id) => {
            player.hand.forEach(card => {
                card.faceUp = false;
            });
        });

        this.broadcastState();
        this.notifyCurrentPlayer();
        
        const allPlayers = Array.from(this.players.values());
        allPlayers.forEach(player => {
            io.to(player.id).emit('actionLog', 'Time up! Your cards remain visible. Opponent cards are now hidden. Betting begins!');
        });
    }

    getPlayerPublicState(socketId, forPlayerId) {
        const player = this.players.get(socketId);
        if (!player) return null;

        const isSamePlayer = socketId === forPlayerId;
        
        return {
            id: player.id,
            name: player.name,
            chips: player.chips,
            currentBet: player.currentBet,
            folded: player.folded,
            isAllIn: player.isAllIn,
            isHost: player.isHost,
            isCurrentTurn: this.getPlayerIndex(socketId) === this.currentPlayerIndex && 
                          this.gamePhase !== 'memoryReveal' &&
                          this.gamePhase !== 'waiting',
            hand: player.hand.map((card, i) => {
                let showCard = false;
                
                // Showdown: show all cards
                if (this.gamePhase === 'showdown') {
                    showCard = true;
                }
                // Memory Reveal phase: show own cards, show opponent's initially face-up
                else if (this.gamePhase === 'memoryReveal') {
                    if (isSamePlayer) {
                        showCard = true;
                    } else {
                        showCard = card.isInitiallyFaceUp === true;
                    }
                }
                // Draw phase: show own cards
                else if (this.gamePhase === 'draw' || this.gamePhase === 'drawReveal') {
                    if (isSamePlayer) {
                        showCard = true;
                    } else if (this.gamePhase === 'drawReveal') {
                        // During reveal, show the face-up card
                        const replacementData = this.drawSelections?.get(player.id);
                        if (replacementData?.faceUpCard === card) {
                            showCard = true;
                        }
                    }
                }
                // After memory reveal: show own cards only
                else if (this.gamePhase === 'firstBetting' || this.gamePhase === 'secondBetting') {
                    if (isSamePlayer) {
                        showCard = true;
                    }
                }
                
                return {
                    ...card,
                    value: showCard ? card.value : null,
                    suit: showCard ? card.suit : null,
                    isInitiallyFaceUp: undefined,
                    isInitiallyHidden: undefined
                };
            })
        };
    }

    broadcastState() {
        this.players.forEach((player, id) => {
            const playersData = Array.from(this.players.keys()).map(socketId => {
                return this.getPlayerPublicState(socketId, id);
            });

            io.to(id).emit('gameState', {
                roomCode: this.roomCode,
                pot: this.pot,
                currentBet: this.currentBet,
                phase: this.gamePhase,
                currentPlayerIndex: this.getPlayerIndex(this.players.get(id)?.id || 0),
                players: playersData,
                timeLeft: this.revealTimeLeft
            });
        });
    }

    getActivePlayers() {
        return Array.from(this.players.values()).filter(p => !p.folded);
    }

    playerAction(socketId, action, amount = 0) {
        const player = this.players.get(socketId);
        if (!player) return;

        const playerIndex = this.getPlayerIndex(socketId);
        if (playerIndex !== this.currentPlayerIndex) return;

        this.playersActedThisRound++;

        switch (action) {
            case 'check':
                io.to(this.roomCode).emit('actionLog', `${player.name} checks.`);
                this.nextPlayer();
                break;
            case 'bet':
                const betAmount = Math.min(amount, player.chips);
                if (betAmount < 1) return;
                player.chips -= betAmount;
                player.currentBet += betAmount;
                this.pot += betAmount;
                this.currentBet = Math.max(this.currentBet, player.currentBet);
                io.to(this.roomCode).emit('actionLog', `${player.name} bets $${betAmount}.`);
                this.nextPlayer();
                break;
            case 'call':
                const callAmount = this.currentBet - player.currentBet;
                player.chips -= callAmount;
                player.currentBet += callAmount;
                this.pot += callAmount;
                io.to(this.roomCode).emit('actionLog', `${player.name} calls $${callAmount}.`);
                this.nextPlayer();
                break;
            case 'raise':
                const raiseAmount = Math.min(amount, player.chips);
                if (raiseAmount < 1) return;
                player.chips -= raiseAmount;
                player.currentBet += raiseAmount;
                this.pot += raiseAmount;
                this.currentBet = Math.max(this.currentBet, player.currentBet);
                io.to(this.roomCode).emit('actionLog', `${player.name} raises to $${raiseAmount}.`);
                this.nextPlayer();
                break;
            case 'fold':
                player.folded = true;
                io.to(this.roomCode).emit('actionLog', `${player.name} folds.`);
                
                const activePlayers = this.getActivePlayers();
                if (activePlayers.length === 1) {
                    this.handleSinglePlayerLeft(activePlayers[0]);
                } else {
                    this.nextPlayer();
                }
                break;
            case 'allIn':
                const allInAmount = player.chips;
                player.chips = 0;
                player.currentBet += allInAmount;
                player.isAllIn = true;
                this.pot += allInAmount;
                this.currentBet = Math.max(this.currentBet, player.currentBet);
                io.to(this.roomCode).emit('actionLog', `${player.name} goes ALL IN for $${allInAmount}!`);
                this.nextPlayer();
                break;
        }
    }

    nextPlayer() {
        const playerArray = Array.from(this.players.keys());
        let attempts = 0;
        
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.size;
            attempts++;
        } while (attempts < this.players.size && this.players.get(playerArray[this.currentPlayerIndex])?.folded);

        if (this.shouldEndBettingRound()) {
            this.endBettingRound();
            return;
        }

        this.broadcastState();
        this.notifyCurrentPlayer();
    }

    shouldEndBettingRound() {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length <= 1) return true;
        
        if (this.playersActedThisRound >= activePlayers.length) {
            if (this.currentBet === 0) return true; // Everyone checked
            return activePlayers.every(p => p.currentBet === this.currentBet || p.isAllIn);
        }

        return false;
    }

    endBettingRound() {
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length === 1) {
            this.handleSinglePlayerLeft(activePlayers[0]);
            return;
        }

        const highestBettor = activePlayers.reduce((a, b) => a.currentBet > b.currentBet ? a : b);
        
        const allCalled = activePlayers.every(p => p.currentBet === highestBettor.currentBet);
        
        if (!allCalled) {
            this.showBluffWin(highestBettor);
            return;
        }

        if (!this.isDrawPhase) {
            this.startDrawPhase();
        } else {
            this.startShowdown();
        }
    }

    handleSinglePlayerLeft(winner) {
        this.showBluffWin(winner);
    }

    showBluffWin(winner) {
        winner.chips += this.pot;
        io.to(this.roomCode).emit('actionLog', `${winner.name} wins $${this.pot}!`);
        io.to(this.roomCode).emit('bluffWin', {
            winner: winner.name,
            amount: this.pot
        });
        this.pot = 0;
        this.gamePhase = 'showdown';
        this.broadcastState();
        setTimeout(() => this.broadcastLeaderboard(), 100);
        setTimeout(() => this.startNewHand(), 5000);
    }

    broadcastLeaderboard() {
        const leaderboard = Array.from(this.players.values())
            .map(p => ({ name: p.name, chips: p.chips }))
            .sort((a, b) => b.chips - a.chips);
        io.to(this.roomCode).emit('leaderboard', leaderboard);
    }

    startDrawPhase() {
        this.isDrawPhase = true;
        this.currentBet = 0;
        
        this.players.forEach(p => {
            p.currentBet = 0;
            p.hand.forEach(card => card.faceUp = false);
        });

        this.gamePhase = 'draw';
        this.drawTimer = 20;
        this.drawSelections = new Map();
        this.playersConfirmed = new Set();
        
        io.to(this.roomCode).emit('drawPhaseStart', { timer: this.drawTimer });
        this.broadcastState();
        
        this.drawTimerInterval = setInterval(() => {
            this.drawTimer--;
            io.to(this.roomCode).emit('timerUpdate', this.drawTimer);
            
            if (this.drawTimer <= 0) {
                clearInterval(this.drawTimerInterval);
                this.endDrawPhaseNoDiscard();
            }
        }, 1000);
    }

    playerSelectCards(socketId, selectedIndices) {
        if (this.gamePhase !== 'draw') return;
        this.drawSelections.set(socketId, selectedIndices);
    }

    playerConfirmDiscard(socketId) {
        if (this.gamePhase !== 'draw') return;
        if (this.playersConfirmed.has(socketId)) return;
        
        this.playersConfirmed.add(socketId);
        
        const activePlayers = this.getActivePlayers();
        if (this.playersConfirmed.size === activePlayers.length) {
            clearInterval(this.drawTimerInterval);
            this.processAllDiscards();
        }
    }

    processAllDiscards() {
        this.getActivePlayers().forEach((player) => {
            const socketId = player.id;
            const selectedIndices = this.drawSelections.get(socketId) || [];
            const discardCount = selectedIndices.length;
            const newCards = [];

            for (let i = 0; i < discardCount; i++) {
                newCards.push(this.deck.pop());
            }

            const sortedIndices = selectedIndices.sort((a, b) => b - a);
            sortedIndices.forEach(index => {
                player.hand.splice(index, 1);
            });

            player.hand.push(...newCards);

            let faceUpCard = null;
            if (discardCount > 0) {
                newCards.forEach((card, i) => {
                    if (i === 0 && discardCount > 1) {
                        card.faceUp = true;
                        faceUpCard = card;
                    } else {
                        card.faceUp = false;
                    }
                });
            }

            io.to(this.roomCode).emit('actionLog', `${player.name} discards ${discardCount} card(s).`);
            
            this.drawSelections.set(socketId, { newCards, faceUpCard, playerName: player.name });
        });

        this.showReplacementCards();
    }

    showReplacementCards() {
        this.gamePhase = 'drawReveal';
        this.revealTimer = 10;
        
        this.drawSelections.forEach((data, playerId) => {
            if (data.faceUpCard) {
                data.faceUpCard.faceUp = true;
            }
        });

        io.to(this.roomCode).emit('drawRevealStart', { 
            timer: this.revealTimer,
            replacements: Array.from(this.drawSelections.entries()).map(([id, data]) => ({
                playerId: id,
                playerName: data.playerName,
                faceUpCard: data.faceUpCard
            }))
        });
        
        this.broadcastState();

        this.revealTimerInterval = setInterval(() => {
            this.revealTimer--;
            io.to(this.roomCode).emit('timerUpdate', this.revealTimer);
            
            if (this.revealTimer <= 0) {
                clearInterval(this.revealTimerInterval);
                this.endDrawPhase();
            }
        }, 1000);
    }

    endDrawPhase() {
        this.drawSelections.forEach((data, playerId) => {
            if (data.newCards) {
                data.newCards.forEach(card => card.faceUp = false);
            }
        });

        io.to(this.roomCode).emit('actionLog', 'Draw phase complete. Second betting begins.');
        
        this.gamePhase = 'secondBetting';
        this.currentPlayerIndex = Math.floor(Math.random() * this.players.size);
        this.players.forEach(p => p.currentBet = 0);
        this.playersActedThisRound = 0;
        
        this.broadcastState();
        this.notifyCurrentPlayer();
    }

    endDrawPhaseNoDiscard() {
        io.to(this.roomCode).emit('actionLog', 'Draw phase ended. No discards made.');
        
        this.gamePhase = 'secondBetting';
        this.currentPlayerIndex = Math.floor(Math.random() * this.players.size);
        this.players.forEach(p => p.currentBet = 0);
        this.playersActedThisRound = 0;
        
        this.broadcastState();
        this.notifyCurrentPlayer();
    }

    notifyCurrentPlayer() {
        const playerArray = Array.from(this.players.values());
        const currentPlayer = playerArray[this.currentPlayerIndex];
        if (currentPlayer) {
            io.to(currentPlayer.id).emit('yourTurnNotification', { 
                message: 'YOUR TURN!',
                phase: this.gamePhase
            });
            const maxBetAmount = currentPlayer.chips;
            let canRaise = false;
            if (this.currentBet === 0) {
                canRaise = currentPlayer.chips > 0;
            } else {
                canRaise = currentPlayer.currentBet < this.currentBet && !currentPlayer.isAllIn;
            }
            
            io.to(currentPlayer.id).emit('yourTurn', {
                canCheck: this.currentBet === 0,
                canCall: this.currentBet > 0 && currentPlayer.currentBet < this.currentBet && !currentPlayer.isAllIn,
                canRaise: canRaise,
                currentBet: this.currentBet,
                playerBet: currentPlayer.currentBet,
                minRaise: this.currentBet > 0 ? Math.min(this.currentBet * 2, maxBetAmount) : Math.min(10, maxBetAmount),
                maxBet: maxBetAmount,
                minBet: this.currentBet > 0 ? Math.min(this.currentBet + 1, maxBetAmount) : Math.min(10, maxBetAmount)
            });
        }
    }

    startShowdown() {
        this.gamePhase = 'showdown';
        
        this.players.forEach((player, id) => {
            player.hand.forEach(card => {
                card.faceUp = true;
            });
        });

        const activePlayers = this.getActivePlayers();
        const hands = activePlayers.map(player => ({
            playerId: player.id,
            playerName: player.name,
            hand: player.hand,
            result: this.evaluateHand(player.hand)
        }));

        hands.sort((a, b) => b.result.rank - a.result.rank || this.compareTieBreakers(a.result, b.result));
        
        const winner = hands[0];
        const winnerPlayer = this.players.get(winner.playerId);
        if (winnerPlayer) {
            winnerPlayer.chips += this.pot;
        }

        io.to(this.roomCode).emit('showdown', {
            hands: hands.map(h => ({
                playerId: h.playerId,
                playerName: h.playerName,
                hand: h.hand,
                rankName: h.result.rankName
            })),
            winner: {
                playerId: winner.playerId,
                playerName: winner.playerName,
                rankName: winner.result.rankName
            },
            pot: this.pot
        });

        this.pot = 0;
        this.broadcastState();
        setTimeout(() => this.broadcastLeaderboard(), 100);
        setTimeout(() => this.startNewHand(), 7000);
    }

    evaluateHand(cards) {
        const sorted = [...cards].sort((a, b) => VALUES.indexOf(b.value) - VALUES.indexOf(a.value));
        const values = sorted.map(c => VALUES.indexOf(c.value));
        const suits = sorted.map(c => c.suit);

        const valueCounts = {};
        values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
        const counts = Object.values(valueCounts).sort((a, b) => b - a);

        const isFlush = suits.every(s => s === suits[0]);
        const isStraight = values.every((v, i) => i === 0 || v === values[i-1] - 1);
        const isStraightFlush = isFlush && isStraight;
        const isRoyal = isStraightFlush && values[0] === 12;

        if (isRoyal) return { rank: 9, rankName: 'Royal Flush', tieBreakers: values };
        if (isStraightFlush) return { rank: 8, rankName: 'Straight Flush', tieBreakers: values };
        if (counts[0] === 4) return { rank: 7, rankName: 'Four of a Kind', tieBreakers: values };
        if (counts[0] === 3 && counts[1] === 2) return { rank: 6, rankName: 'Full House', tieBreakers: values };
        if (isFlush) return { rank: 5, rankName: 'Flush', tieBreakers: values };
        if (isStraight) return { rank: 4, rankName: 'Straight', tieBreakers: values };
        if (counts[0] === 3) return { rank: 3, rankName: 'Three of a Kind', tieBreakers: values };
        if (counts[0] === 2 && counts[1] === 2) return { rank: 2, rankName: 'Two Pair', tieBreakers: values };
        if (counts[0] === 2) return { rank: 1, rankName: 'Pair', tieBreakers: values };
        return { rank: 0, rankName: 'High Card', tieBreakers: values };
    }

    compareTieBreakers(a, b) {
        for (let i = 0; i < Math.min(a.tieBreakers.length, b.tieBreakers.length); i++) {
            if (a.tieBreakers[i] !== b.tieBreakers[i]) {
                return b.tieBreakers[i] - a.tieBreakers[i];
            }
        }
        return 0;
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (data, callback) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = new GameRoom(roomCode, socket.id);
        room.addPlayer(socket.id, data.playerName);
        socket.join(roomCode);
        
        rooms.set(roomCode, room);
        
        callback({ 
            success: true, 
            roomCode: roomCode,
            playerId: socket.id,
            isHost: true
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
            isHost: false
        });

        io.to(data.roomCode).emit('playerJoined', {
            playerId: socket.id,
            playerName: data.playerName,
            playerCount: room.getPlayerCount()
        });

        const playersList = Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            chips: p.chips,
            isHost: p.isHost
        }));
        
        io.to(data.roomCode).emit('lobbyUpdate', { players: playersList });
    });

    socket.on('startGame', (data, callback) => {
        const room = rooms.get(data.roomCode);
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        const player = room.getPlayer(socket.id);
        if (!player || !player.isHost) {
            callback({ success: false, error: 'Only host can start game' });
            return;
        }

        if (room.getPlayerCount() < 2) {
            callback({ success: false, error: 'Need at least 2 players' });
            return;
        }

        room.startNewHand();
        callback({ success: true });
    });

    socket.on('getRoomInfo', (data, callback) => {
        const room = rooms.get(data.roomCode);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }

        const players = Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            chips: p.chips,
            isHost: p.isHost
        }));

        callback({
            players: players,
            roomCode: data.roomCode
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
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        const player = room.getPlayer(socket.id);
        if (!player || !player.isHost) {
            callback({ success: false, error: 'Only host can start next hand' });
            return;
        }

        room.startNewHand();
        callback({ success: true });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        rooms.forEach((room, roomCode) => {
            if (room.removePlayer(socket.id)) {
                rooms.delete(roomCode);
                io.to(roomCode).emit('roomClosed', 'Host left, room closed');
            } else {
                io.to(roomCode).emit('playerLeft', {
                    playerId: socket.id,
                    playerCount: room.getPlayerCount()
                });
                const playersList = Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    chips: p.chips,
                    isHost: p.isHost
                }));
                io.to(roomCode).emit('lobbyUpdate', { players: playersList });
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});