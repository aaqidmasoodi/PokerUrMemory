const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Display names indexed the same way as VALUES (index 0 === '2', index 12 === 'A').
const NAME_SINGULAR = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const NAME_PLURAL = ['Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];
const singular = v => NAME_SINGULAR[v] ?? '?';
const plural = v => NAME_PLURAL[v] ?? '?';

// Detect a 5-card straight, including the ace-low "wheel" (A-2-3-4-5).
// Returns the tie-breaker order (highest card first) when it's a straight, else null.
// For the wheel the ace counts low, so the straight is 5-high: [3,2,1,0,-1].
function straightOrder(values) {
    const uniq = [...new Set(values)].sort((a, b) => b - a);
    if (uniq.length !== 5) return null;

    const isSequential = uniq.every((v, i) => i === 0 || v === uniq[i - 1] - 1);
    if (isSequential) return uniq;

    // Wheel: A(12),5(3),4(2),3(1),2(0) — treat the ace as below the 2.
    if (uniq[0] === 12 && uniq[1] === 3 && uniq[2] === 2 && uniq[3] === 1 && uniq[4] === 0) {
        return [3, 2, 1, 0, -1];
    }
    return null;
}

function evaluateHand(cards) {
    const sorted = [...cards].sort((a, b) => VALUES.indexOf(b.value) - VALUES.indexOf(a.value));
    const values = sorted.map(c => VALUES.indexOf(c.value));
    const suits = sorted.map(c => c.suit);

    const valueCounts = {};
    values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);

    // Group distinct values, most frequent first, then highest value first. This is the
    // backbone of correct tie-breaking: the cards that define the hand (quads, trips,
    // pairs) must be compared before kickers. e.g. a pair of 7s must rank by the 7,
    // not by an ace kicker.
    const groups = Object.keys(valueCounts)
        .map(v => ({ value: Number(v), count: valueCounts[v] }))
        .sort((a, b) => b.count - a.count || b.value - a.value);
    const counts = groups.map(g => g.count);

    // Expand the grouped values back into a flat tie-breaker list (pair value, pair value,
    // kicker, kicker, …) so compareHands can walk it element by element.
    const groupedTieBreakers = [];
    groups.forEach(g => { for (let i = 0; i < g.count; i++) groupedTieBreakers.push(g.value); });

    const isFlush = suits.every(s => s === suits[0]);
    const order = straightOrder(values);
    const isStraight = order !== null;
    const isStraightFlush = isFlush && isStraight;
    // Royal = ace-high straight flush. The wheel (order[0] === 3) is not royal.
    const isRoyal = isStraightFlush && order[0] === 12;

    // Straights use the straight order (ace-low aware) for tie-breaking; everything else
    // uses the count-grouped order computed above.
    const straightTieBreakers = order ?? values;

    if (isRoyal) {
        return { rank: 9, rankName: 'Royal Flush', description: 'Royal Flush', tieBreakers: straightTieBreakers };
    }
    if (isStraightFlush) {
        return { rank: 8, rankName: 'Straight Flush', description: `Straight Flush, ${singular(order[0])} High`, tieBreakers: straightTieBreakers };
    }
    if (counts[0] === 4) {
        return { rank: 7, rankName: 'Four of a Kind', description: `Four of a Kind, ${plural(groups[0].value)}`, tieBreakers: groupedTieBreakers };
    }
    if (counts[0] === 3 && counts[1] === 2) {
        return { rank: 6, rankName: 'Full House', description: `Full House, ${plural(groups[0].value)} over ${plural(groups[1].value)}`, tieBreakers: groupedTieBreakers };
    }
    if (isFlush) {
        return { rank: 5, rankName: 'Flush', description: `Flush, ${singular(values[0])} High`, tieBreakers: groupedTieBreakers };
    }
    if (isStraight) {
        return { rank: 4, rankName: 'Straight', description: `Straight, ${singular(order[0])} High`, tieBreakers: straightTieBreakers };
    }
    if (counts[0] === 3) {
        return { rank: 3, rankName: 'Three of a Kind', description: `Three of a Kind, ${plural(groups[0].value)}`, tieBreakers: groupedTieBreakers };
    }
    if (counts[0] === 2 && counts[1] === 2) {
        return { rank: 2, rankName: 'Two Pair', description: `Two Pair, ${plural(groups[0].value)} & ${plural(groups[1].value)}`, tieBreakers: groupedTieBreakers };
    }
    if (counts[0] === 2) {
        return { rank: 1, rankName: 'Pair', description: `Pair of ${plural(groups[0].value)}`, tieBreakers: groupedTieBreakers };
    }
    return { rank: 0, rankName: 'High Card', description: `${singular(values[0])} High`, tieBreakers: groupedTieBreakers };
}

// Returns > 0 if hand `a` beats hand `b`, < 0 if `b` beats `a`, 0 on a true tie.
function compareHands(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const len = Math.min(a.tieBreakers.length, b.tieBreakers.length);
    for (let i = 0; i < len; i++) {
        if (a.tieBreakers[i] !== b.tieBreakers[i]) {
            return a.tieBreakers[i] - b.tieBreakers[i];
        }
    }
    return 0;
}

// Legacy comparator kept for the showdown sort: returns positive when `b` ranks ahead of `a`
// (so Array.sort produces best-hand-first). Now tie-aware via the wheel-corrected tieBreakers.
function compareTieBreakers(a, b) {
    return -compareHands(a, b);
}

module.exports = { evaluateHand, compareHands, compareTieBreakers };
