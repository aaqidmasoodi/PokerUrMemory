import { ChevronLeft, Spade, Bot } from 'lucide-react';

export function QuickIntroScreen({
  onBack,
  onPlayWithHumans,
  onPracticeWithBot,
}: {
  onBack: () => void;
  onPlayWithHumans: () => void;
  onPracticeWithBot: () => void;
}) {
  return (
    <div
      className="h-dvh flex flex-col bg-transparent select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Back button */}
      <div
        className="pum-header shrink-0"
        style={{
          paddingLeft: 'calc(0.75rem + env(safe-area-inset-left, 0px))',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 h-10 pl-2 pr-4 rounded-full bg-white/90 backdrop-blur-sm border border-black/[0.08] shadow-md active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-[color:var(--color-blue)]" />
          <span className="font-display text-[12px] font-bold blue-text tracking-wider uppercase">
            Back
          </span>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-lg mx-auto px-6 sm:px-8 pt-4 pb-8 flex flex-col gap-6">

          {/* Title */}
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
              Quick Introduction
            </h1>
            <p className="text-xs sm:text-sm text-white/50 mt-1 tracking-widest uppercase font-display">
              PokerUrMemory · 5-Card Draw with a twist
            </p>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-4 text-white/80 text-sm sm:text-base leading-relaxed">
            <p>
              The key difference between <span className="text-white font-semibold">PokerUrMemory</span> and
              other poker games is that many cards dealt face up flip over after a brief moment: you
              must memorise them. Otherwise, the rules are based on <span className="text-white font-semibold">Five Card Draw</span> poker.
            </p>
            <p>
              Each player is dealt <span className="text-white font-semibold">4 of 5 cards face up</span> in
              the first round and can discard up to 4 cards, to be replaced by up to 4 new cards in
              the second round deal. <span className="text-white font-semibold">Tap the cards</span> you
              want to discard.
            </p>
            <p>
              Betting choices are shown on four buttons, prompted by voice, and are
              <span className="text-white font-semibold"> time-limited</span> by the on-screen clock.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onPlayWithHumans}
              className="flex-1 flex items-center justify-center gap-2.5
                h-14 rounded-2xl font-display tracking-wider uppercase
                bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
                text-white border border-black/10
                shadow-[0_6px_24px_rgba(0,0,0,0.25)]
                hover:brightness-110 active:scale-[0.97] transition-all"
            >
              <Spade className="w-5 h-5 shrink-0" />
              <span className="text-[13px] sm:text-sm font-bold">Play with Human</span>
            </button>
            <button
              onClick={onPracticeWithBot}
              className="flex-1 flex items-center justify-center gap-2.5
                h-14 rounded-2xl font-display tracking-wider uppercase
                bg-white text-[color:var(--color-blue)]
                border border-[color:var(--color-blue)]/25
                shadow-md hover:bg-white/90 active:scale-[0.97] transition-all"
            >
              <Bot className="w-5 h-5 shrink-0" />
              <span className="text-[13px] sm:text-sm font-bold">Practice with Bot</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
