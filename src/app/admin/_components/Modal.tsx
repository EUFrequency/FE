"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
};

export function Modal({ open, onClose, children, widthClassName = "max-w-2xl" }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${widthClassName} rounded-2xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-950`}
      >
        {children}
      </div>
    </div>
  );
}
