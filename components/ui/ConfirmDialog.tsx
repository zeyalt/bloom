"use client";

// An in-app "are you sure?" for deletes that can't be undone (a whole goal, a calendar).
// Replaces the browser's own confirm box, which shows the site address as its title.
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", busy, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm leading-5 text-[var(--ink-soft)]">{message}</p>
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
