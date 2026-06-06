const crypto = require('crypto');
const { evaluateHand, compareHands } = require('./handEvaluator');
const { decideBotBetting, decideBotDiscards } = require('./botPlayer');

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
        this.selectedCards = new Map();
        this.drawSelections = new Map();
        this.playersConfirmed = new Set();
        this.discardPool = new Map();
        // ── Deadline-based timers ────────────────────────────────────────────────
        // Each timed phase stores an epoch deadline and a SINGLE setTimeout that fires
        // the real transition. We no longer tick per-second — clients are told how many
        // ms remain (once, plus on every broadcastState) and count down locally. This
        // survives dropped packets / reconnects and collapses ~15 msgs/turn to 1.
        //
        // phaseDeadline/phaseDurationMs drive the reveal/draw/discard countdowns;
        // turnDeadline drives the active betting turn (human or bot ring).
        this.phaseDeadline = null;     // epoch ms, or null when no reveal-style timer active
        this.phaseDurationMs = 0;      // original duration of the active phase (for progress bars)
        this.turnDeadline = null;      // epoch ms for the current betting turn
        this.memoryRevealTimeout = null;
        this.drawTimeout = null;
        this.discardRevealTimeout = null;
        this.drawRevealTimeout = null;
        this.turnTimeout = null;
        // Deferred one-shot timers (next-hand restart, end-of-game room close).
        // Tracked so clearAllTimers() can cancel them — otherwise a stray restart
        // fires on a room that's already being torn down.
        this.restartTimer = null;
        this.endGameTimer = null;
        this.nextHandTimeout = null;
        // Matchmaking fields
        this.gameSessionId = null;
        this.expectedPlayerCount = 0;
        this.matchedUserIds = [];
        this.onGameOver = null;
        // Invoked after the game ends so socketHandlers can delete the room from its
        // map — otherwise a normally-finished room lingers until everyone disconnects.
        this.onDestroy = null;
        // Monotonic per-game hand counter. Incremented at the START of each hand so
        // recordHand always sees a stable value when the hand resolves.
        this.handNumber = 0;
        // Set by socketHandlers — invoked with hand snapshot after every showdown/bluff-win.
        this.onHandComplete = null;
        // Scheduled game: timer that starts the game after the join window expires.
        this.joinWindowTimer = null;
        // When true the game waits for the host to press "Start" (or the join window
        // to expire) instead of auto-starting once expectedPlayerCount join.
        this.manualStart = false;
        // Epoch ms when the join window closes (for the client countdown). null = no window.
        this.joinDeadline = null;
        // Invited players for scheduled games: [{userId, name}] — used to show pending seats.
        this.invitedPlayers = [];
        // Practice (vs-computer) mode: the table contains one human + bot players.
        // Set by socketHandlers when the room is created.
        this.isPractice = false;
        // Deferred timers that drive bot turns — tracked so clearAllTimers() can
        // cancel them and a torn-down room never fires a stray bot action.
        this.botActionTimer = null;   // pending bot betting decision (one at a time)
        this.botDrawTimers = [];      // pending bot discard decisions (one per bot)
    }

    // Seat a computer-controlled player. Bots have no socket and userId === null,
    // so every per-bot io.to(botId).emit(...) is a harmless no-op. Never flagged
    // host — the human owns the table.
    addBot(name, difficulty = 'medium') {
        if (this.players.size >= 4) return null;
        const id = 'bot_' + crypto.randomBytes(4).toString('hex');
        this.players.set(id, {
            id,
            name,
            userId: null,
            chips: 200,
            hand: [],
            currentBet: 0,
            committed: 0,
            folded: false,
            isAllIn: false,
            isHost: false,
            disconnected: false,
            disconnectTimeout: null,
            sittingOut: false,
            isBot: true,
            difficulty,
        });
        return id;
    }

    // Count seated humans (non-bots). Used to tear a practice room down once its
    // only human has gone — bots must never keep a room alive on their own.
    humanCount() {
        let n = 0;
        this.players.forEach(p => { if (!p.isBot) n++; });
        return n;
    }

    addPlayer(socketId, name, userId = null, sittingOut = false, avatarUrl = null) {
        if (this.players.size >= 4) return false;
        this.players.set(socketId, {
            id: socketId,
            name: name,
            userId: userId,
            avatarUrl: avatarUrl,
            chips: 200,
            hand: [],
            currentBet: 0,
            committed: 0,
            folded: false,
            isAllIn: false,
            isHost: this.players.size === 0,
            disconnected: false,
            disconnectTimeout: null,
            // A player who joins mid-hand sits out (watches) until the next deal.
            sittingOut: sittingOut,
        });
        return true;
    }

    // Pick a random seat index among players eligible to act this hand
    // (dealt in and not folded). Falls back to 0 if somehow none qualify.
    randomPlayingIndex() {
        const arr = Array.from(this.players.values());
        const eligible = arr
            .map((p, i) => ({ p, i }))
            .filter(x => !x.p.folded && !x.p.sittingOut);
        if (eligible.length === 0) return 0;
        return eligible[Math.floor(Math.random() * eligible.length)].i;
    }

    // Snapshot for the pre-game waiting room (scheduled games).
    broadcastWaitingRoom() {
        const players = Array.from(this.players.values()).map(p => ({
            id: p.id,
            userId: p.userId,
            name: p.name,
            isHost: p.isHost,
            disconnected: p.disconnected,
        }));
        const joinedUserIds = new Set(players.map(p => p.userId).filter(Boolean));
        const pendingPlayers = this.invitedPlayers
            .filter(ip => !joinedUserIds.has(ip.userId))
            .map(ip => ({ name: ip.name }));
        this.io.to(this.roomCode).emit('waitingRoom', {
            roomCode: this.roomCode,
            players,
            pendingPlayers,
            count: players.length,
            target: this.expectedPlayerCount,
            canStart: players.length >= 2,
            deadline: this.joinDeadline,
        });
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
        this.handNumber++;
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
            // Everyone present at the deal is dealt in — sit-outs end here.
            player.sittingOut = false;
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

    // Record the active reveal/draw/discard countdown: store the deadline + original
    // duration so broadcastState can report remaining ms to (re)joining clients.
    _setPhaseDeadline(durationMs) {
        this.phaseDeadline = Date.now() + durationMs;
        this.phaseDurationMs = durationMs;
    }

    _clearPhaseDeadline() {
        this.phaseDeadline = null;
        this.phaseDurationMs = 0;
    }

    startMemoryRevealTimer() {
        const playerCount = this.players.size;
        const baseTime = 20;
        const extraTimePerPlayer = 8;
        let seconds = baseTime + (playerCount - 2) * extraTimePerPlayer;
        if (seconds < 20) seconds = 20;
        if (seconds > 45) seconds = 45;

        const durationMs = seconds * 1000;
        this._setPhaseDeadline(durationMs);
        this.broadcastState(); // carries phaseMsLeft/phaseTotalMs so clients start the countdown

        this.memoryRevealTimeout = setTimeout(() => {
            this.memoryRevealTimeout = null;
            this._clearPhaseDeadline();
            this.endMemoryRevealPhase();
        }, durationMs);
    }

    endMemoryRevealPhase() {
        this.gamePhase = 'firstBetting';
        this.playersActedThisRound = 0;

        const playerArray = Array.from(this.players.values());
        if (playerArray.length === 0) { this.clearAllTimers(); return; }
        this.currentPlayerIndex = this.randomPlayingIndex();

        this.players.forEach(player => {
            player.hand.forEach(card => { card.faceUp = false; });
        });

        this.broadcastState();
        this.notifyCurrentPlayer();

        this.io.to(this.roomCode).emit('actionLog', `Memory phase over. Cards hidden. Antes posted: pot ${this.pot}pts. Betting begins!`);
    }

    getPlayerPublicState(socketId, forPlayerId) {
        const player = this.players.get(socketId);
        if (!player) return null;

        const isSamePlayer = socketId === forPlayerId;

        return {
            id: player.id,
            userId: player.userId,
            avatarUrl: player.avatarUrl ?? null,
            name: player.name,
            chips: player.chips,
            currentBet: player.currentBet,
            folded: player.folded,
            isAllIn: player.isAllIn,
            isHost: player.isHost,
            disconnected: player.disconnected,
            sittingOut: player.sittingOut,
            isCurrentTurn: this.getPlayerIndex(socketId) === this.currentPlayerIndex &&
                !player.sittingOut &&
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
        const now = Date.now();
        // Remaining ms on the active reveal/draw/discard countdown (null if none). The
        // client anchors this to its own clock, so a reconnecting/mid-joining player
        // recovers the correct countdown from any state broadcast.
        const phaseMsLeft = this.phaseDeadline ? Math.max(0, this.phaseDeadline - now) : null;
        const phaseTotalMs = this.phaseDurationMs || null;

        // Active betting turn (so the seat ring is restored on reconnect — the old
        // per-tick model never sent this in state).
        let turnTimer = null;
        if (this.turnDeadline) {
            const currentPlayer = Array.from(this.players.values())[this.currentPlayerIndex];
            if (currentPlayer) {
                turnTimer = { playerId: currentPlayer.id, msLeft: Math.max(0, this.turnDeadline - now) };
            }
        }

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
                phaseMsLeft,
                phaseTotalMs,
                turnTimer,
            });
        });
    }

    getActivePlayers() {
        return Array.from(this.players.values()).filter(p => !p.folded && !p.sittingOut);
    }

    _applyBet(player, amount) {
        const totalBet = Math.min(amount, player.chips + player.currentBet, MAX_BET);
        const additional = totalBet - player.currentBet;
        if (additional < 1) return 0;
        player.chips -= additional;
        player.currentBet = totalBet;
        player.committed += additional;
        this.pot += additional;
        this.currentBet = Math.max(this.currentBet, player.currentBet);
        return totalBet;
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
                const totalBet = this._applyBet(player, amount);
                if (!totalBet) return;
                this.io.to(this.roomCode).emit('actionLog', `${player.name} bets ${totalBet}pts.`);
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
                    this.io.to(this.roomCode).emit('actionLog', `${player.name} calls ${paid}pts.`);
                }
                this.nextPlayer();
                break;
            }

            case 'raise': {
                const totalBet = this._applyBet(player, amount);
                if (!totalBet) return;
                this.io.to(this.roomCode).emit('actionLog', `${player.name} raises to ${totalBet}pts.`);
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
                this.io.to(this.roomCode).emit('actionLog', `${player.name} bets to the cap (${maxAdditional}pts).`);
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
            const p = this.players.get(playerArray[this.currentPlayerIndex]);
            if (p && !p.folded && !p.sittingOut) break;
        } while (attempts < this.players.size);

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
            ? `🏆 Game Over! ${winner.name} wins with ${winner.chips}pts!`
            : 'Game Over!';
        this.io.to(this.roomCode).emit('gameOver', { winnerName: winner?.name, chips: winner?.chips });
        if (this.onGameOver) {
            this.onGameOver(players);
        }
        this.endGameTimer = setTimeout(() => this.io.to(this.roomCode).emit('roomClosed', msg), 4000);
        // Explicit teardown: drop the finished room from the server's map even if the
        // players just sit on the game-over screen instead of disconnecting. Fires
        // shortly after the roomClosed message so clients have already been notified.
        setTimeout(() => this.onDestroy?.(), 6000);
    }

    // Countdown between hands: tell clients how many ms remain (once) so they can show
    // "Next round in N", then eliminate broke players and deal the next hand.
    scheduleNextHand(seconds = 15) {
        if (this.nextHandTimeout) { clearTimeout(this.nextHandTimeout); this.nextHandTimeout = null; }
        const durationMs = seconds * 1000;
        this.io.to(this.roomCode).emit('nextHandCountdown', { msLeft: durationMs });
        this.nextHandTimeout = setTimeout(() => {
            this.nextHandTimeout = null;
            this.eliminateBrokePlayers();
            if (this.players.size <= 1) { this.endGame(); return; }
            this.startNewHand();
        }, durationMs);
    }

    showBluffWin(winner) {
        this.clearTurnTimer();
        const potAmount = this.pot;
        // Snapshot what each player put in BEFORE we mutate chips/pot, so the
        // recorded hand reflects the true per-player contribution.
        const handSnapshot = Array.from(this.players.values()).map(p => ({
            userId: p.userId,
            amountWon: p.id === winner.id ? potAmount : 0,
            amountContributed: p.committed || 0,
            handRank: null,
            handDescription: null,
            folded: p.folded,
        }));
        winner.chips += potAmount;
        this.io.to(this.roomCode).emit('actionLog', `${winner.name} wins ${potAmount}pts!`);
        this.io.to(this.roomCode).emit('bluffWin', {
            winner: winner.name,
            amount: potAmount,
        });
        this.pot = 0;
        this.gamePhase = 'showdown';
        this.broadcastState();
        if (this.onHandComplete) {
            this.onHandComplete({
                handNumber: this.handNumber,
                potAmount,
                endedBy: 'fold',
                players: handSnapshot,
            });
        }
        setTimeout(() => this.broadcastLeaderboard(), 100);
        this.scheduleNextHand(15);
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
        this.drawSelections = new Map();
        this.playersConfirmed = new Set();

        const durationMs = 20 * 1000;
        this._setPhaseDeadline(durationMs);
        this.io.to(this.roomCode).emit('drawPhaseStart', { msLeft: durationMs, totalMs: durationMs });
        this.broadcastState();

        this.drawTimeout = setTimeout(() => {
            this.drawTimeout = null;
            this._clearPhaseDeadline();
            this.endDrawPhaseNoDiscard();
        }, durationMs);

        // Let any computer players choose and confirm their discards.
        this.scheduleBotDiscards();
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
            if (this.drawTimeout) { clearTimeout(this.drawTimeout); this.drawTimeout = null; }
            this._clearPhaseDeadline();
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
        const durationMs = 10 * 1000;
        this._setPhaseDeadline(durationMs);

        // Build payload — include ALL active players so stand-pat is visible too
        const discards = this.getActivePlayers().map(player => ({
            playerId: player.id,
            playerName: player.name,
            cards: (this.discardPool.get(player.id)?.cards || []).map(c => ({
                suit: c.suit,
                value: c.value,
            })),
        }));

        this.io.to(this.roomCode).emit('discardRevealStart', { msLeft: durationMs, totalMs: durationMs, discards });
        this.broadcastState();

        this.discardRevealTimeout = setTimeout(() => {
            this.discardRevealTimeout = null;
            this._clearPhaseDeadline();
            this.showReplacementCards();
        }, durationMs);
    }

    showReplacementCards() {
        this.gamePhase = 'drawReveal';
        const durationMs = 10 * 1000;
        this._setPhaseDeadline(durationMs);

        this.drawSelections.forEach((data) => {
            if (data.faceUpCard) {
                data.faceUpCard.faceUp = true;
            }
        });

        this.io.to(this.roomCode).emit('drawRevealStart', {
            msLeft: durationMs,
            totalMs: durationMs,
            replacements: Array.from(this.drawSelections.entries()).map(([id, data]) => ({
                playerId: id,
                playerName: data.playerName,
                faceUpCard: data.faceUpCard,
            })),
        });

        this.broadcastState();

        this.drawRevealTimeout = setTimeout(() => {
            this.drawRevealTimeout = null;
            this._clearPhaseDeadline();
            this.endDrawPhase();
        }, durationMs);
    }

    _startSecondBetting() {
        this.gamePhase = 'secondBetting';
        this.currentPlayerIndex = this.randomPlayingIndex();
        this.players.forEach(p => { p.currentBet = 0; });
        this.playersActedThisRound = 0;
        this.broadcastState();
        this.notifyCurrentPlayer();
    }

    endDrawPhase() {
        this.drawSelections.forEach((data) => {
            if (data.newCards) {
                data.newCards.forEach(card => { card.faceUp = false; });
            }
        });
        this.io.to(this.roomCode).emit('actionLog', 'Draw phase complete. Second betting begins.');
        this._startSecondBetting();
    }

    endDrawPhaseNoDiscard() {
        this.io.to(this.roomCode).emit('actionLog', 'Draw phase ended. Second betting begins.');
        this._startSecondBetting();
    }

    notifyCurrentPlayer() {
        const playerArray = Array.from(this.players.values());
        const currentPlayer = playerArray[this.currentPlayerIndex];
        if (!currentPlayer) return;

        // A sitting-out player can't act — skip past them.
        if (currentPlayer.sittingOut) {
            this.nextPlayer();
            return;
        }

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

        // A computer player acts on a short "thinking" delay instead of being
        // prompted over a socket. No turn timer — the bot always answers.
        if (currentPlayer.isBot) {
            this.scheduleBotBettingAction(currentPlayer);
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

    // Schedule a bot's betting move. The decision is computed immediately so the
    // delay can reflect what the bot is about to do — folds are quick, raises take
    // longer (just like a human deliberating). An occasional "long think" spike
    // adds realism regardless of the action.
    scheduleBotBettingAction(bot) {
        // Clear any in-flight action timer.
        if (this.botActionTimer) { clearTimeout(this.botActionTimer); this.botActionTimer = null; }

        const botId = bot.id;
        const player = this.players.get(botId);
        if (!player || player.folded) return;

        let decision;
        try {
            decision = decideBotBetting(this, player, player.difficulty);
        } catch (err) {
            console.error('[bot] betting decision failed, folding:', err?.message ?? err);
            decision = { action: 'fold', amount: 0 };
        }

        // Minimum 3 seconds so the turn-timer ring visibly counts down before
        // the bot acts — folds are slightly quicker, raises take longer.
        let base, jitter;
        if (decision.action === 'fold')        { base = 2000; jitter = 2000; }
        else if (decision.action === 'check')  { base = 2500; jitter = 2500; }
        else if (decision.action === 'call')   { base = 3000; jitter = 3000; }
        else                                   { base = 3500; jitter = 3500; }
        const longThink = Math.random() < 0.15;
        const delay = (longThink ? 6000 : base) + Math.floor(Math.random() * (longThink ? 4000 : jitter));

        // Show a normal 15-second countdown ring (same as a human turn). The deadline
        // is emitted once; the client counts down locally. The bot acts at a random
        // delay within that window — the ring just gets cleared early when it fires.
        const ringMs = 15 * 1000;
        this.turnDeadline = Date.now() + ringMs;
        this.io.to(this.roomCode).emit('turnTimer', { playerId: botId, msLeft: ringMs });

        this.botActionTimer = setTimeout(() => {
            this.botActionTimer = null;
            this.turnDeadline = null;
            this.io.to(this.roomCode).emit('turnTimer', null);

            if (this.players.size === 0) return;
            if (this.gamePhase !== 'firstBetting' && this.gamePhase !== 'secondBetting') return;
            const p = this.players.get(botId);
            if (!p || p.folded) return;
            if (this.getPlayerIndex(botId) !== this.currentPlayerIndex) return;
            this.playerAction(botId, decision.action, decision.amount);
        }, delay);
    }

    // During the draw phase, each active bot independently picks its discards and
    // confirms. The final confirm (human or bot) triggers processAllDiscards; the
    // 20s draw timer is the backstop if anyone stalls.
    scheduleBotDiscards() {
        this.botDrawTimers.forEach(t => clearTimeout(t));
        this.botDrawTimers = [];
        this.getActivePlayers().filter(p => p.isBot).forEach(bot => {
            const botId = bot.id;
            // Discarding: quick if standing pat, slower if swapping cards (deciding).
            const discardCount = decideBotDiscards(this, bot).length;
            const base = discardCount === 0 ? 800 : 1400;
            const delay = base + Math.floor(Math.random() * 2000);
            const t = setTimeout(() => {
                if (this.gamePhase !== 'draw') return;
                const player = this.players.get(botId);
                if (!player || player.folded) return;

                let indices = [];
                try {
                    indices = decideBotDiscards(this, player);
                } catch (err) {
                    console.error('[bot] discard decision failed, standing pat:', err?.message ?? err);
                    indices = [];
                }
                this.playerSelectCards(botId, indices);
                this.playerConfirmDiscard(botId);
            }, delay);
            this.botDrawTimers.push(t);
        });
    }

    startTurnTimer() {
        this.clearTurnTimer();
        const playerArray = Array.from(this.players.values());
        const currentPlayer = playerArray[this.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.folded) return;

        const durationMs = 15 * 1000;
        const playerId = currentPlayer.id;
        this.turnDeadline = Date.now() + durationMs;
        this.io.to(this.roomCode).emit('turnTimer', { playerId, msLeft: durationMs });

        // Single authoritative timeout: fold the player when the deadline passes. The
        // client renders the countdown locally from the deadline above.
        this.turnTimeout = setTimeout(() => {
            this.turnTimeout = null;
            this.turnDeadline = null;
            this.io.to(this.roomCode).emit('turnTimer', null);
            this.io.to(this.roomCode).emit('actionLog', `${currentPlayer.name} timed out and folded.`);
            currentPlayer.folded = true;
            this.playersActedThisRound++;
            this.broadcastState();
            this.nextPlayer();
        }, durationMs);
    }

    clearTurnTimer() {
        if (this.turnTimeout) {
            clearTimeout(this.turnTimeout);
            this.turnTimeout = null;
        }
        this.turnDeadline = null;
        this.io.to(this.roomCode).emit('turnTimer', null);
    }

    clearAllTimers() {
        this.clearTurnTimer();
        this._clearPhaseDeadline();
        if (this.memoryRevealTimeout) { clearTimeout(this.memoryRevealTimeout); this.memoryRevealTimeout = null; }
        if (this.drawTimeout) { clearTimeout(this.drawTimeout); this.drawTimeout = null; }
        if (this.drawRevealTimeout) { clearTimeout(this.drawRevealTimeout); this.drawRevealTimeout = null; }
        if (this.discardRevealTimeout) { clearTimeout(this.discardRevealTimeout); this.discardRevealTimeout = null; }
        if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
        if (this.endGameTimer) { clearTimeout(this.endGameTimer); this.endGameTimer = null; }
        if (this.nextHandTimeout) { clearTimeout(this.nextHandTimeout); this.nextHandTimeout = null; }
        if (this.joinWindowTimer) { clearTimeout(this.joinWindowTimer); this.joinWindowTimer = null; }
        if (this.botActionTimer) { clearTimeout(this.botActionTimer); this.botActionTimer = null; }
        if (this.botDrawTimers && this.botDrawTimers.length) {
            this.botDrawTimers.forEach(t => clearTimeout(t));
            this.botDrawTimers = [];
        }
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
                description: h.result.description,
            })),
            winner: {
                playerId: winner.playerId,
                playerName: winner.playerName,
                rankName: winner.result.rankName,
                description: winner.result.description,
            },
            winnings: Array.from(winnings.entries()).map(([playerId, amount]) => ({ playerId, amount })),
            pot: totalPot,
        });

        // Build the per-hand snapshot for stats. Folded players don't have a
        // result (they never showed); non-folded players carry their evaluated
        // rank/description even if they didn't win a side pot.
        if (this.onHandComplete) {
            const handSnapshot = Array.from(this.players.values()).map(p => {
                const result = resultById.get(p.id);
                return {
                    userId: p.userId,
                    amountWon: winnings.get(p.id) || 0,
                    amountContributed: p.committed || 0,
                    handRank: result ? result.rank : null,
                    handDescription: result ? result.description : null,
                    folded: p.folded,
                };
            });
            this.onHandComplete({
                handNumber: this.handNumber,
                potAmount: totalPot,
                endedBy: 'showdown',
                players: handSnapshot,
            });
        }

        this.pot = 0;
        this.broadcastState();
        setTimeout(() => this.broadcastLeaderboard(), 100);
        this.scheduleNextHand(15);
    }
}

module.exports = { GameRoom };
