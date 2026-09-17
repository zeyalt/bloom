import { cn } from "@/lib/utils";

interface BadgeProps {
  label: string;
  color?: string;
  variant?: "default" | "success" | "warning" | "danger" | "muted";
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "text-[var(--ink-soft)]",
  success: "text-[var(--stem)]",
  warning: "text-[var(--accent-warning)]",
  danger:  "text-[var(--margin)]",
  muted:   "text-[var(--ink-faint)]",
};

export function Badge({ label, color, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </span>
  );
}
