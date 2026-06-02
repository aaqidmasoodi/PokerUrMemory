// ─── Computer (bot) decision logic ───────────────────────────────────────────
// Bots are ordinary players in a GameRoom whose actions the server generates
// instead of receiving over a socket. These pure functions decide a bot's move
// from the public-ish state it can legitimately "see" (its own hand + table bet).
//
// Two decisions exist: a betting action (check/call/raise/fold) and which cards
// to discard in the draw phase. Both are deliberately simple heuristics with a
// dash of randomness so the bot isn't perfectly predictable.

const { evaluateHand } = require('./handEvaluator');

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const MAX_BET = 20; // mirror of gameRoom's cap; betting is hard-clamped server-side too

// Per-difficulty knobs. Easy plays tight + passive (folds often, rarely raises or
// bluffs); Hard plays loose + aggressive (calls wide, raises big, bluffs more).
// Medium sits in between and is the default.
// mistakeProb: chance of doing something irrational (call a clear fold, fold
// a strong hand) — simulates human lapses. looseBonus: added to callProbMedium
// and callProbWeak so the bot calls more often at lower hand strengths.
const DIFFICULTY = {
  easy: {
    valueThreshold: 0.80, semiThreshold: 0.62, semiBetProb: 0.20,
    bluffProb: 0.03, valueRaise: 4, smallRaise: 3,
    strongThreshold: 0.80, raiseProbStrong: 0.30,
    callThreshold: 0.55, cheapCall: 5, callProbMedium: 0.45, callProbWeak: 0.25,
    mistakeProb: 0.08, looseBonus: 0.05,
  },
  medium: {
    valueThreshold: 0.68, semiThreshold: 0.42, semiBetProb: 0.55,
    bluffProb: 0.09, valueRaise: 7, smallRaise: 4,
    strongThreshold: 0.68, raiseProbStrong: 0.62,
    callThreshold: 0.42, cheapCall: 9, callProbMedium: 0.72, callProbWeak: 0.45,
    mistakeProb: 0.06, looseBonus: 0.12,
  },
  hard: {
    valueThreshold: 0.58, semiThreshold: 0.36, semiBetProb: 0.72,
    bluffProb: 0.15, valueRaise: 10, smallRaise: 6,
    strongThreshold: 0.56, raiseProbStrong: 0.82,
    callThreshold: 0.34, cheapCall: 13, callProbMedium: 0.88, callProbWeak: 0.60,
    mistakeProb: 0.04, looseBonus: 0.20,
  },
};

function difficultyConfig(difficulty) {
  return DIFFICULTY[difficulty] || DIFFICULTY.medium;
}

// Map a made hand to a 0..1 strength score. Pairs scale by their rank so a pair
// of aces plays much stronger than a pair of twos; high-card scales by top card.
function handStrength(hand) {
  const { rank, tieBreakers } = evaluateHand(hand);
  const top = tieBreakers && tieBreakers.length ? tieBreakers[0] : 0; // 0..12

  if (rank >= 4) return 1.0;          // straight, flush, full house, quads, straight flush
  if (rank === 3) return 0.9;         // three of a kind
  if (rank === 2) return 0.75;        // two pair
  if (rank === 1) return 0.5 + top / 40; // one pair: 0.5 (twos) .. ~0.8 (aces)
  return Math.max(0, top / 30);       // high card: ~0 .. 0.43
}

// Decide a betting action. Returns { action, amount } where `amount` is the
// desired TOTAL bet for a raise (the server re-clamps it). We never emit 'bet'
// — only 'raise' — because 'raise' is the path that correctly re-opens the round,
// and we only raise when it's genuinely possible (so the engine never stalls).
function decideBotBetting(room, bot, difficulty = 'medium') {
  const cfg = difficultyConfig(difficulty);
  const table = room.currentBet;
  const toCall = table - bot.currentBet;

  // Already all-in (no chips): the only safe move is to pass. The server treats a
  // call with nothing owed/affordable as a check and advances the turn.
  if (bot.chips <= 0) return { action: 'call', amount: 0 };

  const strength = handStrength(bot.hand);
  const r = Math.random();

  // Occasionally play irrationally — simulates human lapses, distraction, or a
  // deliberate bluff/hero-fold that makes the bot unpredictable. Mistakes are
  // rare enough that they don't dominate the play pattern.
  if (r < cfg.mistakeProb) {
    const canRaiseMistake = bot.chips > 0 && bot.currentBet < MAX_BET && table < MAX_BET;
    const raiseTo = (extra) => Math.min(MAX_BET, bot.currentBet + bot.chips, Math.max(table + 1, bot.currentBet + extra));
    const choices = ['fold', 'call'];
    if (canRaiseMistake) choices.push('raise');
    const pick = choices[Math.floor(Math.random() * choices.length)];
    if (pick === 'fold' && toCall <= 0) return { action: 'check', amount: 0 }; // can't fold for free
    if (pick === 'raise') return { action: 'raise', amount: raiseTo(cfg.smallRaise) };
    if (pick === 'call' && toCall <= 0) return { action: 'check', amount: 0 };
    return { action: pick, amount: 0 };
  }

  // A raise is only legal/non-stalling when the bot has chips, isn't at the cap,
  // and the table bet hasn't already reached the cap.
  const canRaise = bot.chips > 0 && bot.currentBet < MAX_BET && table < MAX_BET;

  // Build a sensible raise target, always at least one chip above the table bet
  // and never beyond the cap or the bot's stack.
  const raiseTo = (extra) => Math.min(
    MAX_BET,
    bot.currentBet + bot.chips,
    Math.max(table + 1, bot.currentBet + extra),
  );

  // Nothing to call — it's checked to us.
  if (toCall <= 0) {
    const valueBet = strength > cfg.valueThreshold;
    const semiBet = strength > cfg.semiThreshold && r < cfg.semiBetProb;
    const bluff = r < cfg.bluffProb;
    if (canRaise && (valueBet || semiBet || bluff)) {
      const extra = valueBet ? cfg.valueRaise : cfg.smallRaise;
      return { action: 'raise', amount: raiseTo(extra) };
    }
    return { action: 'check', amount: 0 };
  }

  // Facing a bet.
  const callCost = Math.min(toCall, bot.chips);

  if (strength > cfg.strongThreshold) {
    // Strong: usually raise, otherwise call.
    if (canRaise && r < cfg.raiseProbStrong) return { action: 'raise', amount: raiseTo(cfg.valueRaise) };
    return { action: 'call', amount: 0 };
  }

  if (strength > cfg.callThreshold) {
    // Decent: call cheap bets, call most expensive ones, occasionally fold.
    // looseBonus nudges the bot to call a bit wider than pure heuristic.
    if (callCost <= cfg.cheapCall || r < cfg.callProbMedium + cfg.looseBonus) return { action: 'call', amount: 0 };
    return { action: 'fold', amount: 0 };
  }

  // Weak: fold most of the time. Call only when it's cheap, very rarely bluff-raise.
  if (callCost <= cfg.cheapCall && r < cfg.callProbWeak + cfg.looseBonus) return { action: 'call', amount: 0 };
  if (canRaise && r < cfg.bluffProb) return { action: 'raise', amount: raiseTo(cfg.smallRaise) };
  return { action: 'fold', amount: 0 };
}

// Decide which card indices to discard in the draw phase. Keeps made combinations
// (pairs/trips/quads), drops loose kickers; stands pat on a straight or better.
// Returns indices into the bot's CURRENT hand (max 4, matching the player rule).
function decideBotDiscards(room, bot) {
  const hand = bot.hand;
  if (!Array.isArray(hand) || hand.length === 0) return [];

  const { rank } = evaluateHand(hand);
  if (rank >= 4) return []; // straight/flush/full house/quads/straight flush — keep all

  const counts = {};
  hand.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; });

  // Cards that belong to a pair-or-better group are worth keeping.
  const keptIndices = new Set(
    hand.map((c, i) => i).filter(i => counts[hand[i].value] >= 2),
  );

  let discard;
  if (keptIndices.size >= 2) {
    // Have a pair / two pair / trips: discard everything that isn't part of it
    // (this also correctly drops the lone kicker on two pair).
    discard = hand.map((_, i) => i).filter(i => !keptIndices.has(i));
  } else {
    // High card only: keep the two highest cards, throw the rest.
    const ranked = hand
      .map((c, i) => ({ i, v: VALUES.indexOf(c.value) }))
      .sort((a, b) => b.v - a.v);
    discard = ranked.slice(2).map(x => x.i);
  }

  return discard.slice(0, 4);
}

const VALID_DIFFICULTIES = Object.keys(DIFFICULTY);

module.exports = { decideBotBetting, decideBotDiscards, VALID_DIFFICULTIES };
