import { cn } from "@/lib/utils";

interface ChipStackProps {
  amount: number;
  variant?: "red" | "blue" | "black" | "gold";
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
}

const variantVar: Record<NonNullable<ChipStackProps["variant"]>, string> = {
  red:   "var(--color-chip-red)",
  blue:  "var(--color-chip-blue)",
  black: "var(--color-chip-black)",
  gold:  "var(--color-gold)",
};

const sizeConfig = {
  sm: { chip: "w-6 h-6", offset: 3, text: "text-xs"  },
  md: { chip: "w-9 h-9", offset: 4, text: "text-sm"  },
};

export function ChipStack({ amount, variant = "red", size = "md", className, showLabel = true }: ChipStackProps) {
  const cfg = sizeConfig[size];
  const stackHeight = Math.min(6, Math.max(1, Math.ceil(Math.log2(Math.max(2, amount / 25)))));

  return (
    <div className={cn("flex items-end gap-2", className)}>
      <div className={cn("relative shrink-0", cfg.chip)}>
        {Array.from({ length: stackHeight }).map((_, i) => (
          <div
            key={i}
            className={cn("chip absolute left-0", cfg.chip)}
            style={
              {
                bottom: `${i * cfg.offset}px`,
                ["--chip-c" as string]: variantVar[variant],
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      {showLabel && (
        <span className={cn("font-display font-bold gold-text", cfg.text)}>
          ${amount.toLocaleString()}
        </span>
      )}
    </div>
  );
}
