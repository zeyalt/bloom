// Client reads and writes for school feedback (the Journal's "School" entries).
import { useQuery } from "@tanstack/react-query";
import type { SchoolNote } from "./types";

export const SCHOOL_NOTES_KEY = ["school-notes"] as const;

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

export function useSchoolNotes() {
  return useQuery({
    queryKey: SCHOOL_NOTES_KEY,
    queryFn: async (): Promise<SchoolNote[]> => {
      const res = await fetch("/api/school-notes");
      if (!res.ok) throw new Error("Failed to load school feedback");
      return res.json();
    },
  });
}

export interface SchoolNoteInput { child_id: string; date: string; source: string | null; text: string }

export const schoolNotesApi = {
  add: (input: SchoolNoteInput) => send("/api/school-notes", "POST", input) as Promise<SchoolNote>,
  update: (id: string, input: SchoolNoteInput) => send(`/api/school-notes/${id}`, "PATCH", input) as Promise<SchoolNote>,
  remove: (id: string) => send(`/api/school-notes/${id}`, "DELETE"),
};
