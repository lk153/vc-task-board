"use client";

import { useUi } from "@/store/ui-store";

/** Single toast at the bottom; sits above the FAB on mobile. */
export function ToastViewport() {
  const toast = useUi((s) => s.toast);
  const dismiss = useUi((s) => s.dismissToast);

  return (
    <div role="status" aria-label="Notifications" aria-live="polite" aria-atomic="true">
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-1/2 z-[70] flex min-h-[42px] max-w-[calc(100vw-32px)] -translate-x-1/2 animate-toast items-center gap-3 rounded-lg bg-toast py-[9px] pr-2.5 pl-4 text-[13.5px] whitespace-nowrap text-toast-fg shadow-pop desk:bottom-6"
        >
          <span className="truncate">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                dismiss();
              }}
              className="h-7 rounded px-2 text-[13.5px] font-semibold text-toast-accent outline-none focus-visible:shadow-focus"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
