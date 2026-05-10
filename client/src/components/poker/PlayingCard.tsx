import { cn } from "@/lib/utils";

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";

export interface CardData {
  rank: Rank;
  suit: Suit;
}

interface PlayingCardProps {
  card?: CardData;
  faceUp?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeMap = {
  xs: "w-5 h-7 text-[5px] sm:w-6 sm:h-9 sm:text-[6px] lg:w-12 lg:h-16 lg:text-[9px]",
  sm: "w-7 h-10 text-[6px] sm:w-8 sm:h-11 sm:text-[7px] lg:w-16 lg:h-24 lg:text-sm",
  md: "w-10 h-14 text-[9px] sm:w-12 sm:h-18 sm:text-[11px] lg:w-20 lg:h-30 lg:text-base",
  lg: "w-12 h-18 text-[11px] sm:w-18 sm:h-26 sm:text-xs lg:w-28 lg:h-40 lg:text-lg",
};

export function PlayingCard({
  card,
  faceUp = false,
  size = "md",
  selected = false,
  highlight = false,
  onClick,
  className,
}: PlayingCardProps) {
  const isRed = card?.suit === "♥" || card?.suit === "♦";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative shrink-0 rounded-md overflow-hidden transition-all duration-300 ease-out",
        sizeMap[size],
        selected && "-translate-y-3 ring-2 ring-[color:var(--color-gold)]",
        highlight && "pulse-gold",
        onClick && "cursor-pointer hover:-translate-y-1",
        className,
      )}
      style={{ perspective: 1000 }}
    >
      {faceUp && card ? (
        <div className="card-face absolute inset-0 flex flex-col rounded-md p-1 sm:p-1.5 overflow-hidden">
          <div
            className={cn(
              "flex flex-col items-start leading-none font-display font-bold",
              isRed ? "text-[oklch(0.5_0.22_25)]" : "text-[oklch(0.18_0.03_150)]",
            )}
          >
            <span>{card.rank || (card as any).value}</span>
            <span className="text-[1.1em]">{card.suit}</span>
          </div>
          <div
            className={cn(
              "flex-1 flex items-center justify-center text-[2em]",
              isRed ? "text-[oklch(0.5_0.22_25)]" : "text-[oklch(0.18_0.03_150)]",
            )}
          >
            {card.suit}
          </div>
          <div
            className={cn(
              "flex flex-col items-end leading-none font-display font-bold rotate-180",
              isRed ? "text-[oklch(0.5_0.22_25)]" : "text-[oklch(0.18_0.03_150)]",
            )}
          >
            <span>{card.rank || (card as any).value}</span>
            <span className="text-[1.1em]">{card.suit}</span>
          </div>
        </div>
      ) : (
        <div className="card-back absolute inset-0 rounded-md flex items-center justify-center">
          <div className="w-1/2 h-1/2 rounded-full border border-[color:var(--color-gold)]/60 flex items-center justify-center">
            <span className="font-display gold-text text-[0.9em] font-bold">P</span>
          </div>
        </div>
      )}
    </button>
  );
}