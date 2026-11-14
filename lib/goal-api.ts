// Client-side writes for goals. Every write refreshes the single ["goals"] query.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export interface NewGoalInput {
  child_id: string;
  kind: "milestone" | "measured";
  title: string;
  target_date: string;
  unit?: string;
  target_value?: number;
  start_value?: number;
  start_date?: string;
  practice_task?: string | null;
  practice_days?: "school" | "holiday" | "any" | null;
}

/** `id` keeps an existing checkpoint (and its focus points); leave it out for a new one. */
export interface PlanCheckpointInput { id?: string; due_date: string; text: string; hit_date?: string | null }

export const goalApi = {
  create: (input: NewGoalInput) => send("/api/goals", "POST", input),
  update: (id: string, patch: Record<string, unknown>) => send(`/api/goals/${id}`, "PATCH", patch),
  remove: (id: string) => send(`/api/goals/${id}`, "DELETE"),
  savePlan: (id: string, checkpoints: PlanCheckpointInput[]) => send(`/api/goals/${id}/plan`, "PUT", { checkpoints }),
  draftPlan: (id: string, context: string, today: string) =>
    send(`/api/goals/${id}/draft-plan`, "POST", { context, today }) as Promise<{ checkpoints: { due_date: string; text: string }[] }>,
  setCheckpointHit: (id: string, hit_date: string | null) => send(`/api/goal-checkpoints/${id}`, "PATCH", { hit_date }),
  addFocus: (checkpointId: string, text: string) => send(`/api/goal-checkpoints/${checkpointId}/focus`, "POST", { text }),
  updateFocus: (id: string, patch: { text?: string; got_date?: string | null }) => send(`/api/goal-focus/${id}`, "PATCH", patch),
  removeFocus: (id: string) => send(`/api/goal-focus/${id}`, "DELETE"),
  addEntry: (goalId: string, entry: { date: string; note?: string; value?: number }) => send(`/api/goals/${goalId}/entries`, "POST", entry),
  updateEntry: (id: string, patch: { date?: string; note?: string | null; value?: number | null }) => send(`/api/goal-entries/${id}`, "PATCH", patch),
  removeEntry: (id: string) => send(`/api/goal-entries/${id}`, "DELETE"),
};

/** Returns a function that refetches goals after a write. */
export function useRefreshGoals() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: ["goals"] }), [qc]);
}
