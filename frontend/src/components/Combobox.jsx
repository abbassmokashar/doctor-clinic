import { useMemo } from 'react';
import { Search, X } from 'lucide-react';

export default function Combobox({
  label,
  placeholder = 'Search...',
  items = [],
  value = '',
  onChange,
  search,
  onSearchChange,
  dropdownOpen,
  onDropdownOpenChange,
  inputRef,
  getDisplayValue,
  filterFn,
  renderItem,
  renderChip,
  renderEmpty,
  listId = 'combobox-list',
}) {
  const filtered = useMemo(() => {
    if (!filterFn || !search) return items;
    return filterFn(items, search.toLowerCase());
  }, [items, search, filterFn]);

  const selectedItem = value ? items.find((i) => String(i.id) === value) : null;

  const displayValue = selectedItem && getDisplayValue
    ? getDisplayValue(selectedItem)
    : search;

  const handleSelect = (item) => {
    onChange?.(String(item.id));
    onSearchChange?.('');
    onDropdownOpenChange?.(false);
  };

  const handleClear = () => {
    onChange?.('');
    onSearchChange?.('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {label && <label className="label">{label}</label>}
      {/* ── Input ── */}
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="w-full rounded-lg text-sm transition-all duration-150"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: value ? 'var(--primary-700)' : 'var(--text-body)',
            padding: '0.5rem 2rem 0.5rem 2rem',
            outline: 'none',
            fontWeight: value ? 500 : 400,
          }}
          value={value ? displayValue : search}
          onChange={(e) => {
            onSearchChange?.(e.target.value);
            onChange?.('');
            onDropdownOpenChange?.(true);
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-500)';
            e.currentTarget.style.boxShadow = '0 0 0 1px var(--primary-500)';
            onDropdownOpenChange?.(true);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
            setTimeout(() => onDropdownOpenChange?.(false), 180);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onDropdownOpenChange?.(false);
              e.currentTarget.blur();
            }
            if (e.key === 'ArrowDown' && dropdownOpen) {
              e.preventDefault();
              const list = document.getElementById(listId);
              if (list) {
                const first = list.querySelector('button');
                first?.focus();
              }
            }
          }}
        />
        {/* Clear / Deselect button */}
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/10 transition-colors"
            aria-label="Clear selection"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : search ? (
          <button
            type="button"
            onClick={() => { onSearchChange?.(''); inputRef.current?.focus(); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/10 transition-colors"
            aria-label="Clear search"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* ── Dropdown ── */}
      {dropdownOpen && !value && (
        <div
          id={listId}
          className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg shadow-lg"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            renderEmpty ? (
              renderEmpty(search)
            ) : (
              <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                {search ? `No results for "${search}"` : 'Start typing to search'}
              </div>
            )
          ) : (
            <>
              {filtered.slice(0, 20).map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-body)',
                    borderBottom: idx < Math.min(filtered.length, 20) - 1 ? '1px solid var(--border-light)' : 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-50)'; }}
                  onBlur={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onClick={() => handleSelect(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const next = e.currentTarget.nextElementSibling;
                      if (next && next.tagName === 'BUTTON') next.focus();
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      const prev = e.currentTarget.previousElementSibling;
                      if (prev && prev.tagName === 'BUTTON') prev.focus();
                      else inputRef.current?.focus();
                    }
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                    if (e.key === 'Escape') onDropdownOpenChange?.(false);
                  }}
                >
                  {renderItem ? (
                    renderItem(item, idx, filtered.length)
                  ) : (
                    <span className="text-sm">{getDisplayValue ? getDisplayValue(item) : `Item #${item.id}`}</span>
                  )}
                </button>
              ))}
              {filtered.length > 20 && (
                <div className="px-3 py-2 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  + {filtered.length - 20} more results — refine your search
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Selection Chip ── */}
      {selectedItem && renderChip && (
        <div
          className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', border: '1px solid var(--primary-200)' }}
        >
          {renderChip(selectedItem)}
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto p-0.5 rounded hover:bg-black/10 transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
