"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--ink)]/40"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full bg-[var(--sheet)] rounded-[var(--radius-lg)] border border-[var(--rule)]",
          "max-h-[90dvh] flex flex-col",
          sizeStyles[size]
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-[var(--rule)] shrink-0">
          <h2 className="font-semibold text-[var(--ink)]">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-3" />
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
