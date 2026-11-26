/**
 * @fileoverview Standalone & In-App Test Suite for PrefixSuffixIndex.
 * Run headless in Node: `node tests.js` (zero external dependencies)
 * Or import `runAllTests()` in the browser Test Runner panel.
 */

import {
  PrefixSuffixIndex,
  bruteForceQuery,
  validateClue,
  validateCatalogWord,
} from './src/core/index-core.js';
import {
  TUTORIAL_CATALOG,
  UNSEEN_DEMO_CATALOG,
  generateRandomCatalog,
  generateBatchQueries,
  createSeededRng,
} from './src/core/datasets.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * Runs all 12 verification tests and returns structured results.
 * @returns {{ passed: number, failed: number, total: number, totalMs: number, results: Array<{ id: number, name: string, passed: boolean, durationMs: number, detail: string }> }}
 */
export function runAllTests() {
  const suiteStart = nowMs();
  const cases = [
    {
      id: 1,
      name: 'Spec Worked Example: [catalog, catch, catdog]',
      fn: () => {
        const idx = new PrefixSuffixIndex();
        idx.build(TUTORIAL_CATALOG);
        const res = idx.query('cat', 'og');
        assert(res.matched, 'Expected match for cat + og');
        assertEqual(res.word, 'catdog', 'Matched word');
        assertEqual(res.id, 2, 'Matched ID (newest wins over catalog #0)');
        return `Matched "${res.word}" (#${res.id}) in ${res.nodesVisited} nodes`;
      },
    },
    {
      id: 2,
      name: 'Ambiguity Resolution: Highest ID Wins Regardless of Position',
      fn: () => {
        const words1 = ['strider', 'amber', 'starter', 'strainer', 'quill'];
        const idx1 = new PrefixSuffixIndex();
        idx1.build(words1);
        const r1 = idx1.query('st', 'er');
        assertEqual(r1.id, 3, 'strainer at index 3 should win');
        assertEqual(r1.word, 'strainer', 'word mismatch');

        // Put the same target earlier vs last
        const words2 = ['starter', 'strainer', 'strider'];
        const idx2 = new PrefixSuffixIndex();
        idx2.build(words2);
        const r2 = idx2.query('st', 'er');
        assertEqual(r2.id, 2, 'strider at index 2 should win');
        assertEqual(r2.word, 'strider', 'word mismatch');

        // Unseen demo catalog multi-match check
        const idx3 = new PrefixSuffixIndex();
        idx3.build(UNSEEN_DEMO_CATALOG);
        const r3 = idx3.query('str', 'er');
        const bf3 = bruteForceQuery(UNSEEN_DEMO_CATALOG, 'str', 'er');
        assertEqual(r3.id, bf3.id, 'Unseen catalog str+er ID');
        assertEqual(r3.word, 'strider', 'Unseen catalog str+er word');
        return `str+er -> "${r3.word}" (#${r3.id}) outranking earlier candidates`;
      },
    },
    {
      id: 3,
      name: 'Duplicates: Preserves All IDs & Returns Newest Duplicate',
      fn: () => {
        const words = ['apple', 'ape', 'apple'];
        const idx = new PrefixSuffixIndex();
        idx.build(words);
        const res = idx.query('ap', 'le');
        assert(res.matched, 'Expected duplicate match');
        assertEqual(res.id, 2, 'Newest duplicate ID');
        assertEqual(res.word, 'apple', 'Matched word');
        const dupIds = idx.getDuplicateIds('apple');
        assertEqual(JSON.stringify(dupIds), JSON.stringify([0, 2]), 'Preserved duplicate IDs');
        return `apple duplicate IDs [${dupIds.join(', ')}] -> returned #${res.id}`;
      },
    },
    {
      id: 4,
      name: 'No-Match Deterministic Diagnosis (NO_SUFFIX, NO_PREFIX, BOTH_SEPARATE)',
      fn: () => {
        const idx = new PrefixSuffixIndex();
        idx.build(['apple', 'zebra', 'apricot']);

        // Case A: suffix does not exist
        const rNoSuf = idx.query('ap', 'xyz');
        assert(!rNoSuf.matched, 'Should not match');
        assertEqual(rNoSuf.diagnosis?.code, 'NO_SUFFIX', 'NO_SUFFIX diagnosis');
        assertEqual(rNoSuf.failedAt?.part, 'suffix', 'Failed inside suffix');

        // Case A edge: partial suffix inside word but not at end ('p' in 'apple')
        const rPartialSuf = idx.query('a', 'p');
        assert(!rPartialSuf.matched, 'p is not a complete suffix of apple');
        assertEqual(rPartialSuf.diagnosis?.code, 'NO_SUFFIX', 'Incomplete suffix should be NO_SUFFIX');

        // Case B: suffix exists ('bra'), prefix does not ('qq')
        const rNoPre = idx.query('qq', 'bra');
        assert(!rNoPre.matched, 'Should not match');
        assertEqual(rNoPre.diagnosis?.code, 'NO_PREFIX', 'NO_PREFIX diagnosis');
        assertEqual(rNoPre.failedAt?.part, 'prefix', 'Failed inside prefix');

        // Case C: both exist separately ('ze' in zebra, 'le' in apple, none has both)
        const rBoth = idx.query('ze', 'le');
        assert(!rBoth.matched, 'Should not match');
        assertEqual(rBoth.diagnosis?.code, 'BOTH_SEPARATE', 'BOTH_SEPARATE diagnosis');
        assertEqual(rBoth.failedAt?.part, 'prefix', 'Failed inside prefix');

        return 'All 3 diagnosis codes + incomplete-suffix edge case verified';
      },
    },
    {
      id: 5,
      name: 'Boundary Cases: 1-Char, Full-Word, Overlapping, Length-8',
      fn: () => {
        const idx = new PrefixSuffixIndex();
        idx.build(['z', 'aba', 'abcd', 'abcdefgh']);

        // Single-letter word
        const r1 = idx.query('z', 'z');
        assertEqual(r1.id, 0, 'Single-letter z+z -> z (#0)');

        // Overlapping prefix + suffix on 'aba'
        const r2 = idx.query('ab', 'ba');
        assertEqual(r2.id, 1, 'Overlapping ab+ba -> aba (#1)');

        // Prefix + suffix longer than word ('abcd' len 4, 'abc'+'bcd' len 6)
        const r3 = idx.query('abc', 'bcd');
        assertEqual(r3.id, 2, 'Overlap abc+bcd -> abcd (#2)');

        // Length-8 full-word prefix & suffix
        const r4 = idx.query('abcdefgh', 'abcdefgh');
        assertEqual(r4.id, 3, 'Full length-8 match -> abcdefgh (#3)');

        // Non-overlapping impossible combo on 'abcd'
        const r5 = idx.query('abc', 'cde');
        assert(!r5.matched, 'abc+cde should fail');

        return '1-char, overlap (ab+ba->aba), P+S>L, and length-8 verified';
      },
    },
    {
      id: 6,
      name: 'Input Validation: Empty, Uppercase, Digits, Spaces, Multi-Word Rejected',
      fn: () => {
        const idx = new PrefixSuffixIndex();
        idx.build(TUTORIAL_CATALOG);

        const badClues = ['', 'Cat', '123', 'cat ', 'cat dog', 'cat-og', 'a_b'];
        for (const bad of badClues) {
          assert(!validateClue(bad).valid, `Clue "${bad}" must be rejected`);
          const res = idx.query(bad, 'og');
          assert(!res.valid && !res.matched && res.error, `Query with "${bad}" must fail cleanly`);
        }

        const badWords = ['', 'Catalog', 'cat1', 'cat dog', 'abcdefghi'];
        for (const w of badWords) {
          assert(!validateCatalogWord(w).valid, `Word "${w}" must be rejected`);
        }
        return `Rejected ${badClues.length} invalid clues & ${badWords.length} invalid catalog entries`;
      },
    },
    {
      id: 7,
      name: 'Oracle Equivalence: 1,000 Random Queries vs Brute-Force',
      fn: () => {
        const catalog = generateRandomCatalog(500, 112233);
        const idx = new PrefixSuffixIndex();
        idx.build(catalog);
        const rng = createSeededRng(445566);

        for (let i = 0; i < 1000; i++) {
          let p;
          let s;
          if (i % 5 === 0) {
            // Random 1-2 char probe
            p = String.fromCharCode(97 + Math.floor(rng() * 26));
            s = String.fromCharCode(97 + Math.floor(rng() * 26));
          } else {
            const w = catalog[Math.floor(rng() * catalog.length)];
            p = w.slice(0, 1 + Math.floor(rng() * Math.min(4, w.length)));
            s = w.slice(Math.max(0, w.length - (1 + Math.floor(rng() * Math.min(4, w.length)))));
          }
          const tRes = idx.query(p, s, { trace: false });
          const bRes = bruteForceQuery(catalog, p, s);
          assertEqual(tRes.matched, bRes.matched, `Match mismatch on (${p}, ${s})`);
          assertEqual(tRes.id, bRes.id, `ID mismatch on (${p}, ${s})`);
          assertEqual(tRes.word, bRes.word, `Word mismatch on (${p}, ${s})`);
        }
        return '1,000/1,000 random queries identical to brute-force oracle';
      },
    },
    {
      id: 8,
      name: 'Standard Stress Test: 2,000 Queries on 1,000 Words (nodes < 10% brute-force)',
      fn: () => {
        const catalog = generateRandomCatalog(1000, 20261125);
        const idx = new PrefixSuffixIndex();
        const stats = idx.build(catalog);
        const queries = generateBatchQueries(catalog, 2000, 998877);

        let totalNodes = 0;
        let totalBrute = 0;
        for (const q of queries) {
          const tRes = idx.query(q.prefix, q.suffix, { trace: false });
          const bRes = bruteForceQuery(catalog, q.prefix, q.suffix);
          assertEqual(tRes.id, bRes.id, `Mismatch at ${q.prefix}+${q.suffix}`);
          totalNodes += tRes.nodesVisited;
          totalBrute += bRes.recordsExamined;
        }
        assert(
          totalNodes < 0.1 * totalBrute,
          `Expected totalNodes (${totalNodes}) < 0.1 * totalBrute (${totalBrute})`,
        );
        const ratio = (totalBrute / totalNodes).toFixed(1);
        return `Build ${stats.buildTimeMs}ms · ${totalNodes.toLocaleString()} nodes vs ${totalBrute.toLocaleString()} scans (${ratio}x fewer)`;
      },
    },
    {
      id: 9,
      name: 'Extension Scale: 3,000 Words + 5,000 Queries',
      fn: () => {
        const catalog = generateRandomCatalog(3000, 777333);
        const idx = new PrefixSuffixIndex();
        const stats = idx.build(catalog);
        const queries = generateBatchQueries(catalog, 5000, 123456);

        let hits = 0;
        let totalNodes = 0;
        for (const q of queries) {
          const res = idx.query(q.prefix, q.suffix, { trace: false });
          if (res.matched) hits++;
          totalNodes += res.nodesVisited;
        }
        // Spot-verify 200 queries against brute force
        for (let i = 0; i < 200; i++) {
          const q = queries[i * 25];
          const tRes = idx.query(q.prefix, q.suffix, { trace: false });
          const bRes = bruteForceQuery(catalog, q.prefix, q.suffix);
          assertEqual(tRes.id, bRes.id, `Scale spot-check failed on ${q.prefix}+${q.suffix}`);
        }
        return `3,000 words (${stats.trieNodes.toLocaleString()} nodes, ${stats.buildTimeMs}ms) · 5,000 queries (${hits} hits, ${totalNodes.toLocaleString()} nodes)`;
      },
    },
    {
      id: 10,
      name: 'Incremental Add: add("catnip") Without Rebuild',
      fn: () => {
        const idx = new PrefixSuffixIndex();
        idx.build(TUTORIAL_CATALOG);
        const beforeNodes = idx.stats().trieNodes;

        const addRes = idx.add('catnip');
        assertEqual(addRes.id, 3, 'New ID should be 3');
        // 'catnip' has length 6 -> 7 keys, max chars = 7 + 8 + 9 + 10 + 11 + 12 + 13 = 70 (<= 9 keys' worth)
        assert(addRes.nodesAdded > 0 && addRes.nodesAdded <= 70, `Unexpected nodesAdded=${addRes.nodesAdded}`);
        assertEqual(idx.stats().trieNodes, beforeNodes + addRes.nodesAdded, 'Total nodes grew incrementally');

        const rNew = idx.query('cat', 'ip');
        assertEqual(rNew.id, 3, 'New word should be found');
        assertEqual(rNew.word, 'catnip', 'New word value');

        const rOld = idx.query('cat', 'og');
        assertEqual(rOld.id, 2, 'Existing answer catdog (#2) unchanged');

        return `Added "catnip" (#3): +${addRes.nodesAdded} nodes, 0 rebuilt`;
      },
    },
    {
      id: 11,
      name: 'Determinism: Byte-Identical JSON Across Repeated Runs',
      fn: () => {
        const catalog = generateRandomCatalog(200, 55555);
        const queries = generateBatchQueries(catalog, 100, 66666);

        const runOnce = () => {
          const idx = new PrefixSuffixIndex();
          idx.build(catalog);
          return queries.map((q) => {
            const r = idx.query(q.prefix, q.suffix, { trace: false });
            return { matched: r.matched, id: r.id, word: r.word, nodesVisited: r.nodesVisited, diagnosis: r.diagnosis?.code ?? null };
          });
        };

        const jsonA = JSON.stringify(runOnce());
        const jsonB = JSON.stringify(runOnce());
        assertEqual(jsonA, jsonB, 'JSON outputs must be byte-identical');
        return `100 queries produced byte-identical ${jsonA.length}-byte JSON across runs`;
      },
    },
    {
      id: 12,
      name: 'No-Scan Proof: Zero Full-Record Reads During Query Execution',
      fn: () => {
        const catalog = generateRandomCatalog(500, 314159);
        const idx = new PrefixSuffixIndex();
        idx.build(catalog);

        let arrayReads = 0;
        const originalWords = idx.words;
        idx.words = new Proxy(originalWords, {
          get(target, prop, receiver) {
            if (typeof prop === 'string' && /^\d+$/.test(prop)) {
              arrayReads++;
            }
            return Reflect.get(target, prop, receiver);
          },
        });

        // 1. On a miss: 0 reads of words[]
        arrayReads = 0;
        const missRes = idx.query('zzz', 'qqq');
        assert(!missRes.matched, 'Expected miss');
        assertEqual(arrayReads, 0, 'Miss must perform 0 words[] reads');

        // 2. On a hit: exactly 1 read of words[id]
        arrayReads = 0;
        const sample = originalWords[250];
        const hitRes = idx.query(sample.slice(0, 3), sample.slice(-3));
        assert(hitRes.matched, 'Expected hit');
        assertEqual(arrayReads, 1, 'Hit must perform exactly 1 words[id] read (zero scanning)');

        idx.words = originalWords;
        return 'Miss = 0 words[] reads · Hit = 1 words[id] lookup (0 scans)';
      },
    },
  ];

  const results = cases.map((testCase) => {
    const t0 = nowMs();
    try {
      const detail = testCase.fn();
      return {
        id: testCase.id,
        name: testCase.name,
        passed: true,
        durationMs: Number((nowMs() - t0).toFixed(2)),
        detail,
      };
    } catch (err) {
      return {
        id: testCase.id,
        name: testCase.name,
        passed: false,
        durationMs: Number((nowMs() - t0).toFixed(2)),
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  return {
    passed,
    failed,
    total: results.length,
    totalMs: Number((nowMs() - suiteStart).toFixed(2)),
    results,
  };
}

// Auto-run if executed directly via Node CLI (`node tests.js`)
const isNodeCli =
  typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('tests.js');

if (isNodeCli) {
  const report = runAllTests();
  console.log('\n=== The Half-Remembered Library — Test Suite ===\n');
  for (const r of report.results) {
    const mark = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${mark}] #${r.id} ${r.name} (${r.durationMs}ms)`);
    console.log(`       ${r.detail}`);
  }
  console.log(
    `\nSummary: ${report.passed}/${report.total} passed, ${report.failed} failed in ${report.totalMs}ms.\n`,
  );
  if (report.failed > 0) {
    process.exitCode = 1;
  }
}
