import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FastForward, Play, RotateCcw, ShieldAlert, StepForward } from 'lucide-react';
import type { QueryResult } from '../core/index-core';

interface TrieObservatoryProps {
  result: QueryResult | null;
  prefix: string;
  suffix: string;
  catalogSize: number;
  bruteRecordsExamined: number;
  verifiedIdentical: boolean;
  querySeq: number;
}

export function TrieObservatory({
  result,
  prefix,
  suffix,
  catalogSize,
  bruteRecordsExamined,
  verifiedIdentical,
  querySeq,
}: TrieObservatoryProps) {
  const [stepDurationMs, setStepDurationMs] = useState<number>(260);
  const [activeProgress, setActiveProgress] = useState<number>(1);
  const [isSteppingMode, setIsSteppingMode] = useState<boolean>(false);
  const [manualStepIndex, setManualStepIndex] = useState<number>(0);
  const rafRef = useRef<number>(0);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const path = result?.path ?? [];
  const totalSteps = path.length;

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!result || totalSteps === 0) {
      setActiveProgress(0);
      return;
    }

    if (reducedMotion || stepDurationMs === 0) {
      setIsSteppingMode(false);
      setActiveProgress(totalSteps);
      return;
    }

    setIsSteppingMode(false);
    setActiveProgress(0);
    const startTime = performance.now();
    const totalAnimMs = Math.max(180, totalSteps * stepDurationMs);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const frac = Math.min(1, elapsed / totalAnimMs);
      setActiveProgress(frac * totalSteps);
      if (frac < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [querySeq, result, totalSteps, stepDurationMs, reducedMotion]);

  const handleReplay = () => {
    if (!result || totalSteps === 0) return;
    cancelAnimationFrame(rafRef.current);
    if (reducedMotion || stepDurationMs === 0) {
      setActiveProgress(totalSteps);
      return;
    }
    setIsSteppingMode(false);
    setActiveProgress(0);
    const startTime = performance.now();
    const totalAnimMs = Math.max(180, totalSteps * stepDurationMs);
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const frac = Math.min(1, elapsed / totalAnimMs);
      setActiveProgress(frac * totalSteps);
      if (frac < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleStepForward = () => {
    if (!result || totalSteps === 0) return;
    cancelAnimationFrame(rafRef.current);
    if (!isSteppingMode) {
      setIsSteppingMode(true);
      setManualStepIndex(1);
      setActiveProgress(1);
    } else {
      const next = Math.min(totalSteps, manualStepIndex + 1);
      setManualStepIndex(next);
      setActiveProgress(next);
    }
  };

  const layout = useMemo(() => {
    if (path.length === 0) return null;
    const hasFailure = Boolean(result && !result.matched && result.failedAt);
    const nodeCount = path.length + (hasFailure ? 1 : 0);
    const spacingX = Math.max(74, Math.min(110, 740 / Math.max(1, nodeCount)));
    const startX = 64;
    const centerY = 126;

    const nodes = path.map((step, i) => ({
      ...step,
      x: startX + i * spacingX,
      y: centerY,
      index: i,
    }));

    const failedNode = hasFailure
      ? {
          char: result?.failedAt?.char ?? '?',
          part: result?.failedAt?.part ?? 'prefix',
          x: startX + path.length * spacingX,
          y: centerY,
          index: path.length,
        }
      : null;

    const svgWidth = Math.max(660, startX * 2 + (nodeCount - 1) * spacingX + 40);
    return { nodes, failedNode, svgWidth, centerY };
  }, [path, result]);

  const completedCount = Math.floor(activeProgress);
  const isFinished = activeProgress >= totalSteps - 0.01;

  const getSegmentColor = (segment: string) => {
    if (segment === 'suffix') return 'var(--accent-teal)';
    if (segment === 'separator') return 'var(--accent-gold)';
    if (segment === 'prefix') return 'var(--accent-violet)';
    return 'var(--text-secondary)';
  };

  const speedLabel =
    stepDurationMs === 0 ? 'Instant' : stepDurationMs <= 180 ? 'Brisk' : stepDurationMs <= 360 ? 'Balanced' : 'Cinematic';

  const nodesVisited = result?.nodesVisited ?? 0;
  const speedup = nodesVisited > 0 ? (bruteRecordsExamined / nodesVisited).toFixed(1) : '1.0';
  const brutePct = catalogSize > 0 ? Math.min(100, (bruteRecordsExamined / catalogSize) * 100) : 0;
  const triePct = catalogSize > 0 ? Math.min(100, Math.max(3, (nodesVisited / catalogSize) * 100)) : 3;

  return (
    <div className="mx-auto mt-5 w-full max-w-4xl space-y-5">
      {/* Animated Trie Observatory Graph */}
      <section
        aria-label="Trie Walk Graph"
        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              Trie Walk Graph
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Walks <code className="font-mono-tabular">{suffix || '?'}#{prefix || '?'}</code> · Suffix
              in teal, <span className="text-[var(--accent-gold)]">#</span> in gold, Prefix in violet
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <FastForward className="h-3.5 w-3.5" />
              <span>Speed: {speedLabel}</span>
              <input
                type="range"
                min={0}
                max={550}
                step={50}
                value={stepDurationMs}
                onChange={(e) => setStepDurationMs(Number(e.target.value))}
                aria-label="Trie animation speed"
                className="h-1.5 w-20 cursor-pointer accent-[var(--accent-gold)]"
              />
            </label>

            <button
              type="button"
              onClick={handleStepForward}
              disabled={!result || totalSteps === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-gold)] disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <StepForward className="h-3.5 w-3.5" />
              <span>Step</span>
            </button>

            <button
              type="button"
              onClick={handleReplay}
              disabled={!result || totalSteps === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent-teal)] disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Replay</span>
            </button>
          </div>
        </div>

        <div className="relative mt-4 overflow-x-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/70 p-2">
          {!layout ? (
            <div className="flex h-[240px] flex-col items-center justify-center text-center text-sm text-[var(--text-secondary)]">
              <Play className="mb-2 h-6 w-6 opacity-40" />
              <p>Enter a prefix and suffix above to watch the trie traversal.</p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${layout.svgWidth} 252`}
              className="h-[240px] w-full min-w-[600px]"
              role="img"
              aria-label={`Trie traversal path for ${suffix}#${prefix}`}
            >
              <defs>
                <filter id="glow-orb" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Sibling branches (neighborhood constellation) */}
              {layout.nodes.map((node) => {
                const sibCount = node.siblings.length;
                return node.siblings.map((sib, sIdx) => {
                  const angleSign = sIdx % 2 === 0 ? -1 : 1;
                  const tier = Math.floor(sIdx / 2) + 1;
                  const offsetX = node.x + (sIdx - (sibCount - 1) / 2) * 26 + 14;
                  const offsetY = node.y + angleSign * (44 + tier * 22);
                  const visible = completedCount > node.index;
                  return (
                    <g
                      key={`sib-${node.nodeId}-${sib.nodeId}`}
                      style={{
                        opacity: visible ? 0.5 : 0.12,
                        transition: 'opacity 220ms ease',
                      }}
                    >
                      <line
                        x1={node.x}
                        y1={node.y}
                        x2={offsetX}
                        y2={offsetY}
                        stroke="currentColor"
                        strokeOpacity={0.35}
                        strokeDasharray="3 3"
                        strokeWidth={1.2}
                      />
                      <circle
                        cx={offsetX}
                        cy={offsetY}
                        r={12}
                        fill="var(--bg-elevated)"
                        stroke="var(--border-hairline)"
                        strokeWidth={1.2}
                      />
                      <text
                        x={offsetX}
                        y={offsetY + 4}
                        textAnchor="middle"
                        className="font-mono-tabular fill-[var(--text-secondary)] text-[11px]"
                      >
                        {sib.char}
                      </text>
                      <text
                        x={offsetX}
                        y={offsetY + (angleSign < 0 ? -16 : 22)}
                        textAnchor="middle"
                        className="font-mono-tabular fill-[var(--text-secondary)] text-[9px] opacity-75"
                      >
                        #{sib.maxId}
                      </text>
                    </g>
                  );
                });
              })}

              {/* Walked edges */}
              {layout.nodes.map((node, i) => {
                if (i === 0) return null;
                const prev = layout.nodes[i - 1];
                const lit = activeProgress >= i + 0.5;
                const color = getSegmentColor(node.segment);
                return (
                  <line
                    key={`edge-${prev.nodeId}-${node.nodeId}`}
                    x1={prev.x}
                    y1={prev.y}
                    x2={node.x}
                    y2={node.y}
                    stroke={lit ? color : 'var(--border-hairline)'}
                    strokeWidth={lit ? 3 : 1.5}
                    strokeOpacity={result && !result.matched && isFinished ? 0.45 : 1}
                  />
                );
              })}

              {/* Broken edge on failure */}
              {layout.failedNode && layout.nodes.length > 0 && (
                <line
                  x1={layout.nodes[layout.nodes.length - 1].x}
                  y1={layout.nodes[layout.nodes.length - 1].y}
                  x2={layout.failedNode.x}
                  y2={layout.failedNode.y}
                  stroke="var(--accent-crimson)"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  opacity={isFinished ? 0.95 : 0.2}
                />
              )}

              {/* Travelling Pulse Orb */}
              {!reducedMotion &&
                !isFinished &&
                layout.nodes.length > 1 &&
                (() => {
                  const segIdx = Math.min(layout.nodes.length - 2, Math.floor(activeProgress));
                  const localT = Math.max(0, Math.min(1, activeProgress - segIdx));
                  const a = layout.nodes[segIdx];
                  const b = layout.nodes[segIdx + 1];
                  if (!a || !b) return null;
                  const px = a.x + (b.x - a.x) * localT;
                  const py = a.y + (b.y - a.y) * localT;
                  return (
                    <circle
                      cx={px}
                      cy={py}
                      r={6}
                      fill={getSegmentColor(b.segment)}
                      filter="url(#glow-orb)"
                    />
                  );
                })()}

              {/* Walked Nodes */}
              {layout.nodes.map((node, i) => {
                const isLit = activeProgress >= i + 0.15;
                const isLast = i === layout.nodes.length - 1;
                const isMatchFinal = Boolean(isLast && result?.matched && isFinished);
                const color = getSegmentColor(node.segment);
                const isSeparator = node.segment === 'separator';

                return (
                  <g key={`node-${node.nodeId}-${i}`}>
                    {isMatchFinal && (
                      <g>
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={30}
                          fill="var(--accent-gold)"
                          opacity={0.18}
                        />
                        {!reducedMotion &&
                          [0, 60, 120, 180, 240, 300].map((deg) => {
                            const rad = (deg * Math.PI) / 180;
                            return (
                              <circle
                                key={deg}
                                cx={node.x + Math.cos(rad) * 34}
                                cy={node.y + Math.sin(rad) * 34}
                                r={2}
                                fill="var(--accent-gold)"
                                opacity={0.85}
                              />
                            );
                          })}
                        <text
                          x={node.x}
                          y={node.y - 36}
                          textAnchor="middle"
                          className="font-mono-tabular fill-[var(--accent-gold)] text-[13px] font-semibold"
                        >
                          Winner #{result?.id}
                        </text>
                      </g>
                    )}

                    {isSeparator ? (
                      <polygon
                        points={`${node.x},${node.y - 22} ${node.x + 22},${node.y} ${node.x},${node.y + 22} ${node.x - 22},${node.y}`}
                        fill={isLit ? 'var(--bg-elevated)' : 'var(--bg-surface)'}
                        stroke={isLit ? 'var(--accent-gold)' : 'var(--border-hairline)'}
                        strokeWidth={isLit ? 2.5 : 1.5}
                      />
                    ) : (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.segment === 'root' ? 21 : 19}
                        fill={isLit ? 'var(--bg-elevated)' : 'var(--bg-surface)'}
                        stroke={isLit ? color : 'var(--border-hairline)'}
                        strokeWidth={isMatchFinal ? 3 : isLit ? 2.2 : 1.5}
                      />
                    )}

                    <text
                      x={node.x}
                      y={node.y + 4}
                      textAnchor="middle"
                      className="font-mono-tabular fill-[var(--text-primary)] text-[13px] font-semibold"
                    >
                      {node.segment === 'root' ? '•' : node.char}
                    </text>

                    <text
                      x={node.x}
                      y={node.y + 34}
                      textAnchor="middle"
                      className="font-mono-tabular fill-[var(--text-secondary)] text-[10px]"
                    >
                      {node.segment === 'root' ? 'ROOT' : `max #${node.maxId}`}
                    </text>
                  </g>
                );
              })}

              {/* Failed Target Node */}
              {layout.failedNode && (
                <g style={{ opacity: isFinished ? 1 : 0.25 }}>
                  <circle
                    cx={layout.failedNode.x}
                    cy={layout.failedNode.y}
                    r={19}
                    fill="rgba(220, 38, 38, 0.14)"
                    stroke="var(--accent-crimson)"
                    strokeWidth={2.2}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={layout.failedNode.x}
                    y={layout.failedNode.y + 4}
                    textAnchor="middle"
                    className="font-mono-tabular fill-[var(--accent-crimson)] text-[13px] font-semibold"
                  >
                    {layout.failedNode.char}
                  </text>
                  <text
                    x={layout.failedNode.x}
                    y={layout.failedNode.y + 34}
                    textAnchor="middle"
                    className="font-mono-tabular fill-[var(--accent-crimson)] text-[10px] font-medium"
                  >
                    BROKE HERE
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-teal)]" />
              <span>Suffix</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rotate-45 bg-[var(--accent-gold)]" />
              <span>Separator (#)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-violet)]" />
              <span>Prefix</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-[var(--accent-crimson)]" />
              <span>Broken edge</span>
            </span>
          </div>
          {result && result.valid && (
            <span className="font-mono-tabular">
              Nodes visited: <strong className="text-[var(--text-primary)]">{result.nodesVisited}</strong>
            </span>
          )}
        </div>
      </section>

      {/* Compact Trie vs Full Scan Verification */}
      <section
        aria-label="Trie vs Full Scan Comparison"
        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Trie Index vs Brute-Force Scan
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono-tabular text-[var(--text-secondary)]">
              {speedup}× fewer operations on {catalogSize.toLocaleString()} records
            </span>
            {verifiedIdentical ? (
              <span className="inline-flex items-center gap-1 font-medium text-[var(--accent-teal)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-red-500">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Mismatch</span>
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Trie Index</span>
              <span className="font-mono-tabular font-semibold text-[var(--accent-teal)]">
                {nodesVisited} steps
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--accent-teal)]"
                style={{ width: `${triePct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Brute-Force Scan</span>
              <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                {bruteRecordsExamined.toLocaleString()} records
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full rounded-full bg-amber-600/75 dark:bg-amber-500/75"
                style={{ width: `${brutePct}%` }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
