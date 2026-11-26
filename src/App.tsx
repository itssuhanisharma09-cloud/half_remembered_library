/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  PrefixSuffixIndex,
  bruteForceQuery,
  validateClue,
  type IndexStats,
  type QueryResult,
} from './core/index-core';
import {
  TUTORIAL_CATALOG,
  UNSEEN_DEMO_CATALOG,
  generateRandomCatalog,
} from './core/datasets';
import { SearchAltar } from './components/SearchAltar';
import { ResultCard } from './components/ResultCard';
import { TrieObservatory } from './components/TrieObservatory';
import { CatalogPanel, type DatasetKey } from './components/CatalogPanel';
import { BatchLab } from './components/BatchLab';
import { TestRunnerPanel } from './components/TestRunnerPanel';

type ActiveTab = 'search' | 'catalog' | 'benchmarks';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  // Core Trie Index & Catalog State
  const indexRef = useRef<PrefixSuffixIndex>(new PrefixSuffixIndex());
  const [extensionMode, setExtensionMode] = useState(false);
  const [activeDataset, setActiveDataset] = useState<DatasetKey>('tutorial');
  const [words, setWords] = useState<string[]>(() => TUTORIAL_CATALOG.slice());
  const [stats, setStats] = useState<IndexStats>(() => {
    indexRef.current.build(TUTORIAL_CATALOG);
    return indexRef.current.stats();
  });

  // Search State
  const [prefix, setPrefix] = useState('cat');
  const [suffix, setSuffix] = useState('og');
  const [activePrefix, setActivePrefix] = useState('cat');
  const [activeSuffix, setActiveSuffix] = useState('og');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [querySeq, setQuerySeq] = useState(1);

  const [lastResult, setLastResult] = useState<QueryResult | null>(() =>
    indexRef.current.query('cat', 'og'),
  );
  const [lastBruteExamined, setLastBruteExamined] = useState<number>(() =>
    bruteForceQuery(TUTORIAL_CATALOG, 'cat', 'og').recordsExamined,
  );
  const [verifiedIdentical, setVerifiedIdentical] = useState(true);
  const [candidateIds, setCandidateIds] = useState<number[]>(() =>
    indexRef.current.findAllMatchingIdsForDisplay('cat', 'og'),
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const prefixInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3600);
  }, []);

  const executeQuery = useCallback((p: string, s: string) => {
    const pCheck = validateClue(p, 'Prefix');
    if (!pCheck.valid) {
      setValidationError(pCheck.error);
      setShakeKey((k) => k + 1);
      return;
    }
    const sCheck = validateClue(s, 'Suffix');
    if (!sCheck.valid) {
      setValidationError(sCheck.error);
      setShakeKey((k) => k + 1);
      return;
    }

    setValidationError(null);
    const tRes = indexRef.current.query(p, s);
    const bRes = bruteForceQuery(indexRef.current.words, p, s);
    const isIdentical =
      tRes.matched === bRes.matched && tRes.id === bRes.id && tRes.word === bRes.word;

    setActivePrefix(p);
    setActiveSuffix(s);
    setLastResult(tRes);
    setLastBruteExamined(bRes.recordsExamined);
    setVerifiedIdentical(isIdentical);
    setCandidateIds(indexRef.current.findAllMatchingIdsForDisplay(p, s));
    setQuerySeq((seq) => seq + 1);
  }, []);

  const rebuildWithWords = useCallback(
    (nextWords: string[], datasetKey: DatasetKey, defaultQuery?: [string, string]) => {
      const nextStats = indexRef.current.build(nextWords);
      setActiveDataset(datasetKey);
      setWords(nextWords.slice());
      setStats(nextStats);

      const [dp, ds] = defaultQuery ?? [
        nextWords[0]?.slice(0, Math.min(2, nextWords[0].length)) || 'a',
        nextWords[0]?.slice(-Math.min(2, nextWords[0].length)) || 'a',
      ];
      setPrefix(dp);
      setSuffix(ds);
      executeQuery(dp, ds);
    },
    [executeQuery],
  );

  const handleSelectDataset = useCallback(
    (key: DatasetKey) => {
      if (key === 'tutorial') {
        rebuildWithWords(TUTORIAL_CATALOG, 'tutorial', ['cat', 'og']);
      } else if (key === 'unseen') {
        rebuildWithWords(UNSEEN_DEMO_CATALOG, 'unseen', ['str', 'er']);
      } else if (key === 'random1000') {
        const list = generateRandomCatalog(1000, 20261125);
        rebuildWithWords(list, 'random1000', [list[0].slice(0, 3), list[0].slice(-2)]);
      } else if (key === 'extension3000') {
        setExtensionMode(true);
        const list = generateRandomCatalog(3000, 777333);
        rebuildWithWords(list, 'extension3000', [list[0].slice(0, 3), list[0].slice(-2)]);
      }
    },
    [rebuildWithWords],
  );

  const handleSelectPreset = useCallback(
    (dataset: 'tutorial' | 'unseen', p: string, s: string) => {
      if (activeDataset !== dataset) {
        const targetWords = dataset === 'tutorial' ? TUTORIAL_CATALOG : UNSEEN_DEMO_CATALOG;
        rebuildWithWords(targetWords, dataset, [p, s]);
      } else {
        setPrefix(p);
        setSuffix(s);
        executeQuery(p, s);
      }
    },
    [activeDataset, executeQuery, rebuildWithWords],
  );

  const handleToggleExtension = useCallback(() => {
    setExtensionMode((prev) => {
      const next = !prev;
      if (!next && activeDataset === 'extension3000') {
        handleSelectDataset('random1000');
      }
      return next;
    });
  }, [activeDataset, handleSelectDataset]);

  const handleIncrementalAdd = useCallback(
    (newWord: string) => {
      try {
        const res = indexRef.current.add(newWord);
        setWords(indexRef.current.words.slice());
        setStats(indexRef.current.stats());
        showToast(`Added "${newWord}" as #${res.id}: +${res.nodesAdded} nodes, 0 rebuilt`);
        if (validateClue(activePrefix).valid && validateClue(activeSuffix).valid) {
          executeQuery(activePrefix, activeSuffix);
        }
        return { id: res.id, nodesAdded: res.nodesAdded };
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to add word');
        return null;
      }
    },
    [activePrefix, activeSuffix, executeQuery, showToast],
  );

  const scheduleLiveQuery = useCallback(
    (nextP: string, nextS: string) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (!nextP && !nextS) {
        setValidationError(null);
        return;
      }
      if (!nextP || !nextS) return;

      const pCheck = validateClue(nextP, 'Prefix');
      const sCheck = validateClue(nextS, 'Suffix');
      if (!pCheck.valid || !sCheck.valid) {
        setValidationError(pCheck.error || sCheck.error);
        return;
      }
      setValidationError(null);

      debounceRef.current = window.setTimeout(() => {
        executeQuery(nextP, nextS);
      }, 180);
    },
    [executeQuery],
  );

  const otherMatchIds = useMemo(() => {
    if (!lastResult?.matched || lastResult.id === null) return [];
    return candidateIds.filter((id) => id !== lastResult.id);
  }, [candidateIds, lastResult]);

  const duplicateIds = useMemo(() => {
    if (!lastResult?.matched || !lastResult.word) return [];
    return indexRef.current.getDuplicateIds(lastResult.word);
  }, [lastResult]);

  const datasetLabel =
    activeDataset === 'tutorial'
      ? 'Tutorial'
      : activeDataset === 'unseen'
        ? 'Unseen Demo'
        : activeDataset === 'random1000'
          ? 'Random 1,000'
          : activeDataset === 'extension3000'
            ? 'Extension 3,000'
            : 'Custom';

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Clean 3-Zone Header */}
      <header className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
          <span className="font-display text-xl font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 sm:text-2xl">
            The Half-Remembered Library
          </span>

          <nav aria-label="Workspace views" className="flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] p-1">
            {(
              [
                ['search', 'Search'],
                ['catalog', 'Catalog'],
                ['benchmarks', 'Batch & Tests'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === key
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            {isDark ? <Sun className="h-3.5 w-3.5 text-[var(--accent-gold)]" /> : <Moon className="h-3.5 w-3.5 text-[var(--accent-violet)]" />}
            <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Quiet active catalog line */}
        <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <span>
            Active catalog: <strong className="text-[var(--text-primary)]">{datasetLabel}</strong> ·{' '}
            <span className="font-mono-tabular">{stats.wordCount.toLocaleString()}</span> records ·{' '}
            <span className="font-mono-tabular">{stats.trieNodes.toLocaleString()}</span> trie nodes
          </span>
          {activeTab !== 'catalog' && (
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="font-medium text-[var(--accent-gold)] hover:underline"
            >
              Switch catalog →
            </button>
          )}
        </div>

        {activeTab === 'search' && (
          <>
            <SearchAltar
              prefix={prefix}
              suffix={suffix}
              onPrefixChange={(val) => {
                setPrefix(val);
                scheduleLiveQuery(val, suffix);
              }}
              onSuffixChange={(val) => {
                setSuffix(val);
                scheduleLiveQuery(prefix, val);
              }}
              onSubmit={() => executeQuery(prefix, suffix)}
              onClear={() => {
                setPrefix('');
                setSuffix('');
                setValidationError(null);
              }}
              onSelectPreset={handleSelectPreset}
              validationError={validationError}
              shakeKey={shakeKey}
              prefixInputRef={prefixInputRef}
            />

            <ResultCard
              prefix={activePrefix}
              suffix={activeSuffix}
              result={lastResult}
              otherMatchIds={otherMatchIds}
              duplicateIds={duplicateIds}
              words={words}
              onApplyHint={(pHint, sHint) => {
                setPrefix(pHint);
                setSuffix(sHint);
                executeQuery(pHint, sHint);
              }}
            />

            <TrieObservatory
              result={lastResult}
              prefix={activePrefix}
              suffix={activeSuffix}
              catalogSize={words.length}
              bruteRecordsExamined={lastBruteExamined}
              verifiedIdentical={verifiedIdentical}
              querySeq={querySeq}
            />
          </>
        )}

        {activeTab === 'catalog' && (
          <CatalogPanel
            words={words}
            winnerId={lastResult?.matched ? lastResult.id : null}
            candidateIds={candidateIds}
            activeDataset={activeDataset}
            onSelectDataset={handleSelectDataset}
            onApplyCustomWords={(customWords) => rebuildWithWords(customWords, 'custom')}
            stats={stats}
            extensionMode={extensionMode}
            onToggleExtension={handleToggleExtension}
            onIncrementalAdd={handleIncrementalAdd}
            onSelectWordForSearch={(word) => {
              const p = word.slice(0, Math.min(3, word.length));
              const s = word.slice(-Math.min(2, word.length));
              setPrefix(p);
              setSuffix(s);
              executeQuery(p, s);
              setActiveTab('search');
            }}
          />
        )}

        {activeTab === 'benchmarks' && (
          <div className="space-y-6">
            <BatchLab
              index={indexRef.current}
              words={words}
              extensionMode={extensionMode}
              onToggleExtension={handleToggleExtension}
            />
            <TestRunnerPanel />
          </div>
        )}
      </main>

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--accent-teal)]/50 bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] shadow-lg"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
