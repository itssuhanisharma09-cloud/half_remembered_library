import React from 'react';
import { RotateCcw, Search } from 'lucide-react';

interface SearchAltarProps {
  prefix: string;
  suffix: string;
  onPrefixChange: (val: string) => void;
  onSuffixChange: (val: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onSelectPreset: (dataset: 'tutorial' | 'unseen', prefix: string, suffix: string) => void;
  validationError: string | null;
  shakeKey: number;
  prefixInputRef: React.RefObject<HTMLInputElement | null>;
}

export function SearchAltar({
  prefix,
  suffix,
  onPrefixChange,
  onSuffixChange,
  onSubmit,
  onClear,
  onSelectPreset,
  validationError,
  shakeKey,
  prefixInputRef,
}: SearchAltarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClear();
    }
  };

  return (
    <section aria-label="Search Catalog" className="mx-auto w-full max-w-4xl">
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl [text-wrap:balance]">
          Find a title from its beginning and ending
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          Enter a prefix and suffix to retrieve the most recently added matching record.
        </p>
      </div>

      <div
        key={shakeKey}
        className={`rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6 ${
          validationError ? 'animate-shake border-red-500/60' : ''
        }`}
      >
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label
              htmlFor="prefix-input"
              className="mb-1.5 block text-xs font-medium text-[var(--accent-violet)]"
            >
              Starts with (prefix)
            </label>
            <input
              ref={prefixInputRef}
              id="prefix-input"
              type="text"
              value={prefix}
              onChange={(e) => onPrefixChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="cat"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(validationError)}
              className="font-mono-tabular w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-4 py-3 text-xl font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--accent-violet)] focus:outline-none"
            />
          </div>

          <div className="hidden pb-3 text-center text-lg font-medium text-[var(--text-secondary)] sm:block">
            …
          </div>

          <div>
            <label
              htmlFor="suffix-input"
              className="mb-1.5 block text-xs font-medium text-[var(--accent-teal)]"
            >
              Ends with (suffix)
            </label>
            <input
              id="suffix-input"
              type="text"
              value={suffix}
              onChange={(e) => onSuffixChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="og"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(validationError)}
              className="font-mono-tabular w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-4 py-3 text-xl font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--accent-teal)] focus:outline-none"
            />
          </div>
        </div>

        {validationError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300"
          >
            {validationError}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>Examples:</span>
            <button
              type="button"
              onClick={() => onSelectPreset('tutorial', 'cat', 'og')}
              className="font-mono-tabular rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[var(--text-primary)] hover:border-[var(--accent-gold)] whitespace-nowrap shrink-0"
            >
              cat + og
            </button>
            <button
              type="button"
              onClick={() => onSelectPreset('unseen', 'str', 'er')}
              className="font-mono-tabular rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[var(--text-primary)] hover:border-[var(--accent-gold)] whitespace-nowrap shrink-0"
            >
              str + er (multi-match)
            </button>
            <button
              type="button"
              onClick={() => onSelectPreset('unseen', 'pa', 'er')}
              className="font-mono-tabular rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[var(--text-primary)] hover:border-[var(--accent-gold)] whitespace-nowrap shrink-0"
            >
              pa + er (duplicate)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-gold)] px-4 py-2 text-sm font-semibold text-stone-950 transition-transform hover:brightness-105 whitespace-nowrap shrink-0"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
