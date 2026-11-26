/**
 * @fileoverview Deterministic datasets, seeded catalog/query generators, and demo script.
 */

/**
 * Deterministic 32-bit seeded PRNG (Mulberry32).
 * @param {number} seed
 * @returns {() => number} returns float in [0, 1)
 */
export function createSeededRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TUTORIAL_CATALOG = ['catalog', 'catch', 'catdog'];

/**
 * Engineered 42-word Unseen Demo Catalog (all lowercase a-z, length <= 8)
 * with overlapping prefixes/suffixes and deliberate duplicates ("paper" x3).
 */
export const UNSEEN_DEMO_CATALOG = [
  'paper',    // 0 (duplicate #1)
  'stone',    // 1
  'stove',    // 2
  'stripe',   // 3
  'strike',   // 4
  'starter',  // 5
  'preload',  // 6
  'prepaid',  // 7
  'pressed',  // 8
  'chapter',  // 9
  'amber',    // 10
  'anchor',   // 11
  'archive',  // 12
  'lantern',  // 13
  'ledger',   // 14
  'velvet',   // 15
  'vessel',   // 16
  'violet',   // 17
  'paper',    // 18 (duplicate #2)
  'strainer', // 19
  'stream',   // 20
  'strained', // 21
  'stranded', // 22
  'striving', // 23
  'striker',  // 24
  'pressing', // 25
  'prepare',  // 26
  'printer',  // 27
  'printed',  // 28
  'printing', // 29
  'charter',  // 30
  'cipher',   // 31
  'quill',    // 32
  'scroll',   // 33
  'folio',    // 34
  'codex',    // 35
  'tome',     // 36
  'paper',    // 37 (duplicate #3 -> newest wins!)
  'strider',  // 38 (newest str* + *er)
  'stave',    // 39
  'stare',    // 40
  'index',    // 41
];

const PREFIX_POOL = [
  'cat', 'str', 'pre', 'pro', 'con', 'dis', 'tra', 'mar', 'ver', 'arc',
  'lan', 'chr', 'pal', 'mon', 'sol', 'lum', 'vel', 'sil', 'car', 'bar',
  'for', 'cor', 'mor', 'dor', 'bel', 'mel', 'tal', 'cal', 'hal', 'val',
];

const MIDDLE_POOL = ['', 'a', 'e', 'i', 'o', 'u', 'n', 'r', 'l', 't', 's'];

const SUFFIX_POOL = [
  'er', 'ed', 'ing', 'or', 'on', 'en', 'al', 'el', 'is', 'us',
  'og', 'ex', 'um', 'ar', 'et', 'ot', 'ic', 'id', 'le', 've',
];

/**
 * Generates a deterministic seeded catalog of lowercase words (length <= 8).
 * Guarantees shared prefixes/suffixes and ~8% natural duplicates.
 * @param {number} [count=1000]
 * @param {number} [seed=20261125]
 * @returns {string[]}
 */
export function generateRandomCatalog(count = 1000, seed = 20261125) {
  const rng = createSeededRng(seed);
  const words = [];

  for (let i = 0; i < count; i++) {
    // ~8% deliberate duplicate of an earlier word
    if (words.length > 20 && rng() < 0.08) {
      const dupIdx = Math.floor(rng() * words.length);
      words.push(words[dupIdx]);
      continue;
    }

    const pre = PREFIX_POOL[Math.floor(rng() * PREFIX_POOL.length)];
    const mid = MIDDLE_POOL[Math.floor(rng() * MIDDLE_POOL.length)];
    const suf = SUFFIX_POOL[Math.floor(rng() * SUFFIX_POOL.length)];
    let word = pre + mid + suf;

    if (word.length > 8) {
      word = word.slice(0, 8);
    }
    words.push(word);
  }

  return words;
}

/**
 * Generates a deterministic batch of queries (~60% guaranteed hits, ~30% ambiguous multi-match, ~10% misses).
 * @param {string[]} words
 * @param {number} [count=2000]
 * @param {number} [seed=987654321]
 * @returns {Array<{ prefix: string, suffix: string, category: 'hit' | 'ambiguous' | 'miss' }>}
 */
export function generateBatchQueries(words, count = 2000, seed = 987654321) {
  const rng = createSeededRng(seed);
  const queries = new Array(count);

  for (let i = 0; i < count; i++) {
    const roll = rng();
    if (roll < 0.6) {
      // Guaranteed hit: longer prefix/suffix from a real word
      const w = words[Math.floor(rng() * words.length)];
      const pLen = Math.min(w.length, 2 + Math.floor(rng() * 3)); // 2..4
      const sLen = Math.min(w.length, 2 + Math.floor(rng() * 3)); // 2..4
      queries[i] = {
        prefix: w.slice(0, pLen),
        suffix: w.slice(w.length - sLen),
        category: 'hit',
      };
    } else if (roll < 0.9) {
      // Ambiguous multi-match: short 1..2 char prefix + 1..2 char suffix from a real word
      const w = words[Math.floor(rng() * words.length)];
      const pLen = Math.min(w.length, 1 + Math.floor(rng() * 2));
      const sLen = Math.min(w.length, 1 + Math.floor(rng() * 2));
      queries[i] = {
        prefix: w.slice(0, pLen),
        suffix: w.slice(w.length - sLen),
        category: 'ambiguous',
      };
    } else {
      // Guaranteed miss using impossible combinations or rare endings
      const missPatterns = [
        ['zzz', 'qqq'],
        ['x', 'zzz'],
        ['q', 'xyz'],
        [words[0].slice(0, 2), 'zxq'],
        ['qq', words[words.length - 1].slice(-2)],
      ];
      const pair = missPatterns[Math.floor(rng() * missPatterns.length)];
      queries[i] = {
        prefix: pair[0],
        suffix: pair[1],
        category: 'miss',
      };
    }
  }

  return queries;
}

export const DEMO_SCRIPT_STEPS = [
  {
    id: 1,
    title: 'Multi-Match Priority (Newest Wins)',
    narration:
      'Query "str" + "er" matches starter (#5), strainer (#19), striker (#24), and strider (#38). The trie returns #38 immediately without scanning.',
    type: 'query',
    prefix: 'str',
    suffix: 'er',
  },
  {
    id: 2,
    title: 'Duplicate Records Preserve Latest ID',
    narration:
      '"paper" was inserted three times at IDs #0, #18, and #37. Overwriting maxId during insertion naturally resolves "pa" + "er" to #37.',
    type: 'query',
    prefix: 'pa',
    suffix: 'er',
  },
  {
    id: 3,
    title: 'Diagnosis: Both Clues Exist Separately',
    narration:
      '"quill" begins with "qu" and several titles end in "ing", yet no single title has both. The trie verifies both paths and reports the exact split.',
    type: 'query',
    prefix: 'qu',
    suffix: 'ing',
  },
  {
    id: 4,
    title: 'Diagnosis: Missing Suffix Path',
    narration:
      'Walking "xyz#str" halts at the very first character "x", proving in 1 step that no title in the catalog ends with "xyz".',
    type: 'query',
    prefix: 'str',
    suffix: 'xyz',
  },
  {
    id: 5,
    title: '2,000-Query Efficiency Duel Burst',
    narration:
      'Runs 2,000 deterministic queries and compares total trie nodes visited against brute-force catalog scans.',
    type: 'batch',
    batchCount: 2000,
  },
];
