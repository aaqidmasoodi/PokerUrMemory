import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Bot, Sprout, Zap, Flame, Loader2, Check } from 'lucide-react';

export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTIES: {
  key: Difficulty;
  label: string;
  desc: string;
  icon: typeof Sprout;
  selectedBg: string;
  selectedText: string;
  selectedDesc: string;
  selectedIcon: string;
  ring: string;
  dot: string;
}[] = [
  {
    key: 'easy',
    label: 'Easy',
    desc: 'Passive · folds often, rarely bluffs',
    icon: Sprout,
    selectedBg: 'bg-emerald-50 border-emerald-400',
    selectedText: 'text-emerald-900',
    selectedDesc: 'text-emerald-600',
    selectedIcon: 'text-emerald-500',
    ring: 'ring-2 ring-emerald-400/30 shadow-md',
    dot: 'bg-emerald-500',
  },
  {
    key: 'medium',
    label: 'Medium',
    desc: 'Balanced · bets and calls sensibly',
    icon: Zap,
    selectedBg: 'bg-amber-50 border-amber-400',
    selectedText: 'text-amber-900',
    selectedDesc: 'text-amber-600',
    selectedIcon: 'text-amber-500',
    ring: 'ring-2 ring-amber-400/30 shadow-md',
    dot: 'bg-amber-500',
  },
  {
    key: 'hard',
    label: 'Hard',
    desc: 'Aggressive · bluffs and applies pressure',
    icon: Flame,
    selectedBg: 'bg-rose-50 border-rose-400',
    selectedText: 'text-rose-900',
    selectedDesc: 'text-rose-600',
    selectedIcon: 'text-rose-500',
    ring: 'ring-2 ring-rose-400/30 shadow-md',
    dot: 'bg-rose-500',
  },
];

export function PracticeSetupScreen({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (bots: number, difficulty: Difficulty) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [bots, setBots] = useState(1);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (safetyRef.current) clearTimeout(safetyRef.current); };
  }, []);

  const handleStart = () => {
    if (starting) return;
    setError(null);
    setStarting(true);
    onStart(bots, difficulty);
    safetyRef.current = setTimeout(() => {
      setStarting(false);
      setError("Couldn't start the table. Please try again.");
    }, 12000);
  };

  return (
    <div
      className="h-dvh flex flex-col bg-transparent overflow-hidden select-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none" />

      {/* Header */}
      <div className="pum-header relative shrink-0 z-10 flex items-center gap-2 px-4 landscape:px-8">
        <button
          onClick={onBack}
          disabled={starting}
          className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-white/10 border border-white/20
            backdrop-blur-sm active:scale-95 transition-transform shrink-0 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
          <span className="font-display text-[10px] font-bold text-white/70 tracking-widest uppercase">Back</span>
        </button>
        <div className="flex-1 flex justify-center pointer-events-none">
          <p className="font-display text-[11px] tracking-[0.3em] uppercase text-white font-semibold">Play vs Computer</p>
        </div>
        <div className="w-[68px] shrink-0" />
      </div>

      {/* Body — portrait: single column / landscape: two columns */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col landscape:flex-row gap-0 overflow-hidden
        px-4 landscape:px-8 pb-3 landscape:pb-4 pt-2 landscape:pt-2">

        {/* ── Left / top: Difficulty ─────────────────────────── */}
        <div className="flex flex-col landscape:flex-1 landscape:pr-5 landscape:border-r landscape:border-white/10">
          <p className="font-display text-[9px] tracking-[0.28em] uppercase text-white/45 mb-1.5 px-0.5">
            Difficulty
          </p>
          <div className="flex flex-col gap-1.5 landscape:gap-2 landscape:flex-1 landscape:justify-center">
            {DIFFICULTIES.map(d => {
              const Icon = d.icon;
              const selected = difficulty === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  disabled={starting}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all
                    active:scale-[0.98] disabled:opacity-50 border ${
                    selected
                      ? `${d.selectedBg} ${d.ring}`
                      : 'bg-white/[0.06] border-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 transition-colors ${
                    selected ? 'bg-white' : 'bg-white/10'
                  }`}>
                    <Icon className={`w-4 h-4 ${selected ? d.selectedIcon : 'text-white/55'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-display text-[12px] font-bold leading-none ${selected ? d.selectedText : 'text-white'}`}>
                      {d.label}
                    </p>
                    <p className={`text-[10px] mt-0.5 leading-snug ${selected ? d.selectedDesc : 'text-white/40'}`}>
                      {d.desc}
                    </p>
                  </div>
                  {selected && (
                    <div className={`w-4 h-4 rounded-full grid place-items-center shrink-0 ${d.dot}`}>
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right / bottom: Opponents + Start ────────────────── */}
        <div className="flex flex-col landscape:flex-1 landscape:pl-5 mt-3 landscape:mt-0">
          <p className="font-display text-[9px] tracking-[0.28em] uppercase text-white/45 mb-1.5 px-0.5">
            Opponents
          </p>

          <div className="grid grid-cols-3 gap-2 landscape:gap-2.5 landscape:flex-1">
            {[1, 2, 3].map(n => {
              const selected = bots === n;
              return (
                <button
                  key={n}
                  onClick={() => setBots(n)}
                  disabled={starting}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 landscape:py-4
                    transition-all active:scale-[0.97] disabled:opacity-50 border ${
                    selected
                      ? 'bg-white border-[color:var(--color-blue)] ring-2 ring-[color:var(--color-blue)]/30 shadow-md'
                      : 'bg-white/[0.06] border-white/10'
                  }`}
                >
                  <div className="flex -space-x-1">
                    {Array.from({ length: n }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full grid place-items-center border-[1.5px] ${
                          selected
                            ? 'bg-[color:var(--color-blue)] border-white'
                            : 'bg-white/15 border-[oklch(0.2_0.06_148)]'
                        }`}
                      >
                        <Bot className={`w-2.5 h-2.5 ${selected ? 'text-white' : 'text-white/55'}`} />
                      </div>
                    ))}
                  </div>
                  <span className={`font-display text-[10px] font-bold leading-none ${selected ? 'text-gray-800' : 'text-white/65'}`}>
                    {n} {n === 1 ? 'Bot' : 'Bots'}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[9.5px] text-white/30 px-0.5 mt-1.5">
            You + {bots} {bots === 1 ? 'opponent' : 'opponents'} · {bots + 1}-seat table · no stats recorded
          </p>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11px] text-red-200 leading-snug mt-2">
              {error}
            </div>
          )}

          {/* Start button — pushed to bottom in landscape */}
          <div className="landscape:flex-1 landscape:flex landscape:items-end mt-3 landscape:mt-2">
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full h-12 landscape:h-11 rounded-2xl font-display tracking-[0.15em] uppercase text-[12px] font-bold
                bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
                text-white border border-black/10 shadow-[0_4px_20px_rgba(0,0,0,0.25)]
                hover:brightness-110 active:scale-[0.98] transition-all disabled:active:scale-100
                flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Dealing you in…
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  Start Game
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
