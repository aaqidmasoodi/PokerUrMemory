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
  xs: { rank: "text-[9px] sm:text-[11px]",  suit: "text-[10px] sm:text-[12px]" },
  sm: { rank: "text-[13px] sm:text-[16px]", suit: "text-[15px] sm:text-[18px]" },
  md: { rank: "text-[16px] sm:text-[20px]", suit: "text-[18px] sm:text-[22px]" },
  lg: { rank: "text-[20px] sm:text-[24px]", suit: "text-[22px] sm:text-[27px]" },
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
  const showFace = faceUp && !!card;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative shrink-0 rounded-md transition-all duration-300 ease-out",
        sizeMap[size],
        selected && "-translate-y-3 ring-2 ring-[color:var(--color-gold)]",
        highlight && "pulse-gold",
        onClick && "cursor-pointer hover:-translate-y-1",
        className,
      )}
      style={{ perspective: "600px" }}
    >
      {/* 3-D flip wrapper — rotates on the Y axis */}
      <div
        className="absolute inset-0 rounded-md"
        style={{
          transformStyle: "preserve-3d",
          transform: showFace ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* BACK face — visible when face-down */}
        <div
          className="card-back absolute inset-0 rounded-md flex items-center justify-center"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as React.CSSProperties}
        >
          <div className="w-1/2 h-1/2 rounded-full border border-[color:var(--color-gold)]/60 flex items-center justify-center">
            <span className="font-display gold-text text-[0.9em] font-bold">P</span>
          </div>
        </div>

        {/* FRONT face — visible when face-up (counter-rotated 180°) */}
        <div
          className="card-face absolute inset-0 flex flex-col items-center justify-center rounded-md overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          } as React.CSSProperties}
        >
          {card && (
            <>
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
            </>
          )}
        </div>
      </div>
    </button>
  );
}
