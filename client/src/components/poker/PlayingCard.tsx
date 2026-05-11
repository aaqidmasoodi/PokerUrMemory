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
  xs: "w-5 h-[28px] sm:w-6 sm:h-9",
  sm: "w-8 h-[46px] sm:w-11 sm:h-16",
  md: "w-10 h-14 sm:w-14 sm:h-20",
  lg: "w-12 h-[70px] sm:w-[72px] sm:h-[100px]",
};

const textSizes: Record<"xs" | "sm" | "md" | "lg", { rank: string; suit: string }> = {
  xs: { rank: "text-[5px] sm:text-[6px]",   suit: "text-[6px] sm:text-[7px]"   },
  sm: { rank: "text-[9px] sm:text-[12px]",  suit: "text-[11px] sm:text-[14px]" },
  md: { rank: "text-[12px] sm:text-[15px]", suit: "text-[14px] sm:text-[17px]" },
  lg: { rank: "text-[15px] sm:text-[18px]", suit: "text-[17px] sm:text-[20px]" },
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
  const { rank: rankClass, suit: suitClass } = textSizes[size];

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
        <div className="card-face absolute inset-0 flex flex-col items-start justify-start rounded-md p-[3px] overflow-hidden">
          <span className={cn(
            "font-display font-black leading-none",
            rankClass,
            isRed ? "text-[oklch(0.5_0.22_25)]" : "text-[oklch(0.18_0.03_150)]",
          )}>
            {card.rank || (card as any).value}
          </span>
          <span className={cn(
            "font-display font-bold leading-none",
            suitClass,
            isRed ? "text-[oklch(0.5_0.22_25)]" : "text-[oklch(0.18_0.03_150)]",
          )}>
            {card.suit}
          </span>
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
