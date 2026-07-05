import { AlertCircle } from 'lucide-react';

/**
 * ConfirmModal – styled confirmation dialog that replaces window.confirm.
 *
 * Props:
 *   open       – boolean, whether to show the modal
 *   title      – modal heading (default: "Unsaved Changes")
 *   message    – main body text
 *   confirmLabel – confirm button text (default: "Discard Changes")
 *   cancelLabel – cancel button text (default: "Cancel")
 *   variant    – 'warning' (amber, default) or 'danger' (red) for the icon/button style
 *   onConfirm  – called when user clicks confirm
 *   onCancel   – called when user clicks cancel or the backdrop
 *   loading    – show spinner on confirm button (default: false)
 */
export default function ConfirmModal({
  open,
  title = 'Unsaved Changes',
  message,
  confirmLabel = 'Discard Changes',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  const isWarning = variant === 'warning';
  const iconBg = isWarning ? 'bg-amber-100' : 'bg-red-100';
  const iconColor = isWarning ? 'text-amber-600' : 'text-red-600';
  // Confirm button is always destructive regardless of variant
  const btnClass = 'btn-danger';

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/50" onClick={onCancel} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${iconBg} ${iconColor} shrink-0`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="pt-0.5">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {message && (
                <p className="text-sm text-gray-600 mt-1">{message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onCancel} className="btn-secondary">
              {cancelLabel}
            </button>
            <button onClick={onConfirm} disabled={loading} className={btnClass}>
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
