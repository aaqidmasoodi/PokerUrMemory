import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

const TIMEOUT_SECS = 20;

export function MatchmakingScreen({
  timedOut,
  onCancel,
}: {
  timedOut: boolean;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const elapsedInterval = setInterval(() => setElapsed(e => e + 1), 1000);
    const dotsInterval = setInterval(() => setDots(d => (d % 3) + 1), 500);
    return () => {
      clearInterval(elapsedInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  const pct = Math.min((elapsed / TIMEOUT_SECS) * 100, 100);

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

      {/* Cancel pill — top left, red accent */}
      <div
        className="pum-header relative shrink-0"
        style={{
          paddingLeft: 'calc(0.75rem + env(safe-area-inset-left, 0px))',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          onClick={onCancel}
          className="flex items-center gap-1 h-10 pl-2 pr-4 rounded-full bg-white/90 backdrop-blur-sm border border-red-200 shadow-md active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-red-500" />
          <span className="font-display text-[12px] font-bold text-red-500 tracking-wider uppercase">
            {timedOut ? 'Back' : 'Cancel'}
          </span>
        </button>
      </div>

      {/* Main content — single centered stack at every size */}
      {!timedOut ? (
        <div className="relative flex-1 flex flex-col items-center justify-center gap-8 sm:gap-10 lg:gap-12 px-6 pb-10">

          {/* Pulse animation */}
          <div className="relative flex items-center justify-center w-28 h-28 lg:w-36 lg:h-36 xl:w-52 xl:h-52 2xl:w-64 2xl:h-64">
            <div className="absolute inset-0 rounded-full border-2 border-[color:var(--color-blue)]/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-[color:var(--color-blue)]/30 animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="w-20 h-20 lg:w-24 lg:h-24 xl:w-36 xl:h-36 2xl:w-44 2xl:h-44 rounded-full bg-gradient-to-br from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] flex items-center justify-center shadow-lg">
              <span className="text-white text-3xl lg:text-4xl xl:text-6xl 2xl:text-7xl">♠</span>
            </div>
          </div>

          {/* Status card */}
          <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md xl:max-w-xl 2xl:max-w-2xl bg-white/80 backdrop-blur-sm rounded-2xl border border-black/[0.07] shadow-lg px-6 py-6 lg:px-8 lg:py-7 xl:px-12 xl:py-10 2xl:px-16 2xl:py-12 flex flex-col gap-5 xl:gap-7 2xl:gap-9">
            <div className="text-center">
              <h2 className="font-display text-xl lg:text-2xl xl:text-4xl 2xl:text-5xl font-bold blue-text">
                Finding Players{'.'.repeat(dots)}
              </h2>
              <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500 mt-1 xl:mt-2">Waiting for another player to join</p>
            </div>

            <div className="w-full">
              <div className="w-full h-2 xl:h-3 2xl:h-4 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] transition-all duration-1000 ease-linear"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 xl:mt-2">
                <p className="text-[10px] lg:text-xs xl:text-sm 2xl:text-base text-gray-500">{elapsed}s elapsed</p>
                <p className="text-[10px] lg:text-xs xl:text-sm 2xl:text-base text-gray-500">{Math.max(0, TIMEOUT_SECS - elapsed)}s remaining</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-xs sm:max-w-sm bg-white/80 backdrop-blur-sm rounded-2xl border border-black/[0.07] shadow-lg px-6 py-8 lg:px-8 lg:py-10 flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-black/5 flex items-center justify-center text-4xl lg:text-5xl">
              😔
            </div>
            <div>
              <h2 className="font-display text-xl lg:text-2xl font-bold text-foreground">No Match Found</h2>
              <p className="text-sm lg:text-base text-gray-500 mt-2 leading-relaxed">
                We couldn't find other players right now. Try again in a moment!
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-full h-13 lg:h-14 xl:h-18 2xl:h-20 rounded-2xl font-display tracking-wider uppercase text-[11px] lg:text-[12px] xl:text-[15px] 2xl:text-[17px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow hover:brightness-110 active:scale-[0.97] transition-all"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
