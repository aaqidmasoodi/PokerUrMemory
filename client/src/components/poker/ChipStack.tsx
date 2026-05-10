import { cn } from "@/lib/utils";

interface ChipStackProps {
  amount: number;
  variant?: "red" | "blue" | "black" | "gold";
  className?: string;
}

const variantVar: Record<NonNullable<ChipStackProps["variant"]>, string> = {
  red: "var(--color-chip-red)",
  blue: "var(--color-chip-blue)",
  black: "var(--color-chip-black)",
  gold: "var(--color-gold)",
};

export function ChipStack({ amount, variant = "red", className }: ChipStackProps) {
  const stackHeight = Math.min(6, Math.max(1, Math.ceil(Math.log2(Math.max(2, amount / 25)))));

  return (
    <div className={cn("flex items-end gap-2", className)}>
      <div className="relative w-9 h-9">
        {Array.from({ length: stackHeight }).map((_, i) => (
          <div
            key={i}
            className="chip absolute left-0 w-9 h-9"
            style={
              {
                bottom: `${i * 4}px`,
                ["--chip-c" as string]: variantVar[variant],
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <span className="font-display font-bold text-sm gold-text">${amount.toLocaleString()}</span>
    </div>
  );
}