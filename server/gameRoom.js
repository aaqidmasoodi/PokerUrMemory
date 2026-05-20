const crypto = require('crypto');
const { evaluateHand, compareHands } = require('./handEvaluator');

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const ANTE = 5;
const MAX_BET = 20;

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value, faceUp: false });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    // Cryptographically secure Fisher-Yates so deck output can't be fingerprinted/predicted.
    for (let i = deck.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Build main + side pots from each player's total contribution this hand.
// `contributions` = [{ id, committed, folded }]. Returns layered pots, each with the
// chip amount and the ids of players still eligible to win that layer.
function buildSidePots(contributions) {
    const pots = [];
    const remaining = contributions
        .filter(c => c.committed > 0)
        .map(c => ({ id: c.id, folded: c.folded, left: c.committed }));

    while (true) {
        const positive = remaining.filter(c => c.left > 0);
        if (positive.length === 0) break;

        const level = Math.min(...positive.map(c => c.left));
        let amount = 0;
        const eligibleIds = [];
        for (const c of remaining) {
            if (c.left > 0) {
                amount += level;
                c.left -= level;
                if (!c.folded) eligibleIds.push(c.id);
            }
        }
        pots.push({ amount, eligibleIds });
    }
    return pots;
}

class GameRoom {
    constructor(roomCode, hostId, io) {
        this.roomCode = roomCode;
        this.hostId = hostId;
        this.io = io;
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
        this.turnTimer = null;
        this.turnTimeLeft = 0;
        this.drawTimer = 0;
        this.drawTimerInterval = null;
        this.revealTimerInterval = null;
        this.drawSelections = new Map();
        this.playersConfirmed = new Set();
        this.discardPool = new Map();
        this.discardRevealInterval = null;
        // Matchmaking fields
        this.gameSessionId = null;
        this.expectedPlayerCount = 0;
        this.matchedUserIds = [];
        this.onGameOver = null;
    }

    addPlayer(socketId, name, userId = null) {
        if (this.players.size >= 4) return false;
        this.players.set(socketId, {
            id: socketId,
            name: name,
            userId: userId,
            chips: 200,
            hand: [],
            currentBet: 0,
            committed: 0,
            folded: false,
            isAllIn: false,
            isHost: this.players.size === 0,
            disconnected: false,
            disconnectTimeout: null,
        });
        return true;
    }

    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player && player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
        }
        const wasHost = player?.isHost ?? false;
        this.players.delete(socketId);

        if (wasHost && this.players.size > 0) {
            const newHost = this.players.values().next().value;
            newHost.isHost = true;
            this.io.to(this.roomCode).emit('actionLog', `${newHost.name} is now the host.`);
        }

        return this.players.size === 0;
    }

    getPlayer(socketId) {
        return this.players.get(socketId);
    }

    getPlayerByIndex(index) {
        return Array.from(this.players.values())[index];
    }

    getPlayerIndex(socketId) {
        return Array.from(this.players.keys()).indexOf(socketId);
    }

    getPlayerCount() {
        return this.players.size;
    }

    startNewHand() {
        // Guard against the restart timers firing on a room everyone has left.
        if (this.players.size === 0) {
            this.clearAllTimers();
            return;
        }
        this.deck = createDeck();
        this.pot = 0;
        this.currentBet = 0;
        this.currentPlayerIndex = 0;
        this.gamePhase = 'memoryReveal';
        this.isDrawPhase = false;
        this.playersActedThisRound = 0;
        this.selectedCards.clear();
        this.drawSelections = new Map();
        this.playersConfirmed = new Set();
        this.discardPool = new Map();

        this.players.forEach(player => {
            player.hand = [];
            player.currentBet = 0;
            player.committed = 0;
            player.folded = false;
            player.isAllIn = false;
        });

        // Charge antes — each player posts before cards are dealt
        this.players.forEach(player => {
            const ante = Math.min(ANTE, player.chips);
            player.chips -= ante;
            player.currentBet = ante;
            player.committed += ante;
            this.pot += ante;
        });
        this.currentBet = ANTE;

        this.dealInitialCards();
    }

    dealInitialCards() {
        this.players.forEach((player) => {
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
        const playerCount = this.players.size;
        const baseTime = 20;
        const extraTimePerPlayer = 8;
        this.revealTimeLeft = baseTime + (playerCount - 2) * extraTimePerPlayer;
        if (this.revealTimeLeft < 20) this.revealTimeLeft = 20;
        if (this.revealTimeLeft > 45) this.revealTimeLeft = 45;
        this.io.to(this.roomCode).emit('timerUpdate', this.revealTimeLeft);

        this.revealTimer = setInterval(() => {
            this.revealTimeLeft--;
            this.io.to(this.roomCode).emit('timerUpdate', this.revealTimeLeft);

            if (this.revealTimeLeft <= 0) {
                clearInterval(this.revealTimer);
                this.revealTimer = null;
                this.endMemoryRevealPhase();
            }
        }, 1000);
    }

    endMemoryRevealPhase() {
        this.gamePhase = 'firstBetting';
        this.playersActedThisRound = 0;

        const playerArray = Array.from(this.players.values());
        if (playerArray.length === 0) { this.clearAllTimers(); return; }
        this.currentPlayerIndex = Math.floor(Math.random() * playerArray.length);

        this.players.forEach(player => {
            player.hand.forEach(card => { card.faceUp = false; });
        });

        this.broadcastState();
        this.notifyCurrentPlayer();

        this.io.to(this.roomCode).emit('actionLog', `Memory phase over. Cards hidden. Antes posted: pot: $${this.pot}. Betting begins!`);
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
            disconnected: player.disconnected,
            isCurrentTurn: this.getPlayerIndex(socketId) === this.currentPlayerIndex &&
                this.gamePhase !== 'memoryReveal' &&
                this.gamePhase !== 'waiting',
            hand: player.hand.map((card) => {
                let showCard = false;

                if (this.gamePhase === 'showdown') {
                    showCard = true;
                } else if (this.gamePhase === 'memoryReveal') {
                    showCard = isSamePlayer || card.isInitiallyFaceUp === true;
                } else if (this.gamePhase === 'draw' || this.gamePhase === 'drawReveal') {
                    if (isSamePlayer) {
                        showCard = true;
                    } else if (this.gamePhase === 'drawReveal') {
                        const replacementData = this.drawSelections?.get(player.id);
                        if (replacementData?.faceUpCard === card) {
                            showCard = true;
                        }
                    }
                } else if (this.gamePhase === 'firstBetting' || this.gamePhase === 'secondBetting' || this.gamePhase === 'discardReveal') {
                    showCard = isSamePlayer;
                }

                return {
                    ...card,
                    value: showCard ? card.value : null,
                    suit: showCard ? card.suit : null,
                    isInitiallyFaceUp: undefined,
                    isInitiallyHidden: undefined,
                };
            }),
        };
    }

    broadcastState() {
        this.players.forEach((player, id) => {
            const playersData = Array.from(this.players.keys()).map(socketId =>
                this.getPlayerPublicState(socketId, id)
            );

            this.io.to(id).emit('gameState', {
                roomCode: this.roomCode,
                pot: this.pot,
                currentBet: this.currentBet,
                phase: this.gamePhase,
                currentPlayerIndex: this.getPlayerIndex(player.id),
                players: playersData,
                timeLeft: this.revealTimeLeft,
            });
        });
    }

    getActivePlayers() {
        return Array.from(this.players.values()).filter(p => !p.folded);
    }

    playerAction(socketId, action, amount = 0) {
        const player = this.players.get(socketId);
        if (!player) return;

        // Validate at the trust boundary — never act on an unknown action or a
        // non-numeric amount (NaN/Infinity would poison the pot math).
        const VALID_ACTIONS = ['check', 'bet', 'call', 'raise', 'fold', 'allIn'];
        if (!VALID_ACTIONS.includes(action)) return;
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount < 0) amount = 0;

        const playerIndex = this.getPlayerIndex(socketId);
        if (playerIndex !== this.currentPlayerIndex) return;

        this.clearTurnTimer();
        this.playersActedThisRound++;

        switch (action) {
            case 'check': {
                this.io.to(this.roomCode).emit('actionLog', `${player.name} checks.`);
                this.nextPlayer();
                break;
            }

            case 'bet': {
                const totalBet = Math.min(amount, player.chips + player.currentBet, MAX_BET);
                const additional = totalBet - player.currentBet;
                if (additional < 1) return;
                player.chips -= additional;
                player.currentBet = totalBet;
                player.committed += additional;
                this.pot += additional;
                this.currentBet = Math.max(this.currentBet, player.currentBet);
                this.io.to(this.roomCode).emit('actionLog', `${player.name} bets $${totalBet}.`);
                this.nextPlayer();
                break;
            }

            case 'call': {
                const callAmount = this.currentBet - player.currentBet;
                if (callAmount <= 0) {
                    // Calling when already matched — treat as check
                    this.io.to(this.roomCode).emit('actionLog', `${player.name} checks.`);
                } else {
                    const paid = Math.min(callAmount, player.chips);
                    player.chips -= paid;
                    player.currentBet += paid;
                    player.committed += paid;
                    this.pot += paid;
                    if (player.chips === 0) player.isAllIn = true;
                    this.io.to(this.roomCode).emit('actionLog', `${player.name} calls $${paid}.`);
                }
                this.nextPlayer();
                break;
            }

            case 'raise': {
                const totalBet = Math.min(amount, player.chips + player.currentBet, MAX_BET);
                const additional = totalBet - player.currentBet;
                if (additional < 1) return;
                player.chips -= additional;
                player.currentBet = totalBet;
                player.committed += additional;
                this.pot += additional;
                this.currentBet = Math.max(this.currentBet, player.currentBet);
                this.io.to(this.roomCode).emit('actionLog', `${player.name} raises to $${totalBet}.`);
                this.playersActedThisRound = 1;
                this.nextPlayer();
                break;
            }

            case 'fold': {
                player.folded = true;
                this.io.to(this.roomCode).emit('actionLog', `${player.name} folds.`);

                const activePlayers = this.getActivePlayers();
                if (activePlayers.length === 1) {
                    this.handleSinglePlayerLeft(activePlayers[0]);
                } else {
                    this.nextPlayer();
                }
                break;
            }

            case 'allIn': {
                const maxAdditional = Math.min(player.chips, MAX_BET - player.currentBet);
                if (maxAdditional <= 0) {
                    // Already at cap — treat as check
                    this.io.to(this.roomCode).emit('actionLog', `${player.name} checks.`);
                    this.nextPlayer();
                    break;
                }
                player.chips -= maxAdditional;
                player.currentBet += maxAdditional;
                player.committed += maxAdditional;
                player.isAllIn = player.chips === 0;
                this.pot += maxAdditional;
                this.currentBet = Math.max(this.currentBet, player.currentBet);
                this.io.to(this.roomCode).emit('actionLog', `${player.name} goes ALL IN for $${maxAdditional}!`);
                this.nextPlayer();
                break;
            }
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
            if (this.getActivePlayers().some(p => p.currentBet >= MAX_BET)) {
                this.io.to(this.roomCode).emit('actionLog', `Bet limit of $${MAX_BET} reached: moving to next phase.`);
            }
            this.endBettingRound();
            return;
        }

        this.broadcastState();
        this.notifyCurrentPlayer();
    }

    shouldEndBettingRound() {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length <= 1) return true;

        // End immediately when any player hits the $20 bet cap
        if (activePlayers.some(p => p.currentBet >= MAX_BET)) return true;

        if (this.playersActedThisRound >= activePlayers.length) {
            if (this.currentBet === 0) return true;
            return activePlayers.every(p => p.currentBet === this.currentBet || p.isAllIn);
        }

        return false;
    }

    endBettingRound() {
        this.clearTurnTimer();
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length === 1) {
            this.handleSinglePlayerLeft(activePlayers[0]);
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

    eliminateBrokePlayers() {
        const broke = Array.from(this.players.values()).filter(p => p.chips === 0);
        broke.forEach(p => {
            this.io.to(this.roomCode).emit('actionLog', `${p.name} is out of chips and eliminated!`);
            this.players.delete(p.id);
        });
        return broke.length;
    }

    endGame() {
        this.clearAllTimers();
        const players = Array.from(this.players.values());
        const winner = players.find(p => p.chips > 0) || players[0];
        const msg = winner
            ? `🏆 Game Over! ${winner.name} wins with $${winner.chips}!`
            : 'Game Over!';
        this.io.to(this.roomCode).emit('gameOver', { winnerName: winner?.name, chips: winner?.chips });
        if (this.onGameOver) {
            this.onGameOver(players);
        }
        setTimeout(() => this.io.to(this.roomCode).emit('roomClosed', msg), 4000);
    }

    showBluffWin(winner) {
        this.clearTurnTimer();
        winner.chips += this.pot;
        this.io.to(this.roomCode).emit('actionLog', `${winner.name} wins $${this.pot}!`);
        this.io.to(this.roomCode).emit('bluffWin', {
            winner: winner.name,
            amount: this.pot,
        });
        this.pot = 0;
        this.gamePhase = 'showdown';
        this.broadcastState();
        setTimeout(() => this.broadcastLeaderboard(), 100);
        setTimeout(() => {
            this.eliminateBrokePlayers();
            if (this.players.size <= 1) { this.endGame(); return; }
            this.startNewHand();
        }, 5000);
    }

    broadcastLeaderboard() {
        const leaderboard = Array.from(this.players.values())
            .map(p => ({ name: p.name, chips: p.chips }))
            .sort((a, b) => b.chips - a.chips);
        this.io.to(this.roomCode).emit('leaderboard', leaderboard);
    }

    startDrawPhase() {
        this.clearTurnTimer();
        this.isDrawPhase = true;
        this.currentBet = 0;

        this.players.forEach(p => {
            p.currentBet = 0;
            p.hand.forEach(card => { card.faceUp = false; });
        });

        this.gamePhase = 'draw';
        this.drawTimer = 20;
        this.drawSelections = new Map();
        this.playersConfirmed = new Set();

        this.io.to(this.roomCode).emit('drawPhaseStart', { timer: this.drawTimer });
        this.broadcastState();

        this.drawTimerInterval = setInterval(() => {
            this.drawTimer--;
            this.io.to(this.roomCode).emit('timerUpdate', this.drawTimer);

            if (this.drawTimer <= 0) {
                clearInterval(this.drawTimerInterval);
                this.drawTimerInterval = null;
                this.endDrawPhaseNoDiscard();
            }
        }, 1000);
    }

    playerSelectCards(socketId, selectedIndices) {
        if (this.gamePhase !== 'draw') return;
        const player = this.players.get(socketId);
        if (!player) return;

        // Sanitize: unique integer indices within the player's own hand only.
        // Prevents negative/out-of-range/duplicate indices from corrupting the splice.
        if (!Array.isArray(selectedIndices)) { this.drawSelections.set(socketId, []); return; }
        const handLen = player.hand.length;
        const clean = [...new Set(selectedIndices)]
            .filter(i => Number.isInteger(i) && i >= 0 && i < handLen)
            .slice(0, handLen);
        this.drawSelections.set(socketId, clean);
    }

    playerConfirmDiscard(socketId) {
        if (this.gamePhase !== 'draw') return;
        if (this.playersConfirmed.has(socketId)) return;

        this.playersConfirmed.add(socketId);

        const activePlayers = this.getActivePlayers();
        if (this.playersConfirmed.size === activePlayers.length) {
            clearInterval(this.drawTimerInterval);
            this.drawTimerInterval = null;
            this.processAllDiscards();
        }
    }

    processAllDiscards() {
        this.getActivePlayers().forEach((player) => {
            const socketId = player.id;
            const selectedIndices = this.drawSelections.get(socketId) || [];
            const discardCount = selectedIndices.length;

            // Capture discarded cards BEFORE splicing so we can show them to everyone
            const discardedCards = selectedIndices.map(i => player.hand[i]);
            this.discardPool.set(socketId, { playerName: player.name, cards: discardedCards });

            // Deal replacement cards
            const newCards = [];
            for (let i = 0; i < discardCount; i++) {
                newCards.push(this.deck.pop());
            }

            // Remove discarded cards in reverse-index order, then add replacements
            const sortedIndices = [...selectedIndices].sort((a, b) => b - a);
            sortedIndices.forEach(index => player.hand.splice(index, 1));
            player.hand.push(...newCards);

            // Face-up rule: show 1 replacement face-up only when 2+ cards were drawn;
            // a single drawn card stays face-down (more mystery)
            let faceUpCard = null;
            if (discardCount > 1 && newCards.length > 0) {
                newCards[0].faceUp = true;
                faceUpCard = newCards[0];
            }

            this.drawSelections.set(socketId, { newCards, faceUpCard, playerName: player.name });
        });

        // First show the discarded cards, then (after 10s) show replacement cards
        this.showDiscardReveal();
    }

    showDiscardReveal() {
        this.gamePhase = 'discardReveal';
        this.revealTimer = 10;

        // Build payload — include ALL active players so stand-pat is visible too
        const discards = this.getActivePlayers().map(player => ({
            playerId: player.id,
            playerName: player.name,
            cards: (this.discardPool.get(player.id)?.cards || []).map(c => ({
                suit: c.suit,
                value: c.value,
            })),
        }));

        this.io.to(this.roomCode).emit('discardRevealStart', { timer: 10, discards });
        this.broadcastState();

        this.discardRevealInterval = setInterval(() => {
            this.revealTimer--;
            this.io.to(this.roomCode).emit('timerUpdate', this.revealTimer);

            if (this.revealTimer <= 0) {
                clearInterval(this.discardRevealInterval);
                this.discardRevealInterval = null;
                this.showReplacementCards();
            }
        }, 1000);
    }

    showReplacementCards() {
        this.gamePhase = 'drawReveal';
        this.revealTimer = 10;

        this.drawSelections.forEach((data) => {
            if (data.faceUpCard) {
                data.faceUpCard.faceUp = true;
            }
        });

        this.io.to(this.roomCode).emit('drawRevealStart', {
            timer: this.revealTimer,
            replacements: Array.from(this.drawSelections.entries()).map(([id, data]) => ({
                playerId: id,
                playerName: data.playerName,
                faceUpCard: data.faceUpCard,
            })),
        });

        this.broadcastState();

        this.revealTimerInterval = setInterval(() => {
            this.revealTimer--;
            this.io.to(this.roomCode).emit('timerUpdate', this.revealTimer);

            if (this.revealTimer <= 0) {
                clearInterval(this.revealTimerInterval);
                this.revealTimerInterval = null;
                this.endDrawPhase();
            }
        }, 1000);
    }

    endDrawPhase() {
        this.drawSelections.forEach((data) => {
            if (data.newCards) {
                data.newCards.forEach(card => { card.faceUp = false; });
            }
        });

        this.io.to(this.roomCode).emit('actionLog', 'Draw phase complete. Second betting begins.');

        this.gamePhase = 'secondBetting';
        this.currentPlayerIndex = Math.floor(Math.random() * this.players.size);
        this.players.forEach(p => { p.currentBet = 0; });
        this.playersActedThisRound = 0;

        this.broadcastState();
        this.notifyCurrentPlayer();
    }

    endDrawPhaseNoDiscard() {
        this.io.to(this.roomCode).emit('actionLog', 'Draw phase ended. Second betting begins.');

        this.gamePhase = 'secondBetting';
        this.currentPlayerIndex = Math.floor(Math.random() * this.players.size);
        this.players.forEach(p => { p.currentBet = 0; });
        this.playersActedThisRound = 0;

        this.broadcastState();
        this.notifyCurrentPlayer();
    }

    notifyCurrentPlayer() {
        const playerArray = Array.from(this.players.values());
        const currentPlayer = playerArray[this.currentPlayerIndex];
        if (!currentPlayer) return;

        // Immediately fold a disconnected player rather than making everyone wait 30s
        if (currentPlayer.disconnected) {
            this.io.to(this.roomCode).emit('actionLog', `${currentPlayer.name} disconnected and folded.`);
            currentPlayer.folded = true;
            this.playersActedThisRound++;
            this.broadcastState();
            const activePlayers = this.getActivePlayers();
            if (activePlayers.length === 1) {
                this.handleSinglePlayerLeft(activePlayers[0]);
            } else {
                this.nextPlayer();
            }
            return;
        }

        this.io.to(currentPlayer.id).emit('yourTurnNotification', {
            message: 'YOUR TURN!',
            phase: this.gamePhase,
        });

        const maxBetTotal = Math.min(currentPlayer.chips + currentPlayer.currentBet, MAX_BET);
        const atCap = currentPlayer.currentBet >= MAX_BET;

        this.io.to(currentPlayer.id).emit('yourTurn', {
            canCheck: currentPlayer.currentBet >= this.currentBet,
            canCall: this.currentBet > 0 && currentPlayer.currentBet < this.currentBet && !currentPlayer.isAllIn && !atCap,
            canRaise: currentPlayer.chips > 0 && !currentPlayer.isAllIn && !atCap && this.currentBet < MAX_BET,
            currentBet: this.currentBet,
            playerBet: currentPlayer.currentBet,
            minRaise: Math.min(this.currentBet + 1, maxBetTotal),
            maxBet: maxBetTotal,
            minBet: Math.min(this.currentBet + 1, maxBetTotal),
        });

        if (this.gamePhase === 'firstBetting' || this.gamePhase === 'secondBetting') {
            this.startTurnTimer();
        }
    }

    startTurnTimer() {
        this.clearTurnTimer();
        const playerArray = Array.from(this.players.values());
        const currentPlayer = playerArray[this.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.folded) return;

        this.turnTimeLeft = 30;
        const playerId = currentPlayer.id;
        this.io.to(this.roomCode).emit('turnTimer', { playerId, timeLeft: 30 });

        this.turnTimer = setInterval(() => {
            this.turnTimeLeft--;
            this.io.to(this.roomCode).emit('turnTimer', { playerId, timeLeft: this.turnTimeLeft });

            if (this.turnTimeLeft <= 0) {
                this.clearTurnTimer();
                this.io.to(this.roomCode).emit('actionLog', `${currentPlayer.name} timed out and folded.`);
                currentPlayer.folded = true;
                this.playersActedThisRound++;
                this.broadcastState();
                this.nextPlayer();
            }
        }, 1000);
    }

    clearTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        this.io.to(this.roomCode).emit('turnTimer', null);
    }

    clearAllTimers() {
        this.clearTurnTimer();
        if (this.revealTimer) { clearInterval(this.revealTimer); this.revealTimer = null; }
        if (this.drawTimerInterval) { clearInterval(this.drawTimerInterval); this.drawTimerInterval = null; }
        if (this.revealTimerInterval) { clearInterval(this.revealTimerInterval); this.revealTimerInterval = null; }
        if (this.discardRevealInterval) { clearInterval(this.discardRevealInterval); this.discardRevealInterval = null; }
    }

    startShowdown() {
        this.clearTurnTimer();
        this.gamePhase = 'showdown';

        this.players.forEach(player => {
            player.hand.forEach(card => { card.faceUp = true; });
        });

        const activePlayers = this.getActivePlayers();
        const hands = activePlayers.map(player => ({
            playerId: player.id,
            playerName: player.name,
            hand: player.hand,
            result: evaluateHand(player.hand),
        }));

        hands.sort((a, b) => compareHands(b.result, a.result));

        // Best hand per eligible player, keyed by id (for side-pot resolution).
        const resultById = new Map(hands.map(h => [h.playerId, h.result]));
        const totalPot = this.pot;

        // Split the pot into main + side pots based on each player's total contribution,
        // then award each layer to the best eligible hand(s), splitting ties evenly and
        // handing odd chips to the earliest seat.
        const seatOrder = Array.from(this.players.keys());
        const pots = buildSidePots(
            Array.from(this.players.values()).map(p => ({
                id: p.id, committed: p.committed || 0, folded: p.folded,
            }))
        );

        const winnings = new Map();
        for (const pot of pots) {
            let contenders = pot.eligibleIds.filter(id => resultById.has(id));
            // If no eligible player remains for a layer (e.g. the sole contributor folded),
            // fall back to the best hand overall so chips never vanish.
            if (contenders.length === 0) contenders = [hands[0].playerId];

            let best = [contenders[0]];
            for (let i = 1; i < contenders.length; i++) {
                const cmp = compareHands(resultById.get(contenders[i]), resultById.get(best[0]));
                if (cmp > 0) best = [contenders[i]];
                else if (cmp === 0) best.push(contenders[i]);
            }

            const share = Math.floor(pot.amount / best.length);
            best.forEach(id => winnings.set(id, (winnings.get(id) || 0) + share));

            // Distribute leftover chips one at a time by seat order among the tied winners.
            let remainder = pot.amount - share * best.length;
            const orderedWinners = seatOrder.filter(id => best.includes(id));
            for (let i = 0; remainder > 0; i++, remainder--) {
                const id = orderedWinners[i % orderedWinners.length];
                winnings.set(id, (winnings.get(id) || 0) + 1);
            }
        }

        winnings.forEach((amount, id) => {
            const p = this.players.get(id);
            if (p) p.chips += amount;
        });

        // Primary winner for the UI = best hand overall (always wins ≥ the main pot).
        const winner = hands[0];

        this.io.to(this.roomCode).emit('showdown', {
            hands: hands.map(h => ({
                playerId: h.playerId,
                playerName: h.playerName,
                hand: h.hand,
                rankName: h.result.rankName,
            })),
            winner: {
                playerId: winner.playerId,
                playerName: winner.playerName,
                rankName: winner.result.rankName,
            },
            winnings: Array.from(winnings.entries()).map(([playerId, amount]) => ({ playerId, amount })),
            pot: totalPot,
        });

        this.pot = 0;
        this.broadcastState();
        setTimeout(() => this.broadcastLeaderboard(), 100);
        setTimeout(() => {
            this.eliminateBrokePlayers();
            if (this.players.size <= 1) { this.endGame(); return; }
            this.startNewHand();
        }, 7000);
    }
}

module.exports = { GameRoom };
