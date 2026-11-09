"use client";

import { Modal, btnDanger, btnGhost } from "./ui";

/** In-page confirmation (no native dialogs). */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "নিশ্চিত করুন",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="mb-5 text-sm text-sub">{message}</p>
      <div className="flex justify-end gap-2">
        <button className={btnGhost} onClick={onClose}>
          বাতিল
        </button>
        <button
          className={btnDanger}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
