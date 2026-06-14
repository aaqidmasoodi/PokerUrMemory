// ─── Computer (bot) decision logic ───────────────────────────────────────────
// Bots are ordinary players in a GameRoom whose actions the server generates
// instead of receiving over a socket. These pure functions decide a bot's move
// from the public-ish state it can legitimately "see" (its own hand, the table
// bet, the pot, and how many cards each opponent drew — all visible to a human).
//
// Two decisions exist: a betting action (check/call/raise/fold) and which cards
// to discard in the draw phase.
//
// This is 5-card draw, so the engine that makes the bot good is built around the
// information a real draw player uses:
//   1. Draw-aware hand value — a 4-flush or open-ended straight is worth chasing,
//      not garbage, so both betting and discards understand draws.
//   2. Opponent draw reads — how many cards each rival drew is the single biggest
//      public tell. Someone who stood pat almost certainly has a straight-or-
//      better; someone who drew 3 has at best one pair. We model that.
//   3. Equity by Monte Carlo — simulate showdowns of the bot's hand against
//      opponents whose hands are sampled from the unseen deck (conditioned on
//      their draw counts), to get a real win probability.
//   4. Pot odds — call/raise/fold against the price being laid, not fixed dice.
//
// Difficulty differs by HOW MUCH of this the bot uses and how often it errs:
//   easy   — crude made-hand value only, ignores draws/reads/pot-odds, errs often.
//   medium — full equity + draws + pot odds, but only reacts to the "pat" read.
//   hard   — full equity + every draw read + tight pot-odds + balanced bluffing,
//            near-zero mistakes. Meant to be very hard to beat.

const { evaluateHand, compareHands } = require('./handEvaluator');

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const MAX_BET = 20; // mirror of gameRoom's cap; betting is hard-clamped server-side too

// Per-difficulty knobs.
//   useEquity  — run Monte-Carlo equity (medium/hard) vs. the crude made-hand path (easy).
//   useReads   — false (ignore opponent draw counts), 'pat' (only react to stand-pat),
//                or 'full' (condition on every opponent's exact draw count).
//   sims       — Monte-Carlo iterations per decision (more = steadier estimate).
//   mistakeProb— chance of a deliberately irrational move (human lapse / unpredictability).
//   aggression — probability of taking the aggressive line when value/raise is warranted.
//   bluffProb  — base chance of betting/raising with no equity.
//   valueRaise/smallRaise — raise sizing (extra chips above the table bet).
//   valueBetEquity/raiseEquity — equity needed to value-bet when checked to / to raise a bet.
//   callMargin — multiplier on the pot-odds break-even (1.0 = call only when +EV).
const DIFFICULTY = {
  easy: {
    useEquity: false, useReads: false, sims: 0,
    mistakeProb: 0.10, aggression: 0.30, bluffProb: 0.04,
    valueRaise: 3, smallRaise: 2,
  },
  medium: {
    useEquity: true, useReads: 'pat', sims: 160,
    mistakeProb: 0.05, aggression: 0.65, bluffProb: 0.08,
    valueRaise: 6, smallRaise: 4,
    valueBetEquity: 0.60, raiseEquity: 0.68, callMargin: 1.08,
  },
  hard: {
    useEquity: true, useReads: 'full', sims: 350,
    mistakeProb: 0.02, aggression: 0.90, bluffProb: 0.13,
    valueRaise: 10, smallRaise: 6,
    valueBetEquity: 0.54, raiseEquity: 0.62, callMargin: 1.0,
  },
};

const VALID_DIFFICULTIES = Object.keys(DIFFICULTY);

function difficultyConfig(difficulty) {
  return DIFFICULTY[difficulty] || DIFFICULTY.medium;
}

// ─── Card / deck helpers ──────────────────────────────────────────────────────

const cardKey = c => `${c.suit}${c.value}`;
const valueIndex = c => VALUES.indexOf(c.value);

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pick one entry from [value, weight] pairs by weight.
function pickWeighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
}

// Every card not in the bot's hand and not already dead (publicly discarded). These
// are the cards opponents' hidden holdings and future draws could legitimately be.
function buildUnseen(room, bot) {
  const seen = new Set(bot.hand.map(cardKey));
  if (room.discardPool && typeof room.discardPool.forEach === 'function') {
    room.discardPool.forEach(entry => (entry.cards || []).forEach(c => seen.add(cardKey(c))));
  }
  const unseen = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      const k = `${suit}${value}`;
      if (!seen.has(k)) unseen.push({ suit, value });
    }
  }
  return unseen;
}

// ─── Hand value ────────────────────────────────────────────────────────────────

// Crude made-hand score (0..1) used only by the EASY bot — looks at the 5 cards as
// a finished hand, no draw awareness, no kicker nuance. Intentionally simplistic.
function legacyHandStrength(hand) {
  const { rank, tieBreakers } = evaluateHand(hand);
  const top = tieBreakers && tieBreakers.length ? tieBreakers[0] : 0; // 0..12
  if (rank >= 4) return 1.0;
  if (rank === 3) return 0.9;
  if (rank === 2) return 0.75;
  if (rank === 1) return 0.5 + top / 40;
  return Math.max(0, top / 30);
}

// ─── Discard strategy (shared by the bot AND by opponent modelling in sims) ─────

// Find the 4 cards (returned as indices to KEEP) that make the best straight draw,
// or null if none. A valid draw is 4 distinct ranks spanning <= 4 (open-ended span
// 3, gutshot span 4) — i.e. completable to a 5-card straight. Ace is tried both
// high and low so the wheel draw (A-2-3-4) is found.
function bestStraightDrawKeep(valIdx) {
  const idxs = valIdx.map((_, i) => i);
  const variants = [valIdx, valIdx.map(v => (v === 12 ? -1 : v))]; // ace high, ace low
  let best = null;
  for (const vals of variants) {
    for (let drop = 0; drop < idxs.length; drop++) {
      const keep = idxs.filter(i => i !== drop);
      const vs = keep.map(i => vals[i]);
      if (new Set(vs).size !== 4) continue; // need 4 distinct ranks
      const span = Math.max(...vs) - Math.min(...vs);
      if (span <= 4 && (!best || span < best.span)) best = { keep, span };
    }
  }
  return best ? best.keep : null;
}

// Draw-aware discard choice (medium/hard). Returns indices to DISCARD (max 4):
//   straight-or-better → stand pat
//   pair / two pair / trips → keep the paired cards, ditch kickers
//   4-flush → keep the 4 suited, ditch the odd card
//   4-card straight draw → keep the 4 connected, ditch the odd card
//   nothing → keep the highest card (plus a Queen-or-better second), draw the rest
function chooseDiscards(hand) {
  if (!Array.isArray(hand) || hand.length < 5) return [];
  const ev = evaluateHand(hand);
  if (ev.rank >= 4) return []; // straight, flush, full house, quads, straight flush — pat

  const all = hand.map((_, i) => i);
  const counts = {};
  hand.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; });

  // Pair-or-better grouping: keep paired cards, discard the loose kickers.
  const grouped = all.filter(i => counts[hand[i].value] >= 2);
  if (grouped.length >= 2) {
    return all.filter(i => !grouped.includes(i)).slice(0, 4);
  }

  // No made pair — chase the best draw. Flush draw first (more equity / higher value).
  const bySuit = {};
  hand.forEach((c, i) => { (bySuit[c.suit] = bySuit[c.suit] || []).push(i); });
  for (const s in bySuit) {
    if (bySuit[s].length === 4) return all.filter(i => !bySuit[s].includes(i));
  }

  const straightKeep = bestStraightDrawKeep(hand.map(valueIndex));
  if (straightKeep) return all.filter(i => !straightKeep.includes(i));

  // Junk: keep the top card (+ a second if it's a Queen or better), throw the rest.
  const ranked = hand.map((c, i) => ({ i, v: valueIndex(c) })).sort((a, b) => b.v - a.v);
  const keep = [ranked[0].i];
  if (ranked[1] && ranked[1].v >= VALUES.indexOf('Q')) keep.push(ranked[1].i);
  return all.filter(i => !keep.includes(i)).slice(0, 4);
}

// Original naive discard logic — kept for the EASY bot (and as a safe fallback).
// Keeps pair-or-better groups, otherwise keeps the two highest cards. Ignores draws.
function legacyDiscards(hand) {
  const { rank } = evaluateHand(hand);
  if (rank >= 4) return [];
  const counts = {};
  hand.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; });
  const keptIndices = new Set(hand.map((_, i) => i).filter(i => counts[hand[i].value] >= 2));
  let discard;
  if (keptIndices.size >= 2) {
    discard = hand.map((_, i) => i).filter(i => !keptIndices.has(i));
  } else {
    const ranked = hand.map((c, i) => ({ i, v: VALUES.indexOf(c.value) })).sort((a, b) => b.v - a.v);
    discard = ranked.slice(2).map(x => x.i);
  }
  return discard.slice(0, 4);
}

// ─── Monte-Carlo equity ─────────────────────────────────────────────────────────

// Remove and return `n` random cards off the top of the (already-shuffled) pool.
function pullRandom(pool, n) {
  return pool.splice(0, Math.min(n, pool.length));
}

// Remove and return `n` cards of a single random rank that has at least `n` copies
// left in the pool (e.g. the pair for trips). Returns null if no rank qualifies.
function pullOfAKind(pool, n) {
  const byRank = {};
  pool.forEach((c, i) => { (byRank[c.value] = byRank[c.value] || []).push(i); });
  const candidates = Object.values(byRank).filter(list => list.length >= n);
  if (!candidates.length) return null;
  const idxs = candidates[Math.floor(Math.random() * candidates.length)].slice(0, n);
  const cards = idxs.map(i => pool[i]);
  [...idxs].sort((a, b) => b - a).forEach(i => pool.splice(i, 1));
  return cards;
}

// Remove and return `n` cards of one random suit that has at least `n` left.
function pullFlush(pool, n) {
  const bySuit = {};
  pool.forEach((c, i) => { (bySuit[c.suit] = bySuit[c.suit] || []).push(i); });
  const suits = Object.values(bySuit).filter(list => list.length >= n);
  if (!suits.length) return null;
  const idxs = suits[Math.floor(Math.random() * suits.length)].slice(0, n);
  const cards = idxs.map(i => pool[i]);
  [...idxs].sort((a, b) => b - a).forEach(i => pool.splice(i, 1));
  return cards;
}

// Remove and return 5 cards forming a straight (one card per rank in a run of five).
// Tries random ace-high runs; returns null if none can be assembled from the pool.
function pullStraight(pool) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const low = Math.floor(Math.random() * 9); // run low..low+4, indices 0..12
    const idxs = [];
    for (let r = low; r <= low + 4; r++) {
      const i = pool.findIndex((c, j) => valueIndex(c) === r && !idxs.includes(j));
      if (i === -1) { idxs.length = 0; break; }
      idxs.push(i);
    }
    if (idxs.length === 5) {
      const cards = idxs.map(i => pool[i]);
      [...idxs].sort((a, b) => b - a).forEach(i => pool.splice(i, 1));
      return cards;
    }
  }
  return null;
}

// Construct a 5-card hand of the requested made-hand category from the pool,
// padding with random cards if the category can't be fully assembled. Cards used
// are removed from the pool.
function constructHand(pool, category) {
  let cards = null;
  switch (category) {
    case 'quads':      cards = pullOfAKind(pool, 4); break;
    case 'fullhouse':  { const t = pullOfAKind(pool, 3); const p = t && pullOfAKind(pool, 2); cards = t && p ? t.concat(p) : t; break; }
    case 'flush':      cards = pullFlush(pool, 5); break;
    case 'straight':   cards = pullStraight(pool); break;
    case 'trips':      cards = pullOfAKind(pool, 3); break;
    case 'twopair':    { const a = pullOfAKind(pool, 2); const b = a && pullOfAKind(pool, 2); cards = a && b ? a.concat(b) : a; break; }
    case 'pair':       cards = pullOfAKind(pool, 2); break;
    default:           cards = []; // 'highcard'
  }
  if (!cards) cards = [];
  if (cards.length < 5) cards = cards.concat(pullRandom(pool, 5 - cards.length));
  return cards;
}

// Realistic distribution of an opponent's FINAL holding given how many cards they
// drew. Pat (0) means a made hand; the more they drew the weaker they tend to end
// up. These are honest ranges (no snowing) — enough to make the reads bite.
const DRAW_RANGES = {
  // Pat is mostly a made hand, but includes some disguised two pair and the
  // occasional snow (pat bluff) so the bot doesn't fold monsters to every pat bet.
  0: [['straight', 0.34], ['flush', 0.24], ['fullhouse', 0.14], ['quads', 0.04], ['twopair', 0.14], ['pair', 0.08], ['highcard', 0.02]],
  1: [['twopair', 0.45], ['flush', 0.12], ['straight', 0.12], ['trips', 0.06], ['pair', 0.20], ['highcard', 0.05]],
  2: [['trips', 0.32], ['twopair', 0.18], ['pair', 0.42], ['highcard', 0.08]],
  3: [['pair', 0.55], ['twopair', 0.15], ['trips', 0.05], ['highcard', 0.25]],
  4: [['pair', 0.32], ['twopair', 0.05], ['highcard', 0.63]],
};

// Deal one opponent a realistic FINAL hand from the (mutable) shuffled pool. With a
// known draw count we construct from the matching range (this is what makes reads
// bite — a pat opponent gets a made hand). With no read we model an average player:
// deal five, apply the discard strategy, and draw replacements. Cards are removed
// from the pool so none is dealt twice.
function dealOpponentFinal(pool, drawCount) {
  if (drawCount != null) {
    const range = DRAW_RANGES[Math.min(drawCount, 4)] || DRAW_RANGES[4];
    return evaluateHand(constructHand(pool, pickWeighted(range)));
  }
  const pre = pullRandom(pool, 5);
  const discardIdx = chooseDiscards(pre);
  const keep = pre.filter((_, i) => !discardIdx.includes(i));
  const drawn = pullRandom(pool, pre.length - keep.length);
  return evaluateHand(keep.concat(drawn));
}

// Estimate the bot's probability of winning the pot (ties counted as half) by
// simulating many showdowns. botDraws=true means the bot hasn't drawn yet, so each
// sim applies its discard strategy and draws fresh cards before the showdown.
function simulateEquity(botHand, oppInfos, unseen, { sims, botDraws }) {
  if (oppInfos.length === 0) return 1;
  let score = 0;

  for (let s = 0; s < sims; s++) {
    const pool = shuffleInPlace(unseen.slice());

    let finalBot = botHand;
    if (botDraws) {
      const discardIdx = chooseDiscards(botHand);
      const keep = botHand.filter((_, i) => !discardIdx.includes(i));
      const drawn = pool.splice(0, botHand.length - keep.length);
      finalBot = keep.concat(drawn);
    }
    const botEval = evaluateHand(finalBot);

    let beatsAll = true;
    let tie = false;
    for (const opp of oppInfos) {
      const oppEval = dealOpponentFinal(pool, opp.drawCount);
      const cmp = compareHands(botEval, oppEval);
      if (cmp < 0) { beatsAll = false; break; }
      if (cmp === 0) tie = true;
    }
    if (beatsAll) score += tie ? 0.5 : 1;
  }
  return score / sims;
}

// ─── Betting decision ────────────────────────────────────────────────────────────

// A raise is only legal/non-stalling when the bot has chips, isn't at the cap, and
// the table bet hasn't already reached the cap.
function canRaiseNow(room, bot) {
  return bot.chips > 0 && bot.currentBet < MAX_BET && room.currentBet < MAX_BET;
}

// Build a sensible raise target: at least one chip over the table bet, never beyond
// the cap or the bot's stack. (Server re-clamps this too.)
function makeRaiseTo(room, bot) {
  return (extra) => Math.min(
    MAX_BET,
    bot.currentBet + bot.chips,
    Math.max(room.currentBet + 1, bot.currentBet + extra),
  );
}

// Deliberately irrational move — simulates human lapses and keeps the bot
// unpredictable. Rare enough not to dominate play.
function mistakeMove(room, bot, toCall, cfg) {
  const raiseTo = makeRaiseTo(room, bot);
  const canRaise = canRaiseNow(room, bot);
  const choices = ['fold', 'call'];
  if (canRaise) choices.push('raise');
  const pick = choices[Math.floor(Math.random() * choices.length)];
  if (pick === 'raise') return { action: 'raise', amount: raiseTo(cfg.smallRaise) };
  if (pick === 'fold' && toCall <= 0) return { action: 'check', amount: 0 }; // can't fold for free
  if (pick === 'call' && toCall <= 0) return { action: 'check', amount: 0 };
  return { action: pick, amount: 0 };
}

// EASY: crude made-hand heuristic with fixed call probabilities — no draws, no
// reads, no pot odds. This is the beatable bot.
function decideEasy(room, bot) {
  const table = room.currentBet;
  const toCall = table - bot.currentBet;
  const strength = legacyHandStrength(bot.hand);
  const r = Math.random();
  const canRaise = canRaiseNow(room, bot);
  const raiseTo = makeRaiseTo(room, bot);

  if (toCall <= 0) {
    if (canRaise && (strength > 0.80 || (strength > 0.62 && r < 0.20) || r < 0.04)) {
      return { action: 'raise', amount: raiseTo(strength > 0.80 ? 4 : 3) };
    }
    return { action: 'check', amount: 0 };
  }

  const callCost = Math.min(toCall, bot.chips);
  if (strength > 0.80) {
    if (canRaise && r < 0.30) return { action: 'raise', amount: raiseTo(4) };
    return { action: 'call', amount: 0 };
  }
  if (strength > 0.55) {
    if (callCost <= 5 || r < 0.50) return { action: 'call', amount: 0 };
    return { action: 'fold', amount: 0 };
  }
  if (callCost <= 5 && r < 0.30) return { action: 'call', amount: 0 };
  return { action: 'fold', amount: 0 };
}

// MEDIUM / HARD: equity- and pot-odds-driven, using opponent draw reads.
function decideByEquity(room, bot, cfg) {
  const table = room.currentBet;
  const toCall = table - bot.currentBet;
  const pot = room.pot || 0;
  const canRaise = canRaiseNow(room, bot);
  const raiseTo = makeRaiseTo(room, bot);

  const opps = room.getActivePlayers().filter(p => p.id !== bot.id);
  if (opps.length === 0) return { action: toCall > 0 ? 'call' : 'check', amount: 0 };

  // Read each opponent's draw count (only meaningful post-draw, in secondBetting).
  const hasReads = cfg.useReads && room.discardPool && typeof room.discardPool.has === 'function';
  const oppInfos = opps.map(p => {
    let drawCount = null;
    if (hasReads && room.discardPool.has(p.id)) {
      const c = room.discardPool.get(p.id).cards.length;
      drawCount = cfg.useReads === 'full' ? c : (c === 0 ? 0 : null); // 'pat' reacts only to stand-pat
    }
    return { drawCount };
  });

  const unseen = buildUnseen(room, bot);
  const botDraws = room.gamePhase === 'firstBetting';
  const equity = simulateEquity(bot.hand, oppInfos, unseen, { sims: cfg.sims, botDraws });

  // Telling a consistent story: if the bot itself stood pat this hand, a bet
  // represents a made hand — so it can bluff a touch more credibly.
  let bluffBonus = 0;
  if (hasReads && room.discardPool.has(bot.id)
      && room.discardPool.get(bot.id).cards.length === 0
      && room.gamePhase === 'secondBetting') {
    bluffBonus = 0.06;
  }

  const r = Math.random();

  // Checked to us.
  if (toCall <= 0) {
    if (canRaise && equity > cfg.valueBetEquity && r < cfg.aggression) {
      const extra = equity > cfg.valueBetEquity + 0.15 ? cfg.valueRaise : cfg.smallRaise;
      return { action: 'raise', amount: raiseTo(extra) };
    }
    if (canRaise && r < cfg.bluffProb + bluffBonus) {
      return { action: 'raise', amount: raiseTo(cfg.smallRaise) };
    }
    return { action: 'check', amount: 0 };
  }

  // Facing a bet — raise for value with a big edge, else call when the price is right.
  if (canRaise && equity > cfg.raiseEquity && r < cfg.aggression) {
    const extra = equity > cfg.raiseEquity + 0.12 ? cfg.valueRaise : cfg.smallRaise;
    return { action: 'raise', amount: raiseTo(extra) };
  }
  const required = toCall / (pot + toCall); // equity needed for the call to break even
  if (equity >= required * cfg.callMargin) return { action: 'call', amount: 0 };

  // Unprofitable: mostly fold, occasionally turn a busted hand into a bluff-raise.
  if (canRaise && r < cfg.bluffProb * 0.6 + bluffBonus) {
    return { action: 'raise', amount: raiseTo(cfg.smallRaise) };
  }
  return { action: 'fold', amount: 0 };
}

// Decide a betting action. Returns { action, amount } where `amount` is the desired
// TOTAL bet for a raise (the server re-clamps it). We never emit 'bet' — only
// 'raise' — because 'raise' is the path that correctly re-opens the round, and we
// only raise when it's genuinely possible (so the engine never stalls).
function decideBotBetting(room, bot, difficulty = 'medium') {
  const cfg = difficultyConfig(difficulty);

  // Already all-in (no chips): the only safe move is to pass. The server treats a
  // call with nothing owed/affordable as a check and advances the turn.
  if (bot.chips <= 0) return { action: 'call', amount: 0 };

  const toCall = room.currentBet - bot.currentBet;

  if (Math.random() < cfg.mistakeProb) return mistakeMove(room, bot, toCall, cfg);
  if (!cfg.useEquity) return decideEasy(room, bot);

  try {
    return decideByEquity(room, bot, cfg);
  } catch (err) {
    console.error('[bot] equity decision failed, using simple heuristic:', err?.message ?? err);
    return decideEasy(room, bot);
  }
}

// Decide which card indices to discard in the draw phase. Easy uses the naive
// "keep pairs / top two" logic; medium and hard use the draw-aware strategy
// (medium errs occasionally). Returns indices into the bot's CURRENT hand (max 4).
function decideBotDiscards(room, bot) {
  const hand = bot.hand;
  if (!Array.isArray(hand) || hand.length === 0) return [];

  const difficulty = bot.difficulty || 'medium';
  if (difficulty === 'easy') return legacyDiscards(hand);
  if (difficulty === 'medium' && Math.random() < 0.10) return legacyDiscards(hand);

  try {
    return chooseDiscards(hand).slice(0, 4);
  } catch (err) {
    console.error('[bot] discard decision failed, using simple heuristic:', err?.message ?? err);
    return legacyDiscards(hand);
  }
}

module.exports = { decideBotBetting, decideBotDiscards, VALID_DIFFICULTIES };
