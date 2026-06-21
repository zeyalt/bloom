import { cn } from "@/lib/utils";

interface ActivityCardProps {
  childName: string;
  childEmoji: string;
  childColor: string;
  institution: string;
  category: string;
  categoryIcon?: string | null;
  date: string;
  duration?: string;
  status?: "attended" | "absent" | "pending";
  notes?: string;
  className?: string;
}

const statusStyles = {
  attended: {
    badge: "bg-green-100 text-green-700",
    label: "✓ Attended",
  },
  absent: {
    badge: "bg-red-100 text-red-700",
    label: "Absent",
  },
  pending: {
    badge: "bg-gray-100 text-gray-600",
    label: "Pending",
  },
};

export function ActivityCard({
  childName,
  childEmoji,
  childColor,
  institution,
  category,
  categoryIcon,
  date,
  duration,
  status = "pending",
  notes,
  className,
}: ActivityCardProps) {
  const statusStyle = statusStyles[status];

  return (
    <div
      className={cn(
        "border border-[var(--border)] rounded-[10px] p-4 bg-white hover:shadow-md transition-all duration-200",
        className
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="text-xl">{childEmoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {institution}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {childName} • {category}
            {categoryIcon && ` ${categoryIcon}`}
          </div>
        </div>
        <div className={cn("px-2 py-1 rounded-[6px] text-xs font-medium shrink-0 whitespace-nowrap", statusStyle.badge)}>
          {statusStyle.label}
        </div>
      </div>

      <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
        <span>{date}</span>
        {duration && (
          <>
            <span>•</span>
            <span>{duration}</span>
          </>
        )}
      </div>

      {notes && (
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          {notes}
        </p>
      )}
    </div>
  );
}
