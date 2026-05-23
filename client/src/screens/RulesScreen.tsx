import { ChevronLeft, Eye, Coins, Shuffle, Trophy, Users } from 'lucide-react';

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="h-dvh flex flex-col bg-transparent select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Header — background bleeds edge-to-edge, content sits inside safe area */}
      <div
        className="shrink-0 flex items-center gap-3 border-b border-black/[0.07] bg-white backdrop-blur-sm"
        style={{
          marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
          marginLeft: 'calc(-1 * env(safe-area-inset-left, 0px))',
          marginRight: 'calc(-1 * env(safe-area-inset-right, 0px))',
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
          paddingBottom: '0.75rem',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <button
          onClick={onBack}
          className="w-8 h-8 grid place-items-center rounded-full bg-white border border-black/[0.08] shadow-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="font-display text-sm [@media(orientation:landscape)]:text-base font-bold blue-text tracking-wider uppercase">
          How to Play
        </h1>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <RulesBody />
      </div>
    </div>
  );
}

export function RulesBody() {
  return (
    <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto pb-10 [@media(orientation:landscape)]:px-6 [@media(orientation:landscape)]:py-6">

      {/* Hero card */}
      <div className="rounded-2xl bg-gradient-to-br from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white p-5 [@media(orientation:landscape)]:p-6 shadow-lg">
        <p className="font-display text-[11px] [@media(orientation:landscape)]:text-[13px] tracking-[0.2em] uppercase opacity-70 mb-1">
          5-Card Draw · Memory Twist
        </p>
        <h2 className="font-display text-xl [@media(orientation:landscape)]:text-2xl font-bold leading-tight mb-3">
          PokerUrMemory
        </h2>
        <p className="text-[13px] [@media(orientation:landscape)]:text-[15px] leading-relaxed opacity-90">
          Some people play Bridge to keep their memories sharp. PokerUrMemory does so too: and is more fun.
          It adapts Five Card Draw Poker to make memorising cards entertaining.
        </p>
      </div>

      {/* No gambling notice */}
      <div className="rounded-xl bg-white border border-black/[0.07] shadow-md px-4 py-3 flex gap-3 items-start">
        <span className="text-lg mt-0.5">🃏</span>
        <p className="text-[13px] [@media(orientation:landscape)]:text-[15px] text-gray-500 leading-relaxed">
          PokerUrMemory offers <strong className="text-foreground">no money, no prizes and no gambling.</strong>{' '}
          Up to four players compete for points, each starting with <strong className="text-foreground">200 points</strong>.
        </p>
      </div>

      {/* Section: The Deal */}
      <RuleSection
        icon={<Eye className="w-4 h-4 [@media(orientation:landscape)]:w-5 [@media(orientation:landscape)]:h-5" />}
        color="gold"
        title="The Deal: Memorise!"
        steps={[
          'Each player receives 5 cards: 4 are shown face up briefly, then hidden. One card stays hidden the whole time.',
          'The hidden card is always your last card (rightmost).',
          'Memorise your cards and your opponents\' before they flip face down.',
          'You have 20-45 seconds (more players = more time): then betting begins.',
        ]}
      />

      {/* Section: Antes & Betting */}
      <RuleSection
        icon={<Coins className="w-4 h-4 [@media(orientation:landscape)]:w-5 [@media(orientation:landscape)]:h-5" />}
        color="blue"
        title="Antes & Betting"
        steps={[
          'Before cards are dealt, everyone antes 5 points into the pot — your compulsory first contribution to the round.',
          'The pot is the shared prize pool: every ante, bet, and call flows into it and it keeps growing throughout the round.',
          'You can check, bet, call, raise, or fold during each betting round.',
          'The maximum any player can bet per round is 20 points total.',
          'The moment a player reaches 20, that betting round ends immediately.',
          'The winner of each round claims the entire pot, adding those points directly to their stack.',
        ]}
      />

      {/* Section: The Draw */}
      <RuleSection
        icon={<Shuffle className="w-4 h-4 [@media(orientation:landscape)]:w-5 [@media(orientation:landscape)]:h-5" />}
        color="teal"
        title="The Draw"
        steps={[
          'After the first betting round, you may discard up to 4 cards and draw new ones.',
          'All discarded cards are shown face up to every player: another memory moment.',
          'If you draw 2+ cards, the middle replacement card is shown to opponents.',
          'A single drawn card stays hidden: mystery kept!',
          'Stand pat (keep all 5) if you\'re happy with your hand.',
        ]}
      />

      {/* Section: Second Betting & Showdown */}
      <RuleSection
        icon={<Trophy className="w-4 h-4 [@media(orientation:landscape)]:w-5 [@media(orientation:landscape)]:h-5" />}
        color="gold"
        title="Second Betting & Showdown"
        steps={[
          'A second round of betting follows the draw, same rules apply.',
          'If only one player hasn\'t folded, they win the pot without a showdown.',
          'Otherwise all remaining players reveal their hands.',
          'Best poker hand wins the pot. Standard hand rankings apply.',
        ]}
      />

      {/* Section: Players & Scoring */}
      <RuleSection
        icon={<Users className="w-4 h-4 [@media(orientation:landscape)]:w-5 [@media(orientation:landscape)]:h-5" />}
        color="blue"
        title="Players & Scoring"
        steps={[
          '2 to 4 players per game.',
          'Each player starts with 200 points. The game tracks every player\'s total in real time.',
          'The current pot size is always visible so you know exactly what\'s at stake each round.',
          'Win pots to grow your stack. Lose all your points and you\'re out.',
          'Rounds continue until only one player has points left.',
        ]}
      />

      {/* Hand rankings quick ref */}
      <div className="rounded-2xl bg-white border border-black/[0.07] shadow-md px-4 py-4 [@media(orientation:landscape)]:px-5 [@media(orientation:landscape)]:py-5">
        <p className="font-display text-[11px] [@media(orientation:landscape)]:text-[13px] tracking-widest uppercase gold-text font-semibold mb-3">
          Hand Rankings (High → Low)
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 [@media(orientation:landscape)]:gap-y-2.5">
          {[
            ['Royal Flush', '🏆'],
            ['Straight Flush', '✨'],
            ['Four of a Kind', '4️⃣'],
            ['Full House', '🏠'],
            ['Flush', '♠'],
            ['Straight', '➡️'],
            ['Three of a Kind', '3️⃣'],
            ['Two Pair', '2️⃣'],
            ['One Pair', '1️⃣'],
            ['High Card', '🃏'],
          ].map(([name, emoji]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="text-base [@media(orientation:landscape)]:text-lg">{emoji}</span>
              <span className="text-[12px] [@media(orientation:landscape)]:text-[14px] text-gray-500 font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function RuleSection({
  icon, color, title, steps,
}: {
  icon: React.ReactNode;
  color: 'gold' | 'blue' | 'teal';
  title: string;
  steps: string[];
}) {
  const palette = {
    gold: {
      bg: 'bg-white',
      border: 'border-[color:var(--color-gold)]/30',
      icon: 'bg-[color:var(--color-gold)]/20 text-[color:var(--color-gold)]',
      dot: 'bg-[color:var(--color-gold)]',
      title: 'gold-text',
    },
    blue: {
      bg: 'bg-white',
      border: 'border-[color:var(--color-blue)]/25',
      icon: 'bg-[color:var(--color-blue)]/15 text-[color:var(--color-blue)]',
      dot: 'bg-[color:var(--color-blue)]',
      title: 'blue-text',
    },
    teal: {
      bg: 'bg-white',
      border: 'border-[color:var(--color-chip-teal)]/25',
      icon: 'bg-[color:var(--color-chip-teal)]/15 text-[color:var(--color-chip-teal)]',
      dot: 'bg-[color:var(--color-chip-teal)]',
      title: 'text-[color:var(--color-chip-teal)]',
    },
  }[color];

  return (
    <div className={`rounded-2xl border shadow-sm px-4 py-4 [@media(orientation:landscape)]:px-5 [@media(orientation:landscape)]:py-5 ${palette.bg} ${palette.border}`}>
      <div className="flex items-center gap-2.5 mb-3 [@media(orientation:landscape)]:mb-4">
        <div className={`w-7 h-7 [@media(orientation:landscape)]:w-9 [@media(orientation:landscape)]:h-9 rounded-xl grid place-items-center shrink-0 ${palette.icon}`}>
          {icon}
        </div>
        <h3 className={`font-display text-[12px] [@media(orientation:landscape)]:text-[14px] font-bold tracking-wide uppercase ${palette.title}`}>
          {title}
        </h3>
      </div>
      <ul className="space-y-2 [@media(orientation:landscape)]:space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 items-start">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[5px] [@media(orientation:landscape)]:mt-[6px] ${palette.dot}`} />
            <span className="text-[13px] [@media(orientation:landscape)]:text-[15px] text-gray-700 leading-relaxed">{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
