import { Flame, Sparkles, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CheckInData } from '../hooks/useDailyCheckIn';

const CYCLE_REWARDS = [50, 75, 100, 125, 150, 200, 500];

export function DailyCheckInModal({ data, onClose }: { data: CheckInData; onClose: () => void }) {
  const { cycle_day, checkin_streak, xp_earned, is_new_today } = data;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center
        px-4 py-safe
        bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative rounded-3xl overflow-hidden',
          'border border-[color:var(--color-gold)]/40',
          'shadow-[0_24px_70px_rgba(0,0,0,0.6)]',
          'animate-in zoom-in-95 slide-in-from-bottom-4 duration-300',
          'bg-[radial-gradient(ellipse_at_top_left,oklch(0.26_0.09_150)_0%,oklch(0.13_0.05_150)_100%)]',
          // Portrait: narrow card, full vertical
          'w-full max-w-[340px]',
          // Landscape: wide two-column card, capped height
          'landscape:max-w-[600px] landscape:flex landscape:flex-row landscape:max-h-[90dvh]',
        )}
      >
        {/* Felt texture */}
        <div className="absolute inset-0 felt-surface opacity-[0.10] pointer-events-none" />

        {/* Glow — top-left in landscape, top-center in portrait */}
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full
          bg-[color:var(--color-gold)]/20 blur-3xl pointer-events-none" />

        {/* ── Close ── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 grid place-items-center rounded-full
            bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── LEFT COLUMN (portrait: top section · landscape: left column) ── */}
        <div className={cn(
          'relative flex flex-col items-center',
          // Portrait: normal padding, centered
          'px-5 pt-7 pb-4',
          // Landscape: fixed width left column, vertically centered, more compact
          'landscape:w-[210px] landscape:shrink-0 landscape:px-5 landscape:py-5 landscape:justify-center landscape:pb-5',
          // Separator only in landscape
          'landscape:border-r landscape:border-white/10',
        )}>
          {/* Flame */}
          <div className="relative mb-3 landscape:mb-2">
            <div className={cn(
              'rounded-full grid place-items-center',
              'bg-gradient-to-b from-orange-400 to-orange-600',
              'shadow-[0_8px_28px_rgba(249,115,22,0.55)] border-2 border-orange-300/60',
              'animate-in zoom-in duration-500',
              'w-16 h-16 landscape:w-12 landscape:h-12',
            )}>
              <Flame className="w-8 h-8 landscape:w-6 landscape:h-6 text-white" fill="currentColor" />
            </div>
            <Sparkles className="absolute -right-1.5 -top-1.5 w-5 h-5 landscape:w-4 landscape:h-4
              text-[color:var(--color-gold)] drop-shadow" />
          </div>

          {/* Streak count */}
          <h2 className="font-display font-bold text-white tracking-wide text-center
            text-2xl landscape:text-xl">
            {checkin_streak} Day{checkin_streak === 1 ? '' : 's'}
          </h2>
          <p className="font-display tracking-[0.25em] uppercase text-[color:var(--color-gold)]
            text-[10px] landscape:text-[9px] mt-0.5">
            Daily Streak
          </p>

          {/* XP reward — in landscape lives here (left col), in portrait lives below the strip */}
          {is_new_today ? (
            <div className="mt-4 landscape:mt-3 flex flex-col items-center
              animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-display">
                Today's Reward
              </p>
              <span
                className="font-display font-black text-[color:var(--color-gold)] tabular-nums mt-0.5
                  text-3xl landscape:text-2xl"
                style={{ textShadow: '0 0 20px rgba(212,168,67,0.6)' }}
              >
                +{xp_earned} XP
              </span>
            </div>
          ) : (
            <p className="mt-3 text-[10px] landscape:text-[9px] text-white/55 text-center leading-relaxed px-1">
              Come back tomorrow to keep your streak alive!
            </p>
          )}
        </div>

        {/* ── RIGHT COLUMN (portrait: bottom section · landscape: right column) ── */}
        <div className={cn(
          'relative flex flex-col',
          'px-5 pb-5 pt-2 landscape:pt-5',
          'landscape:flex-1 landscape:justify-between',
        )}>
          {/* 7-day strip label */}
          <p className="font-display text-[8px] uppercase tracking-[0.2em] text-white/40 mb-2
            landscape:mt-0 text-center portrait:hidden landscape:block">
            Weekly Rewards
          </p>

          {/* 7-day reward strip */}
          <div className="w-full grid grid-cols-7 gap-1 landscape:gap-1.5">
            {CYCLE_REWARDS.map((reward, i) => {
              const day = i + 1;
              const isPast = day < cycle_day;
              const isToday = day === cycle_day;
              const isBig = day === 7;
              return (
                <div
                  key={day}
                  className={cn(
                    'relative flex flex-col items-center gap-1 rounded-xl border transition-all',
                    'py-1.5 px-0.5 landscape:py-2',
                    isToday
                      ? 'bg-[color:var(--color-gold)]/20 border-[color:var(--color-gold)] shadow-[0_0_14px_rgba(212,168,67,0.45)] scale-[1.05]'
                      : isPast
                        ? 'bg-white/10 border-white/20'
                        : 'bg-black/20 border-white/10 opacity-50',
                  )}
                >
                  <span className="text-[6px] landscape:text-[7px] font-display uppercase tracking-wide text-white/50 leading-none">
                    D{day}
                  </span>
                  <div className={cn(
                    'rounded-full grid place-items-center',
                    'w-4 h-4 landscape:w-5 landscape:h-5',
                    isPast
                      ? 'bg-green-500/25'
                      : isBig
                        ? 'bg-[color:var(--color-gold)]'
                        : 'bg-white/15',
                  )}>
                    {isPast ? (
                      <Check className="w-2.5 h-2.5 landscape:w-3 landscape:h-3 text-green-300" strokeWidth={3} />
                    ) : (
                      <Flame
                        className={cn(
                          'w-2.5 h-2.5 landscape:w-3 landscape:h-3',
                          isBig ? 'text-black' : 'text-[color:var(--color-gold)]',
                        )}
                        fill="currentColor"
                      />
                    )}
                  </div>
                  <span className="text-[7px] landscape:text-[8px] font-bold text-white/85 tabular-nums leading-none">
                    +{reward}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Collect button */}
          <button
            onClick={onClose}
            className="mt-4 landscape:mt-3 w-full h-11 landscape:h-10 rounded-xl
              font-display tracking-wider uppercase text-[12px] font-bold
              bg-gradient-to-b from-[color:var(--color-gold)] to-[oklch(0.62_0.13_75)]
              text-black border border-black/10 shadow-[0_5px_18px_rgba(212,168,67,0.35)]
              active:scale-[0.98] transition-all"
          >
            {is_new_today ? 'Collect' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
