import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary:   "bg-[var(--accent-primary)] text-white hover:bg-[#0052a3] active:opacity-90 shadow-sm hover:shadow-md",
  secondary: "bg-white text-[var(--accent-primary)] border border-[var(--border)] hover:bg-[var(--bg-secondary)]",
  ghost:     "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
  danger:    "bg-[var(--accent-danger)] bg-opacity-10 text-[var(--accent-danger)] border border-[var(--accent-danger)] border-opacity-20 hover:bg-opacity-20",
};

const sizeStyles = {
  sm: "px-3 py-2 text-sm rounded-[6px] gap-1.5 font-medium min-h-9",
  md: "px-4 py-2.5 text-sm rounded-[8px] gap-2 font-medium min-h-10",
  lg: "px-5 py-3 text-base rounded-[8px] gap-2 font-medium min-h-11",
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
        "inline-flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
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
