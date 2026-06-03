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
        paddingLeft:   'env(safe-area-inset-left, 0px)',
        paddingRight:  'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="pum-header relative shrink-0 z-10 flex items-center gap-2
        px-4 sm:px-6 lg:px-14 xl:px-20 2xl:px-32">
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
          <p className="font-display text-[11px] tracking-[0.3em] uppercase text-white font-semibold">
            Play vs Computer
          </p>
        </div>
        <div className="w-[68px] shrink-0" />
      </div>

      {/* ── Body ───────────────────────────────────────────────────
          Portrait mobile : single column, compact
          Landscape       : two columns (phone turned sideways)
          Desktop lg+     : two columns, centred vertically        */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden
        px-4 sm:px-6 landscape:px-8 lg:px-14 xl:px-20 2xl:px-32
        pb-3 landscape:pb-4 lg:pb-0
        flex flex-col landscape:flex-row lg:flex-row lg:items-center
        landscape:gap-6 lg:gap-10 xl:gap-14 2xl:gap-20
        pt-2 landscape:pt-3 lg:pt-0">

        {/* ── Left: Difficulty ─────────────────────────────────── */}
        <div className="flex flex-col
          landscape:flex-1 lg:flex-1
          landscape:border-r landscape:border-white/10 landscape:pr-6
          lg:border-r lg:border-white/10 lg:pr-10 xl:pr-14 2xl:pr-20">

          <p className="font-display tracking-[0.28em] uppercase text-white/45 mb-2
            text-[9px] lg:text-[11px] xl:text-[13px] 2xl:text-[15px]
            lg:mb-4 xl:mb-5 2xl:mb-6">
            Difficulty
          </p>

          <div className="flex flex-col gap-2 landscape:gap-2
            lg:gap-3 xl:gap-4 2xl:gap-5">
            {DIFFICULTIES.map(d => {
              const Icon = d.icon;
              const selected = difficulty === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  disabled={starting}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all
                    active:scale-[0.98] disabled:opacity-50 border
                    landscape:rounded-2xl landscape:px-4 landscape:py-3
                    lg:rounded-2xl lg:px-5 lg:py-4 xl:px-6 xl:py-5 2xl:px-7 2xl:py-5
                    ${selected
                      ? `${d.selectedBg} ${d.ring}`
                      : 'bg-white/[0.06] border-white/10 hover:bg-white/[0.09]'
                    }`}
                >
                  <div className={`rounded-lg grid place-items-center shrink-0 transition-colors
                    w-8 h-8 landscape:w-9 landscape:h-9 lg:w-11 lg:h-11 xl:w-13 xl:h-13 2xl:w-16 2xl:h-16
                    lg:rounded-xl
                    ${selected ? 'bg-white' : 'bg-white/10'}`}>
                    <Icon className={`w-4 h-4 landscape:w-5 landscape:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 2xl:w-8 2xl:h-8
                      ${selected ? d.selectedIcon : 'text-white/55'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-display font-bold leading-none
                      text-[12px] landscape:text-[13px] lg:text-[16px] xl:text-[19px] 2xl:text-[22px]
                      ${selected ? d.selectedText : 'text-white'}`}>
                      {d.label}
                    </p>
                    <p className={`mt-0.5 leading-snug
                      text-[10px] landscape:text-[10px] lg:text-[12px] xl:text-[13px] 2xl:text-[15px]
                      ${selected ? d.selectedDesc : 'text-white/40'}`}>
                      {d.desc}
                    </p>
                  </div>
                  {selected && (
                    <div className={`rounded-full grid place-items-center shrink-0 ${d.dot}
                      w-4 h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6`}>
                      <Check className="w-2.5 h-2.5 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Opponents + Start ──────────────────────────── */}
        <div className="flex flex-col justify-between
          landscape:flex-1 lg:flex-1
          mt-3 landscape:mt-0 lg:mt-0">

          <p className="font-display tracking-[0.28em] uppercase text-white/45 mb-2
            text-[9px] landscape:text-[9px] lg:text-[11px] xl:text-[13px] 2xl:text-[15px]
            lg:mb-4 xl:mb-5 2xl:mb-6">
            Opponents
          </p>

          <div className="grid grid-cols-3 gap-2 landscape:gap-3 lg:gap-4 xl:gap-6 2xl:gap-8">
            {[1, 2, 3].map(n => {
              const selected = bots === n;
              return (
                <button
                  key={n}
                  onClick={() => setBots(n)}
                  disabled={starting}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all
                    active:scale-[0.97] disabled:opacity-50 border
                    py-3 landscape:py-4 lg:py-6 xl:py-8 2xl:py-10
                    lg:rounded-2xl
                    ${selected
                      ? 'bg-white border-[color:var(--color-blue)] ring-2 ring-[color:var(--color-blue)]/30 shadow-md'
                      : 'bg-white/[0.06] border-white/10 hover:bg-white/[0.09]'
                    }`}
                >
                  <div className="flex -space-x-1 landscape:-space-x-1.5 lg:-space-x-2 xl:-space-x-3">
                    {Array.from({ length: n }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full grid place-items-center border-[1.5px] lg:border-2
                          w-5 h-5 landscape:w-6 landscape:h-6 lg:w-9 lg:h-9 xl:w-11 xl:h-11 2xl:w-14 2xl:h-14
                          ${selected
                            ? 'bg-[color:var(--color-blue)] border-white'
                            : 'bg-white/15 border-[oklch(0.2_0.06_148)]'
                          }`}
                      >
                        <Bot className={`w-2.5 h-2.5 landscape:w-3 landscape:h-3 lg:w-5 lg:h-5 xl:w-6 xl:h-6 2xl:w-7 2xl:h-7
                          ${selected ? 'text-white' : 'text-white/55'}`} />
                      </div>
                    ))}
                  </div>
                  <span className={`font-display font-bold leading-none
                    text-[10px] landscape:text-[11px] lg:text-[14px] xl:text-[16px] 2xl:text-[19px]
                    ${selected ? 'text-gray-800' : 'text-white/65'}`}>
                    {n} {n === 1 ? 'Bot' : 'Bots'}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-white/30 px-0.5 mt-1.5 lg:mt-3 xl:mt-4
            text-[9.5px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]">
            You + {bots} {bots === 1 ? 'opponent' : 'opponents'} · {bots + 1}-seat table · no stats recorded
          </p>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30
              px-3 py-2 lg:px-4 lg:py-3 xl:px-5 xl:py-4
              text-[11px] lg:text-[13px] xl:text-[14px] text-red-200 leading-snug mt-2 lg:mt-3">
              {error}
            </div>
          )}

          {/* Start */}
          <div className="mt-4 lg:mt-5 xl:mt-6 2xl:mt-8">
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full rounded-2xl font-display tracking-[0.15em] uppercase font-bold
                h-11 landscape:h-10 lg:h-14 xl:h-16 2xl:h-20
                text-[12px] lg:text-[14px] xl:text-[16px] 2xl:text-[19px]
                bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]
                text-white border border-black/10
                shadow-[0_4px_20px_rgba(0,0,0,0.25)] lg:shadow-[0_8px_30px_rgba(0,0,0,0.3)]
                hover:brightness-110 active:scale-[0.98] transition-all disabled:active:scale-100
                flex items-center justify-center gap-2 lg:gap-3"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 animate-spin" />
                  Dealing you in…
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6" />
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
