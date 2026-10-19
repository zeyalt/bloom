"use client";

import { useState } from "react";
import { ClipboardList, Receipt } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import AttendanceView from "@/components/views/AttendanceView";
import ExpensesView from "@/components/views/ExpensesView";

type Segment = "sessions" | "payments";

function SegmentedControl({ value, onChange }: { value: Segment; onChange: (v: Segment) => void }) {
  const options: { value: Segment; label: string; icon: typeof ClipboardList }[] = [
    { value: "sessions", label: "Sessions", icon: ClipboardList },
    { value: "payments", label: "Payments", icon: Receipt },
  ];
  return (
    <div className="inline-flex border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-md)]">
      {options.map(({ value: v, label, icon: Icon }, i) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium cursor-pointer",
            i > 0 && "border-l border-[var(--rule)]",
            value === v ? "bg-[var(--ink)] text-[var(--sheet)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
          )}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

export default function HistoryView() {
  const [segment, setSegment] = useState<Segment>("sessions");

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      <Header
        title="History"
        subtitle="Sessions & payments"
        action={<SegmentedControl value={segment} onChange={setSegment} />}
      />
      {segment === "sessions" ? <AttendanceView embedded /> : <ExpensesView embedded />}
    </div>
  );
}
