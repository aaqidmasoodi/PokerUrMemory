const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function evaluateHand(cards) {
    const sorted = [...cards].sort((a, b) => VALUES.indexOf(b.value) - VALUES.indexOf(a.value));
    const values = sorted.map(c => VALUES.indexOf(c.value));
    const suits = sorted.map(c => c.suit);

    const valueCounts = {};
    values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
    const counts = Object.values(valueCounts).sort((a, b) => b - a);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] - 1);
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

function compareTieBreakers(a, b) {
    for (let i = 0; i < Math.min(a.tieBreakers.length, b.tieBreakers.length); i++) {
        if (a.tieBreakers[i] !== b.tieBreakers[i]) {
            return b.tieBreakers[i] - a.tieBreakers[i];
        }
    }
    return 0;
}

module.exports = { evaluateHand, compareTieBreakers };
