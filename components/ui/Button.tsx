import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary:   "bg-[var(--ink)] text-[var(--sheet)] hover:bg-[var(--stem)]",
  secondary: "bg-transparent text-[var(--ink)] border border-[var(--rule)] hover:bg-[var(--bg-secondary)]",
  ghost:     "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg-secondary)]",
  danger:    "text-[var(--margin)] border border-[var(--margin)]/30 hover:bg-[var(--margin)]/8",
};

const sizeStyles = {
  sm: "px-3 py-2 text-sm rounded-[var(--radius-md)] gap-1.5 font-medium min-h-9",
  md: "px-4 py-2.5 text-sm rounded-[var(--radius-md)] gap-2 font-medium min-h-10",
  lg: "px-5 py-3 text-base rounded-[var(--radius-md)] gap-2 font-medium min-h-11",
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
        "inline-flex items-center justify-center active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer",
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
