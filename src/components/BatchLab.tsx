import { useState } from 'react';
import { Download, Play } from 'lucide-react';
import { PrefixSuffixIndex, bruteForceQuery } from '../core/index-core';
import { generateBatchQueries } from '../core/datasets';

interface BatchSummary {
  queryCount: number;
  totalTimeMs: number;
  totalNodesVisited: number;
  totalBruteRecords: number;
  hits: number;
  misses: number;
  csvRows: Array<{ prefix: string; suffix: string; matched: boolean; id: number | null }>;
}

interface BatchLabProps {
  index: PrefixSuffixIndex;
  words: string[];
  extensionMode: boolean;
  onToggleExtension: () => void;
}

export function BatchLab({
  index,
  words,
  extensionMode,
  onToggleExtension,
}: BatchLabProps) {
  const targetCount = extensionMode ? 5000 : 2000;
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<BatchSummary | null>(null);

  const handleRunBatch = () => {
    if (words.length === 0) return;
    setRunning(true);

    requestAnimationFrame(() => {
      const pairs = generateBatchQueries(words, targetCount, 20261125);
      const t0 = performance.now();
      let totalNodesVisited = 0;
      let totalBruteRecords = 0;
      let hits = 0;
      let misses = 0;
      const csvRows: BatchSummary['csvRows'] = [];

      for (const { prefix, suffix } of pairs) {
        const tRes = index.query(prefix, suffix, { trace: false });
        const bRes = bruteForceQuery(words, prefix, suffix);
        totalNodesVisited += tRes.nodesVisited;
        totalBruteRecords += bRes.recordsExamined;
        if (tRes.matched) hits++;
        else misses++;
        csvRows.push({ prefix, suffix, matched: tRes.matched, id: tRes.id });
      }

      const totalTimeMs = Number(Math.max(0.1, performance.now() - t0).toFixed(1));
      setSummary({
        queryCount: pairs.length,
        totalTimeMs,
        totalNodesVisited,
        totalBruteRecords,
        hits,
        misses,
        csvRows,
      });
      setRunning(false);
    });
  };

  const handleExportCsv = () => {
    if (!summary) return;
    const header = 'prefix,suffix,matched,id\n';
    const body = summary.csvRows
      .map((r) => `${r.prefix},${r.suffix},${r.matched},${r.id ?? ''}`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-results-${summary.queryCount}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Batch Benchmark"
      className="mx-auto w-full max-w-4xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Batch Stress Test
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Runs {targetCount.toLocaleString()} deterministic queries on the active catalog ({words.length.toLocaleString()} words)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleExtension}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            {extensionMode ? 'Extension: 5,000' : 'Standard: 2,000'}
          </button>

          <button
            type="button"
            onClick={handleRunBatch}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-teal)] px-4 py-2 text-xs font-semibold text-stone-950 hover:brightness-105 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{running ? 'Running…' : `Run ${targetCount.toLocaleString()} Queries`}</span>
          </button>
        </div>
      </div>

      {summary ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 p-3">
              <div className="text-[11px] text-[var(--text-secondary)]">Total Time</div>
              <div className="font-mono-tabular mt-1 text-lg font-semibold text-[var(--text-primary)]">
                {summary.totalTimeMs} ms
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 p-3">
              <div className="text-[11px] text-[var(--text-secondary)]">Hits / Misses</div>
              <div className="font-mono-tabular mt-1 text-lg font-semibold text-[var(--text-primary)]">
                {summary.hits} / {summary.misses}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 p-3">
              <div className="text-[11px] text-[var(--text-secondary)]">Trie Steps</div>
              <div className="font-mono-tabular mt-1 text-lg font-semibold text-[var(--accent-teal)]">
                {summary.totalNodesVisited.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 p-3">
              <div className="text-[11px] text-[var(--text-secondary)]">Brute-Force Scans</div>
              <div className="font-mono-tabular mt-1 text-lg font-semibold text-[var(--accent-crimson)]">
                {summary.totalBruteRecords.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
            <span className="font-mono-tabular">
              Trie used{' '}
              <strong className="text-[var(--text-primary)]">
                {(summary.totalBruteRecords / Math.max(1, summary.totalNodesVisited)).toFixed(1)}×
              </strong>{' '}
              fewer steps than full-catalog scanning.
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 font-medium text-[var(--text-primary)] hover:border-[var(--accent-gold)]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[var(--text-secondary)]">
          Click Run to benchmark {targetCount.toLocaleString()} queries and compare trie steps against brute-force scanning.
        </p>
      )}
    </section>
  );
}
