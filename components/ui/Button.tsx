import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary:   "bg-[var(--stem)] text-[var(--sheet)] hover:bg-[#285f43]",
  secondary: "bg-transparent text-[var(--ink)] border border-[var(--rule)] hover:bg-[var(--bg-secondary)]",
  ghost:     "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg-secondary)]",
  danger:    "text-[var(--margin)] border border-[var(--margin)]/30 hover:bg-[var(--margin)]/8",
};

// Two heights only: 52px for primary/standalone buttons (md, lg) and 40px for
// compact secondary buttons (sm), whose tap zone is padded out to 48px.
const sizeStyles = {
  sm: "h-10 px-4 text-sm rounded-[var(--radius-md)] gap-2 font-medium relative before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
  md: "h-13 px-6 text-base rounded-[var(--radius-md)] gap-2 font-semibold",
  lg: "h-13 px-6 text-base rounded-[var(--radius-md)] gap-2 font-semibold",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center shrink-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}
