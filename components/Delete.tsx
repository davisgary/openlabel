"use client";

import React from "react";
import { TbTrash } from "react-icons/tb";

interface DeleteModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

export function Delete({
  open,
  onConfirm,
  onCancel,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
}: DeleteModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 pb-44"
      onClick={onCancel}
    >
      <div
        className="bg-primary text-primary-foreground rounded-xl shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-primary-foreground/80">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-5 py-2 text-sm tracking-wide rounded-md border border-muted/30 font-semibold text-muted hover:bg-muted/10 transition duration-300 ease-in-out"
          >
            {cancelText}
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex items-center gap-2 px-5 py-2 text-sm tracking-wide rounded-md bg-red-600 font-semibold text-white hover:bg-red-700 transition duration-300 ease-in-out"
            >
              <TbTrash className="w-4 h-4" />
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}