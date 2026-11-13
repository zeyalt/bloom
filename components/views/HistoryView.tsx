"use client";

import { useState } from "react";
import { ClipboardList, Receipt } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Page } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/Segmented";
import AttendanceView from "@/components/views/AttendanceView";
import ExpensesView from "@/components/views/ExpensesView";

type Segment = "sessions" | "payments";

export default function HistoryView() {
  const [segment, setSegment] = useState<Segment>("sessions");
  // The switch is rendered by the embedded view, between the child pills and the filters.
  const tabs = (
    <Segmented
      ariaLabel="History view"
      value={segment}
      onChange={setSegment}
      options={[
        { value: "sessions", label: "Sessions", icon: ClipboardList },
        { value: "payments", label: "Payments", icon: Receipt },
      ]}
    />
  );

  return (
    <Page>
      <Header title="History" subtitle={null} />
      {segment === "sessions" ? <AttendanceView embedded tabs={tabs} /> : <ExpensesView embedded tabs={tabs} />}
    </Page>
  );
}
