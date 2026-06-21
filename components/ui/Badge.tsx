import { cn } from "@/lib/utils";

interface BadgeProps {
  label: string;
  color?: string;        // hex colour for dot
  variant?: "default" | "success" | "warning" | "danger" | "muted";
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "bg-stone-100 text-stone-700",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  danger:  "bg-red-50 text-red-700",
  muted:   "bg-stone-100 text-stone-500",
};

export function Badge({ label, color, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </span>
  );
}
