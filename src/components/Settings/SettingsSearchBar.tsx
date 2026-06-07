import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { searchSettings, type SettingsSearchEntry } from './settingsSearchIndex';
import { useSettingsUi } from './SettingsUiContext';

export function SettingsSearchBar() {
  const { navigateToSection } = useSettingsUi();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchSettings(query), [query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (entry: SettingsSearchEntry) => {
    navigateToSection(entry.tab, entry.sectionId);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !results.length) {
      if (e.key === 'Escape') {
        setQuery('');
        setOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[activeIdx]!);
    } else if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="settings-search shrink-0">
      <div className="settings-search__field">
        <Search className="settings-search__icon" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search settings…"
          className="settings-search__input"
          aria-label="Search settings"
          aria-expanded={open && results.length > 0}
          aria-controls="settings-search-results"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className="settings-search__clear"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <ul id="settings-search-results" className="settings-search__results" role="listbox">
          {results.length === 0 ? (
            <li className="settings-search__empty">No settings match “{query.trim()}”</li>
          ) : (
            results.map((entry, i) => (
              <li key={entry.id} role="option" aria-selected={i === activeIdx}>
                <button
                  type="button"
                  className={clsx(
                    'settings-search__result',
                    i === activeIdx && 'settings-search__result--active'
                  )}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => pick(entry)}
                >
                  <span className="settings-search__result-title">{entry.title}</span>
                  <span className="settings-search__result-path">
                    {entry.tabLabel}
                    {entry.description ? ` · ${entry.description}` : ''}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
