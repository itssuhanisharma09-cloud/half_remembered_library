import { useState } from 'react';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { runAllTests, type TestSuiteReport } from '../../tests.js';

export function TestRunnerPanel() {
  const [report, setReport] = useState<TestSuiteReport | null>(() => runAllTests());

  return (
    <section
      aria-label="Automated Verification Suite"
      className="mx-auto w-full max-w-4xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Verification Tests
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            12 core algorithm tests (also runnable via{' '}
            <code className="font-mono-tabular">node tests.js</code>)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {report && (
            <span className="font-mono-tabular text-xs font-semibold text-[var(--text-primary)]">
              {report.passed}/{report.total} passed · {report.totalMs} ms
            </span>
          )}
          <button
            type="button"
            onClick={() => setReport(runAllTests())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-gold)] px-4 py-2 text-xs font-semibold text-stone-950 hover:brightness-105 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Run All</span>
          </button>
        </div>
      </div>

      {report && (
        <div className="mt-4 divide-y divide-[var(--border-hairline)]">
          {report.results.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-xs">
              <div className="flex items-start gap-2">
                {item.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-teal)]" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-crimson)]" />
                )}
                <div>
                  <div className="font-medium text-[var(--text-primary)]">
                    {item.id}. {item.name}
                  </div>
                  <div className="font-mono-tabular mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    {item.detail}
                  </div>
                </div>
              </div>
              <span className="font-mono-tabular shrink-0 text-[11px] text-[var(--text-secondary)]">
                {item.durationMs}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
