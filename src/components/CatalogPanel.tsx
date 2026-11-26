import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Plus, Upload } from 'lucide-react';
import {
  validateCatalogText,
  validateCatalogWord,
  type CatalogParseError,
  type IndexStats,
} from '../core/index-core';

export type DatasetKey = 'tutorial' | 'unseen' | 'random1000' | 'extension3000' | 'custom';

interface CatalogPanelProps {
  words: string[];
  winnerId: number | null;
  candidateIds: number[];
  activeDataset: DatasetKey;
  onSelectDataset: (key: DatasetKey) => void;
  onApplyCustomWords: (words: string[]) => void;
  stats: IndexStats;
  extensionMode: boolean;
  onToggleExtension: () => void;
  onIncrementalAdd: (word: string) => { id: number; nodesAdded: number } | null;
  onSelectWordForSearch: (word: string) => void;
}

const PAGE_SIZE = 40;

export function CatalogPanel({
  words,
  winnerId,
  candidateIds,
  activeDataset,
  onSelectDataset,
  onApplyCustomWords,
  stats,
  extensionMode,
  onToggleExtension,
  onIncrementalAdd,
  onSelectWordForSearch,
}: CatalogPanelProps) {
  const [page, setPage] = useState(0);
  const [newBook, setNewBook] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('catalog\ncatch\ncatdog\ncatnip');
  const [parseErrors, setParseErrors] = useState<CatalogParseError[]>([]);
  const [showCustom, setShowCustom] = useState(false);

  const maxWords = extensionMode ? 3000 : 1000;
  const candidateSet = useMemo(() => new Set(candidateIds), [candidateIds]);
  const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleSlice = words.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (stats.wordCount >= maxWords) {
      setAddError(`Catalog limit (${maxWords.toLocaleString()}) reached.`);
      return;
    }
    const check = validateCatalogWord(newBook, 8);
    if (!check.valid) {
      setAddError(check.error);
      return;
    }
    const res = onIncrementalAdd(newBook);
    if (res) {
      setNewBook('');
      setPage(Math.floor(res.id / PAGE_SIZE));
    }
  };

  const handleLoadText = (raw: string) => {
    const parsed = validateCatalogText(raw, maxWords, 8);
    if (!parsed.valid) {
      setParseErrors(parsed.errors);
      return;
    }
    setParseErrors([]);
    onApplyCustomWords(parsed.words);
    setShowCustom(false);
    setPage(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      setPasteText(content);
      handleLoadText(content);
    };
    reader.readAsText(file);
  };

  return (
    <section aria-label="Catalog Manager" className="mx-auto w-full max-w-4xl space-y-5">
      {/* Dataset & Stats Card */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              Library Catalog
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Lock className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
              <span>
                Fixed insertion order · {stats.wordCount.toLocaleString()} words ·{' '}
                {stats.trieNodes.toLocaleString()} trie nodes · built in {stats.buildTimeMs} ms
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleExtension}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              extensionMode
                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Extension Mode: {extensionMode ? 'On (3,000 limit)' : 'Off (1,000 limit)'}
          </button>
        </div>

        {/* Dataset Switcher */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ['tutorial', 'Tutorial (3)'],
              ['unseen', 'Unseen Demo (42)'],
              ['random1000', 'Random 1,000'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectDataset(key);
                setPage(0);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeDataset === key
                  ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}

          {extensionMode && (
            <button
              type="button"
              onClick={() => {
                onSelectDataset('extension3000');
                setPage(0);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeDataset === 'extension3000'
                  ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Extension 3,000
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCustom((s) => !s)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            {showCustom ? 'Hide Custom Import' : 'Paste / Upload .txt'}
          </button>
        </div>

        {/* Extension Mode: Incremental Add */}
        {extensionMode && (
          <form onSubmit={handleAddSubmit} className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-4">
            <input
              type="text"
              value={newBook}
              onChange={(e) => setNewBook(e.target.value)}
              placeholder="Add title without rebuild (e.g. catnip)"
              className="font-mono-tabular flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-gold)] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-gold)] px-3.5 py-2 text-xs font-semibold text-stone-950 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Book</span>
            </button>
            {addError && <p className="w-full text-xs text-red-500">{addError}</p>}
          </form>
        )}

        {/* Custom Import Box (Collapsible) */}
        {showCustom && (
          <div className="mt-4 space-y-2.5 border-t border-[var(--border-hairline)] pt-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>One lowercase word per line (a-z, 1–8 chars, max {maxWords.toLocaleString()})</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload .txt</span>
                <input type="file" accept=".txt,text/plain" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              spellCheck={false}
              className="font-mono-tabular w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-teal)] focus:outline-none"
            />
            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-red-500/35 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-300">
                Line {parseErrors[0].line} (&quot;{parseErrors[0].text}&quot;): {parseErrors[0].reason}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleLoadText(pasteText)}
                className="rounded-lg bg-[var(--accent-teal)] px-4 py-1.5 text-xs font-semibold text-stone-950"
              >
                Build Index
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paginated Word List */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 text-xs text-[var(--text-secondary)]">
          <span>
            Records {safePage * PAGE_SIZE}–{Math.min((safePage + 1) * PAGE_SIZE - 1, words.length - 1)} (click any title to test it in Search)
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center rounded border border-[var(--border-hairline)] px-2 py-1 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono-tabular">
                {safePage + 1}/{totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="inline-flex items-center rounded border border-[var(--border-hairline)] px-2 py-1 disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {visibleSlice.map((word, offset) => {
            const id = safePage * PAGE_SIZE + offset;
            const isWinner = id === winnerId;
            const isCandidate = candidateSet.has(id);
            return (
              <button
                key={`${id}-${word}`}
                type="button"
                onClick={() => onSelectWordForSearch(word)}
                className={`font-mono-tabular flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                  isWinner
                    ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 font-semibold text-[var(--text-primary)]'
                    : isCandidate
                      ? 'border-[var(--accent-teal)]/50 bg-[var(--accent-teal)]/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)]/50 text-[var(--text-primary)] hover:border-[var(--accent-gold)]/60'
                }`}
              >
                <span className="truncate">{word}</span>
                <span className="ml-1.5 text-[10px] text-[var(--text-secondary)]">#{id}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
