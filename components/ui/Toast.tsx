"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

export function Toast({ message, type = "info", duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const icons = {
    success: <Check size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
  };

  const styles = {
    success: "bg-[var(--accent-success)] text-white",
    error: "bg-[var(--accent-danger)] text-white",
    info: "bg-[var(--accent-primary)] text-white",
  };

  return (
    <div
      className={cn(
        "fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm",
        "px-5 py-4 rounded-xl shadow-lg flex items-center gap-3",
        "animate-in slide-in-from-bottom-4 duration-300 ease-out",
        styles[type]
      )}
    >
      {icons[type]}
      <span className="text-sm font-medium flex-1">{message}</span>
      <button
        onClick={() => setIsVisible(false)}
        className="p-1 hover:opacity-80 transition-opacity"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Toast context for global access
import { createContext, ReactNode } from "react";

export const ToastContext = createContext<
  ((message: string, type?: ToastType, duration?: number) => void) | null
>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType; duration?: number }>>([]);

  const showToast = (message: string, type: ToastType = "info", duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-50">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto"
            onAnimationEnd={() => {
              setToasts(prev => prev.filter(t => t.id !== toast.id));
            }}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

import React from "react";
