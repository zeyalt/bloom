import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "orange" | "warning" | "error";
  className?: string;
}

const colorStyles = {
  blue: "bg-[var(--color-blue-light)] text-[var(--accent-primary)]",
  green: "bg-[var(--color-green-light)] text-[var(--color-green)]",
  orange: "bg-orange-100 text-orange-600",
  warning: "bg-amber-100 text-amber-600",
  error: "bg-red-100 text-red-600",
};

export function StatCard({
  label,
  value,
  icon,
  color = "blue",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "p-5 md:p-6 rounded-[10px] border border-[var(--border)] bg-white hover:shadow-md transition-all duration-200 group",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
            {label}
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {value}
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              "p-2.5 rounded-[8px] shrink-0 group-hover:scale-105 transition-transform duration-200",
              colorStyles[color]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
