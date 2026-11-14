"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { useSnackbar } from "@/components/ui/Snackbar";
import { inputCls, labelCls } from "@/components/goals/GoalFormModal";
import { SCHOOL_NOTES_KEY, schoolNotesApi } from "@/lib/school-notes-api";
import { cn } from "@/lib/utils";
import type { Child, SchoolNote } from "@/lib/types";

/**
 * Add or edit feedback from a child's regular school: who it's for, when, who it's from,
 * and what they said. Not tied to a class, so it lives in the Journal on its own.
 */
export function SchoolNoteModal({ open, onClose, childList, note, defaultChildId }: {
  open: boolean;
  onClose: () => void;
  childList: Child[];
  note?: SchoolNote;
  defaultChildId?: string;
}) {
  const qc = useQueryClient();
  const snack = useSnackbar();
  const [childId, setChildId] = useState(note?.child_id ?? defaultChildId ?? childList[0]?.id ?? "");
  const [date, setDate] = useState(note ? note.date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"));
  const [source, setSource] = useState(note?.source ?? "");
  const [text, setText] = useState(note?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: SCHOOL_NOTES_KEY });

  async function save() {
    if (!childId) { setError("Pick a child."); return; }
    if (!text.trim()) { setError("Write the feedback first."); return; }
    setSaving(true); setError("");
    try {
      const input = { child_id: childId, date, source: source.trim() || null, text: text.trim() };
      if (note) await schoolNotesApi.update(note.id, input);
      else await schoolNotesApi.add(input);
      await refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!note) return;
    setSaving(true);
    try {
      await schoolNotesApi.remove(note.id);
      await refresh();
      onClose();
      snack({ message: "School feedback removed", action: { label: "Undo", onClick: async () => {
        await schoolNotesApi.add({ child_id: note.child_id, date: note.date.slice(0, 10), source: note.source, text: note.text });
        await refresh();
      } } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={note ? "Edit school feedback" : "Add school feedback"}>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-[var(--margin)] bg-[var(--margin)]/8 px-3 py-2 rounded-[var(--radius-md)]">{error}</p>}
        <div>
          <span className={labelCls}>For</span>
          <ChildFilter single childList={childList} selected={childId ? [childId] : []} onToggle={setChildId} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <div>
            <label htmlFor="school-date" className={labelCls}>Date</label>
            <input id="school-date" type="date" value={date} max={format(new Date(), "yyyy-MM-dd")}
              onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="school-from" className={labelCls}>From <span className="font-normal">(optional)</span></label>
            <input id="school-from" value={source} onChange={e => setSource(e.target.value)} maxLength={120}
              placeholder="e.g. Mrs Tan, form teacher" className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="school-text" className={labelCls}>What the teacher said</label>
          <textarea id="school-text" rows={6} value={text} onChange={e => setText(e.target.value)} maxLength={5000}
            placeholder="Progress, behaviour, friendships, anything to work on at home…" className={cn(inputCls, "resize-y")} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={save} loading={saving}>{note ? "Save" : "Add feedback"}</Button>
        </div>
        {note && (
          <Button variant="danger" className="w-full" onClick={remove} disabled={saving}>
            <Trash2 size={16} aria-hidden="true" /> Remove
          </Button>
        )}
      </div>
    </Modal>
  );
}
