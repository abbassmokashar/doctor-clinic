import { X } from 'lucide-react';

/**
 * MultiTabForm – bottom-panel form with multiple tabs.
 *
 * Each tab is: { id, title, form, initialForm, type, recordId, submitting }
 *   - initialForm is a deep snapshot of the form when the tab was first opened.
 *   - If the current form differs from initialForm, an unsaved dot appears.
 *
 * Props:
 *   tabs        – Array of tab objects (each has .form, .title, etc.)
 *   activeId    – ID of the active tab
 *   onSelect    – (id) => called when a tab header is clicked
 *   onClose     – (id) => called when a tab's X is clicked
 *   onFormChange – (id, updatedForm) => called when the form data changes
 *   renderForm  – (tab) => JSX, renders the form body for the active tab
 *   onSubmit    – (tab) => Promise, called on form submit
 *   submitLabel – label for the submit button
 *   submitting  – whether the active tab is currently submitting
 */
export default function MultiTabForm({
  tabs,
  activeId,
  onSelect,
  onClose,
  onFormChange,
  renderForm,
  onSubmit,
  submitLabel = 'Save',
  submitting,
}) {
  if (!tabs || tabs.length === 0) return null;

  const active = tabs.find((t) => t.id === activeId);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col">
      {/* Tab bar */}
      <div className="flex items-end gap-0 px-4 overflow-x-auto" style={{ backgroundColor: 'transparent' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors whitespace-nowrap max-w-[200px] ${
                isActive
                  ? 'bg-white text-gray-900 border-gray-200 shadow-sm'
                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {/* Unsaved changes dot */}
              {tab.initialForm && JSON.stringify(tab.form) !== JSON.stringify(tab.initialForm) && (
                <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
              )}
              <span className="truncate">{tab.title || 'New'}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className="p-0.5 rounded hover:bg-gray-200 transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Form panel */}
      <div className="bg-white border-t border-gray-200 shadow-xl max-h-[70vh] overflow-y-auto">
        {active && (
          <div className="p-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (onSubmit) await onSubmit(active);
              }}
            >
              {renderForm(active, (updatedForm) => onFormChange(active.id, updatedForm))}

              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    submitLabel
                  )}
                </button>
                <button type="button" onClick={() => onClose(active.id)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
