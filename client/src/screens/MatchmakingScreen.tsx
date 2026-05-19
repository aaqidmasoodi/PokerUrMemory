import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
      className="h-dvh flex flex-col [@media(orientation:landscape)]:flex-row items-center justify-center bg-transparent overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />

      {!timedOut ? (
        <>
          {/* Left / Top — Animation */}
          <div className="relative flex items-center justify-center
            py-8 [@media(orientation:landscape)]:py-0
            [@media(orientation:landscape)]:flex-1 [@media(orientation:landscape)]:h-full
            [@media(orientation:landscape)]:border-r [@media(orientation:landscape)]:border-black/[0.07]">
            <div className="relative flex items-center justify-center w-28 h-28">
              <div className="absolute inset-0 rounded-full border-2 border-[color:var(--color-blue)]/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-[color:var(--color-blue)]/30 animate-ping" style={{ animationDelay: '0.3s' }} />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] flex items-center justify-center shadow-lg">
                <span className="text-white text-3xl">♠</span>
              </div>
            </div>
          </div>

          {/* Right / Bottom — Status */}
          <div className="relative flex flex-col items-center gap-5 w-full max-w-xs px-6
            pb-10 [@media(orientation:landscape)]:pb-0
            [@media(orientation:landscape)]:flex-1 [@media(orientation:landscape)]:justify-center">

            <div className="text-center">
              <h2 className="font-display text-xl font-bold blue-text">
                Finding Players{'.'.repeat(dots)}
              </h2>
              <p className="text-xs text-gray-300 mt-1">Waiting for another player to join</p>
            </div>

            <div className="w-full">
              <div className="w-full h-1.5 bg-black/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[color:var(--color-blue)] transition-all duration-1000 ease-linear"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px] text-gray-300">{elapsed}s elapsed</p>
                <p className="text-[10px] text-gray-300">{Math.max(0, TIMEOUT_SECS - elapsed)}s remaining</p>
              </div>
            </div>

            <button
              onClick={onCancel}
              className="flex items-center gap-2 text-xs text-gray-300 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel search
            </button>
          </div>
        </>
      ) : (
        <div className="relative flex flex-col items-center gap-5 w-full max-w-xs text-center px-6">
          <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center text-4xl">
            😔
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">No Match Found</h2>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">
              We couldn't find other players right now. Try again in a moment!
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-full h-13 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow active:scale-[0.97] transition-transform"
          >
            Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}
