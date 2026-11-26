import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import type { QueryResult } from '../core/index-core';

interface ResultCardProps {
  prefix: string;
  suffix: string;
  result: QueryResult | null;
  otherMatchIds: number[];
  duplicateIds: number[];
  words: string[];
  onApplyHint: (suggestedPrefix: string, suggestedSuffix: string) => void;
}

export function ResultCard({
  prefix,
  suffix,
  result,
  otherMatchIds,
  duplicateIds,
  words,
  onApplyHint,
}: ResultCardProps) {
  const renderHighlightedClue = (text: string, part: 'prefix' | 'suffix') => {
    const fail = result?.failedAt;
    return text.split('').map((ch, idx) => {
      const broken = fail && fail.part === part && fail.index === idx;
      return (
        <span
          key={`${part}-${idx}`}
          className={
            broken
              ? 'rounded bg-red-500/20 px-0.5 font-bold text-red-500 underline decoration-red-500 dark:text-red-300'
              : ''
          }
        >
          {ch}
        </span>
      );
    });
  };

  return (
    <section
      aria-label="Search Result"
      className="mx-auto mt-5 w-full max-w-4xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6"
    >
      <div className="sr-only" aria-live="polite">
        {result && result.valid
          ? result.matched
            ? `Match: ${result.word}, ID ${result.id}`
            : `No match: ${result.diagnosis?.message ?? 'No matching record'}`
          : ''}
      </div>

      {!result || !result.valid ? (
        <p className="py-4 text-center text-sm text-[var(--text-secondary)]">
          {result?.error ?? 'Enter both a prefix and suffix to search the catalog.'}
        </p>
      ) : result.matched ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-teal)]">
              <CheckCircle2 className="h-4 w-4" />
              <span>Match Found</span>
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono-tabular text-3xl font-semibold text-[var(--accent-gold)]">
                {result.word}
              </span>
              <span className="font-mono-tabular text-base font-semibold text-[var(--text-primary)]">
                ID #{result.id}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Clues: <code className="font-mono-tabular">prefix=&quot;{prefix}&quot;</code> ·{' '}
              <code className="font-mono-tabular">suffix=&quot;{suffix}&quot;</code> ·{' '}
              <span className="font-mono-tabular">{result.nodesVisited} trie steps</span> ·{' '}
              <span className="font-mono-tabular">{result.durationUs.toFixed(1)} µs</span>
            </p>
          </div>

          <div className="space-y-1.5 text-xs text-[var(--text-secondary)] sm:text-right">
            {otherMatchIds.length > 0 && (
              <div>
                Also matched:{' '}
                <span className="font-mono-tabular text-[var(--text-primary)]">
                  {otherMatchIds
                    .slice(0, 4)
                    .map((id) => `${words[id]} (#${id})`)
                    .join(', ')}
                  {otherMatchIds.length > 4 ? ` +${otherMatchIds.length - 4} more` : ''}
                </span>
              </div>
            )}
            {duplicateIds.length > 1 && (
              <div className="font-mono-tabular text-[var(--accent-gold)]">
                Duplicate IDs: {duplicateIds.map((id) => `#${id}`).join(', ')} (newest wins)
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-crimson)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                No Match — {result.diagnosis?.message}
              </div>
              <p className="font-mono-tabular mt-1 text-xs text-[var(--text-secondary)]">
                prefix: &quot;{renderHighlightedClue(prefix, 'prefix')}&quot; · suffix: &quot;
                {renderHighlightedClue(suffix, 'suffix')}&quot; · {result.nodesVisited} trie steps
              </p>
            </div>
          </div>

          {result.hint && (
            <button
              type="button"
              onClick={() => onApplyHint(result.hint!.suggestedPrefix, result.hint!.suggestedSuffix)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-gold)]/45 bg-[var(--accent-gold)]/10 px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--accent-gold)]/20 whitespace-nowrap shrink-0"
            >
              <Lightbulb className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
              <span>
                Try &quot;{result.hint.suggestedPrefix}&quot; + &quot;
                {result.hint.suggestedSuffix}&quot;
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
