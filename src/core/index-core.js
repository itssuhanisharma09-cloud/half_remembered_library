/**
 * @fileoverview Framework-free Prefix + Suffix Trie Index ("suffix#prefix" technique).
 *
 * Uses a flat, cache-friendly Int32Array arena to store trie nodes with 27 child slots
 * ('a'-'z' as 0..25, '#' as 26) plus a maxId slot (27), achieving O(N * L^2) build time
 * and strict O(P + S) query time with zero full-record scanning.
 */

const ALPHABET_SIZE = 26;
const HASH_SLOT = 26;
const MAX_ID_OFFSET = 27;
const STRIDE = 28; // 26 letters + '#' + maxId

const VALID_WORD_REGEX = /^[a-z]{1,8}$/;
const VALID_CLUE_REGEX = /^[a-z]+$/;

/**
 * High-resolution timer helper in microseconds, compatible with Browser and Node.
 * @returns {number}
 */
function nowUs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now() * 1000;
  }
  if (typeof process !== 'undefined' && typeof process.hrtime === 'function') {
    const [sec, ns] = process.hrtime();
    return sec * 1e6 + ns / 1e3;
  }
  return Date.now() * 1000;
}

/**
 * Validates a single query clue (prefix or suffix).
 * Rejects empty strings, spaces, digits, uppercase letters, or punctuation.
 * @param {unknown} clue
 * @param {string} [label='clue']
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateClue(clue, label = 'Clue') {
  if (typeof clue !== 'string' || clue.length === 0) {
    return { valid: false, error: `${label} cannot be empty.` };
  }
  if (/\s/.test(clue)) {
    return { valid: false, error: `${label} cannot contain spaces or whitespace.` };
  }
  if (/[A-Z]/.test(clue)) {
    return { valid: false, error: `${label} must be lowercase (a-z only).` };
  }
  if (!VALID_CLUE_REGEX.test(clue)) {
    return { valid: false, error: `${label} must contain only lowercase letters a-z.` };
  }
  return { valid: true, error: null };
}

/**
 * Validates a single catalog word (lowercase a-z, length 1..8).
 * @param {unknown} word
 * @param {number} [maxLength=8]
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateCatalogWord(word, maxLength = 8) {
  if (typeof word !== 'string' || word.length === 0) {
    return { valid: false, error: 'Title cannot be empty.' };
  }
  if (/\s/.test(word)) {
    return { valid: false, error: 'Must be a single word with no spaces.' };
  }
  if (/[A-Z]/.test(word)) {
    return { valid: false, error: 'Must be lowercase (a-z only).' };
  }
  if (!VALID_CLUE_REGEX.test(word)) {
    return { valid: false, error: 'Must contain only lowercase letters a-z.' };
  }
  if (word.length > maxLength) {
    return { valid: false, error: `Length ${word.length} exceeds maximum of ${maxLength} characters.` };
  }
  return { valid: true, error: null };
}

/**
 * Parses and validates raw multiline catalog text.
 * @param {string} rawText
 * @param {number} [maxWords=1000]
 * @param {number} [maxLength=8]
 * @returns {{ valid: boolean, words: string[], errors: Array<{ line: number, text: string, reason: string }> }}
 */
export function validateCatalogText(rawText, maxWords = 1000, maxLength = 8) {
  const lines = rawText.split(/\r?\n/);
  const words = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === '') continue; // skip trailing/blank empty lines
    const check = validateCatalogWord(raw, maxLength);
    if (!check.valid) {
      errors.push({ line: i + 1, text: raw, reason: check.error || 'Invalid entry.' });
    } else {
      words.push(raw);
    }
  }

  if (words.length === 0 && errors.length === 0) {
    errors.push({ line: 1, text: '', reason: 'Catalog must contain at least one valid word.' });
  }
  if (words.length > maxWords) {
    errors.push({
      line: maxWords + 1,
      text: words[maxWords],
      reason: `Catalog has ${words.length} words, exceeding limit of ${maxWords}.`,
    });
  }

  return {
    valid: errors.length === 0,
    words,
    errors,
  };
}

/**
 * Brute-force baseline oracle scanning from the newest record (highest ID) backward.
 * Guarantees deterministic verification against the trie index.
 * @param {string[]} words
 * @param {string} prefix
 * @param {string} suffix
 * @returns {{ matched: boolean, id: number | null, word: string | null, recordsExamined: number, durationUs: number }}
 */
export function bruteForceQuery(words, prefix, suffix) {
  const t0 = nowUs();
  let recordsExamined = 0;
  for (let i = words.length - 1; i >= 0; i--) {
    recordsExamined++;
    const w = words[i];
    if (w.startsWith(prefix) && w.endsWith(suffix)) {
      return {
        matched: true,
        id: i,
        word: w,
        recordsExamined,
        durationUs: Math.max(0.1, nowUs() - t0),
      };
    }
  }
  return {
    matched: false,
    id: null,
    word: null,
    recordsExamined,
    durationUs: Math.max(0.1, nowUs() - t0),
  };
}

/**
 * Generates all suffix#word keys for a given word, used for teaching/visualization.
 * @param {string} word
 * @returns {Array<{ k: number, suffix: string, key: string }>}
 */
export function getWordRotations(word) {
  const rotations = [];
  for (let k = 0; k <= word.length; k++) {
    const suffix = word.slice(k);
    rotations.push({
      k,
      suffix,
      key: `${suffix}#${word}`,
    });
  }
  return rotations;
}

/**
 * Suffix#Prefix Trie Index for O(P + S) partial-title retrieval.
 */
export class PrefixSuffixIndex {
  /**
   * @param {{ maxWordLength?: number }} [options]
   */
  constructor(options = {}) {
    this.maxWordLength = options.maxWordLength ?? 8;
    /** @type {string[]} */
    this.words = [];
    /** @type {number[]} */
    this.ids = [];
    /** @type {Map<string, number[]>} */
    this._occurrences = new Map();
    this._capacity = 1024;
    this._pool = new Int32Array(this._capacity * STRIDE);
    this._nodeCount = 0;
    this._buildTimeMs = 0;
    this._initRoot();
  }

  _initRoot() {
    this._nodeCount = 1;
    this._pool.fill(-1, 0, STRIDE);
  }

  /**
   * Ensures capacity for at least one more node and returns its index.
   * @returns {number}
   */
  _allocateNode() {
    if (this._nodeCount >= this._capacity) {
      const nextCapacity = this._capacity * 2;
      const nextPool = new Int32Array(nextCapacity * STRIDE);
      nextPool.set(this._pool.subarray(0, this._nodeCount * STRIDE));
      this._pool = nextPool;
      this._capacity = nextCapacity;
    }
    const idx = this._nodeCount++;
    const base = idx * STRIDE;
    this._pool.fill(-1, base, base + STRIDE);
    return idx;
  }

  /**
   * @param {string} ch
   * @returns {number}
   */
  _charToSlot(ch) {
    const code = ch.charCodeAt(0);
    if (code === 35) return HASH_SLOT; // '#'
    if (code >= 97 && code <= 122) return code - 97; // 'a'-'z'
    return -1;
  }

  /**
   * @param {number} slot
   * @returns {string}
   */
  _slotToChar(slot) {
    return slot === HASH_SLOT ? '#' : String.fromCharCode(97 + slot);
  }

  /**
   * Inserts all (w.slice(k) + '#' + w) keys for k = 0..w.length with maxId = id.
   * Walks character indices directly without allocating concatenated key strings.
   * @param {string} w
   * @param {number} id
   * @returns {number} number of newly created trie nodes
   */
  _insertWordKeys(w, id) {
    let nodesCreated = 0;
    const len = w.length;

    // Pre-convert word characters to slot indices once
    const slots = new Int32Array(len);
    for (let i = 0; i < len; i++) {
      slots[i] = w.charCodeAt(i) - 97;
    }

    for (let k = 0; k <= len; k++) {
      let node = 0;
      this._pool[MAX_ID_OFFSET] = id;

      // 1. Walk suffix w.slice(k)
      for (let s = k; s < len; s++) {
        const slot = slots[s];
        const offset = node * STRIDE + slot;
        let child = this._pool[offset];
        if (child === -1) {
          child = this._allocateNode();
          this._pool[offset] = child;
          nodesCreated++;
        }
        node = child;
        this._pool[node * STRIDE + MAX_ID_OFFSET] = id;
      }

      // 2. Walk '#'
      {
        const offset = node * STRIDE + HASH_SLOT;
        let child = this._pool[offset];
        if (child === -1) {
          child = this._allocateNode();
          this._pool[offset] = child;
          nodesCreated++;
        }
        node = child;
        this._pool[node * STRIDE + MAX_ID_OFFSET] = id;
      }

      // 3. Walk full word w
      for (let p = 0; p < len; p++) {
        const slot = slots[p];
        const offset = node * STRIDE + slot;
        let child = this._pool[offset];
        if (child === -1) {
          child = this._allocateNode();
          this._pool[offset] = child;
          nodesCreated++;
        }
        node = child;
        this._pool[node * STRIDE + MAX_ID_OFFSET] = id;
      }
    }

    return nodesCreated;
  }

  /**
   * Builds the trie index once from a fixed-order list of catalog words.
   * @param {string[]} words
   * @returns {ReturnType<PrefixSuffixIndex['stats']>}
   */
  build(words) {
    const t0 = nowUs();
    if (!Array.isArray(words)) {
      throw new TypeError('build(words) requires an array of strings.');
    }

    // Estimate capacity upfront to minimize reallocations (~68 nodes per 8-char word)
    const estimatedNodes = Math.max(1024, words.length * 72);
    if (this._capacity < estimatedNodes) {
      this._capacity = estimatedNodes;
      this._pool = new Int32Array(this._capacity * STRIDE);
    }

    this.words = new Array(words.length);
    this.ids = new Array(words.length);
    this._occurrences = new Map();
    this._initRoot();

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!VALID_WORD_REGEX.test(w) && (typeof w !== 'string' || !validateCatalogWord(w, this.maxWordLength).valid)) {
        const check = validateCatalogWord(w, this.maxWordLength);
        throw new Error(`Invalid word at index ${i} ("${w}"): ${check.error}`);
      }
      this.words[i] = w;
      this.ids[i] = i;

      let occ = this._occurrences.get(w);
      if (!occ) {
        occ = [i];
        this._occurrences.set(w, occ);
      } else {
        occ.push(i);
      }

      this._insertWordKeys(w, i);
    }

    this._buildTimeMs = (nowUs() - t0) / 1000;
    return this.stats();
  }

  /**
   * Incrementally inserts a single new word without rebuilding the trie.
   * @param {string} word
   * @returns {{ id: number, word: string, nodesAdded: number, totalNodes: number }}
   */
  add(word) {
    const check = validateCatalogWord(word, this.maxWordLength);
    if (!check.valid) {
      throw new Error(`Cannot add "${word}": ${check.error}`);
    }
    const id = this.words.length;
    this.words.push(word);
    this.ids.push(id);

    let occ = this._occurrences.get(word);
    if (!occ) {
      occ = [id];
      this._occurrences.set(word, occ);
    } else {
      occ.push(id);
    }

    const nodesAdded = this._insertWordKeys(word, id);
    return {
      id,
      word,
      nodesAdded,
      totalNodes: this._nodeCount,
    };
  }

  /**
   * Collects immediate sibling branches of a node (used for Trie Observatory visualization).
   * Never touches words[].
   * @param {number} nodeId
   * @param {number} activeSlot
   * @param {number} [limit=5]
   * @returns {Array<{ char: string, slot: number, nodeId: number, maxId: number }>}
   */
  _getSiblings(nodeId, activeSlot, limit = 5) {
    const base = nodeId * STRIDE;
    const siblings = [];
    for (let slot = 0; slot <= HASH_SLOT; slot++) {
      if (slot === activeSlot) continue;
      const child = this._pool[base + slot];
      if (child !== -1) {
        siblings.push({
          char: this._slotToChar(slot),
          slot,
          nodeId: child,
          maxId: this._pool[child * STRIDE + MAX_ID_OFFSET],
        });
      }
    }
    if (siblings.length > limit) {
      siblings.sort((a, b) => b.maxId - a.maxId);
      return siblings.slice(0, limit);
    }
    return siblings;
  }

  /**
   * Walks a raw key string in the trie without touching words[].
   * @param {string} key
   * @returns {{ found: boolean, maxId: number, nodesVisited: number }}
   */
  _walkKeyOnly(key) {
    let node = 0;
    let nodesVisited = 1;
    for (let i = 0; i < key.length; i++) {
      const slot = this._charToSlot(key[i]);
      if (slot === -1) return { found: false, maxId: -1, nodesVisited };
      const child = this._pool[node * STRIDE + slot];
      if (child === -1) return { found: false, maxId: -1, nodesVisited };
      node = child;
      nodesVisited++;
    }
    return {
      found: true,
      maxId: this._pool[node * STRIDE + MAX_ID_OFFSET],
      nodesVisited,
    };
  }

  /**
   * Queries the trie for the newest record matching both prefix and suffix.
   * Strictly O(len(prefix) + len(suffix)) with zero catalog scanning.
   * @param {string} prefix
   * @param {string} suffix
   * @param {{ trace?: boolean }} [options]
   * @returns {{
   *   matched: boolean,
   *   valid: boolean,
   *   error: string | null,
   *   id: number | null,
   *   word: string | null,
   *   nodesVisited: number,
   *   durationUs: number,
   *   path: Array<{
   *     nodeId: number,
   *     char: string,
   *     segment: 'root' | 'suffix' | 'separator' | 'prefix',
   *     maxId: number,
   *     siblings: Array<{ char: string, slot: number, nodeId: number, maxId: number }>
   *   }>,
   *   failedAt: { part: 'suffix' | 'prefix', index: number, char: string, keyIndex: number, reason: string } | null,
   *   diagnosis: { code: 'NO_SUFFIX' | 'NO_PREFIX' | 'BOTH_SEPARATE', message: string } | null,
   *   hint: { suggestedPrefix: string, suggestedSuffix: string, id: number } | null
   * }}
   */
  query(prefix, suffix, options = {}) {
    const pCheck = validateClue(prefix, 'Prefix');
    if (!pCheck.valid) {
      return {
        matched: false,
        valid: false,
        error: pCheck.error,
        id: null,
        word: null,
        nodesVisited: 0,
        durationUs: 0,
        path: [],
        failedAt: null,
        diagnosis: null,
        hint: null,
      };
    }
    const sCheck = validateClue(suffix, 'Suffix');
    if (!sCheck.valid) {
      return {
        matched: false,
        valid: false,
        error: sCheck.error,
        id: null,
        word: null,
        nodesVisited: 0,
        durationUs: 0,
        path: [],
        failedAt: null,
        diagnosis: null,
        hint: null,
      };
    }

    const trace = options.trace !== false;
    const t0 = nowUs();
    const key = `${suffix}#${prefix}`;
    const sLen = suffix.length;

    let node = 0;
    let nodesVisited = 1;
    const path = trace
      ? [
          {
            nodeId: 0,
            char: 'ROOT',
            segment: /** @type {const} */ ('root'),
            maxId: this._pool[MAX_ID_OFFSET],
            siblings: [],
          },
        ]
      : [];

    for (let i = 0; i < key.length; i++) {
      const ch = key[i];
      const slot = this._charToSlot(ch);
      const child = slot === -1 ? -1 : this._pool[node * STRIDE + slot];
      const segment = i < sLen ? 'suffix' : i === sLen ? 'separator' : 'prefix';

      if (trace && path.length > 0) {
        path[path.length - 1].siblings = this._getSiblings(node, child === -1 ? -1 : slot);
      }

      if (child === -1) {
        // Walk failed at key index i -> run deterministic diagnosis without scanning words[]
        let failedAt;
        let diagnosis;

        if (i <= sLen) {
          // Failed either inside suffix (i < sLen) or on '#' right after suffix (i === sLen),
          // meaning no word actually terminates with the full suffix.
          failedAt = {
            part: /** @type {const} */ ('suffix'),
            index: i < sLen ? i : sLen - 1,
            char: i < sLen ? suffix[i] : suffix[sLen - 1],
            keyIndex: i,
            reason: i === sLen ? 'incomplete_suffix' : 'missing_char',
          };
          diagnosis = {
            code: /** @type {const} */ ('NO_SUFFIX'),
            message: `No title ends with '${suffix}'`,
          };
        } else {
          // Suffix + '#' succeeded; failed inside prefix at prefixIdx
          const prefixIdx = i - sLen - 1;
          failedAt = {
            part: /** @type {const} */ ('prefix'),
            index: prefixIdx,
            char: prefix[prefixIdx],
            keyIndex: i,
            reason: 'missing_char',
          };
          const prefixExists = this._walkKeyOnly(`#${prefix}`);
          nodesVisited += prefixExists.nodesVisited;
          if (!prefixExists.found) {
            diagnosis = {
              code: /** @type {const} */ ('NO_PREFIX'),
              message: `Titles end with '${suffix}', but none begin with '${prefix}'`,
            };
          } else {
            diagnosis = {
              code: /** @type {const} */ ('BOTH_SEPARATE'),
              message: 'Both clues exist separately, but no single title has both',
            };
          }
        }

        // Index-only loosen clue hint (never reads words[])
        let hint = null;
        if (trace) {
          if (prefix.length > 1) {
            const pShorter = prefix.slice(0, -1);
            const res = this._walkKeyOnly(`${suffix}#${pShorter}`);
            if (res.found) {
              hint = { suggestedPrefix: pShorter, suggestedSuffix: suffix, id: res.maxId };
            }
          }
          if (!hint && suffix.length > 1) {
            const sShorter = suffix.slice(1);
            const res = this._walkKeyOnly(`${sShorter}#${prefix}`);
            if (res.found) {
              hint = { suggestedPrefix: prefix, suggestedSuffix: sShorter, id: res.maxId };
            }
          }
        }

        return {
          matched: false,
          valid: true,
          error: null,
          id: null,
          word: null,
          nodesVisited,
          durationUs: Math.max(0.1, nowUs() - t0),
          path,
          failedAt,
          diagnosis,
          hint,
        };
      }

      node = child;
      nodesVisited++;

      if (trace) {
        path.push({
          nodeId: node,
          char: ch,
          segment,
          maxId: this._pool[node * STRIDE + MAX_ID_OFFSET],
          siblings: [],
        });
      }
    }

    if (trace && path.length > 0) {
      path[path.length - 1].siblings = this._getSiblings(node, -1);
    }

    const id = this._pool[node * STRIDE + MAX_ID_OFFSET];
    // Single O(1) lookup by ID for display (never scans words[])
    const word = id >= 0 ? this.words[id] : null;

    return {
      matched: id >= 0,
      valid: true,
      error: null,
      id: id >= 0 ? id : null,
      word,
      nodesVisited,
      durationUs: Math.max(0.1, nowUs() - t0),
      path,
      failedAt: null,
      diagnosis: null,
      hint: null,
    };
  }

  /**
   * Returns all insertion IDs for a given exact word (for duplicate display).
   * @param {string} word
   * @returns {number[]}
   */
  getDuplicateIds(word) {
    return this._occurrences.get(word)?.slice() ?? [];
  }

  /**
   * Finds all matching record IDs for UI shelf illumination & "other matches" display.
   * Kept strictly separate from query() so query() never scans words[].
   * @param {string} prefix
   * @param {string} suffix
   * @returns {number[]} descending by ID
   */
  findAllMatchingIdsForDisplay(prefix, suffix) {
    if (!validateClue(prefix).valid || !validateClue(suffix).valid) return [];
    const matches = [];
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      if (w.startsWith(prefix) && w.endsWith(suffix)) {
        matches.push(i);
      }
    }
    return matches;
  }

  /**
   * Returns index statistics and memory estimates.
   */
  stats() {
    let duplicateGroups = 0;
    for (const ids of this._occurrences.values()) {
      if (ids.length > 1) duplicateGroups++;
    }
    const bytesAllocated = this._nodeCount * STRIDE * Int32Array.BYTES_PER_ELEMENT;
    return {
      wordCount: this.words.length,
      uniqueWordCount: this._occurrences.size,
      duplicateGroups,
      trieNodes: this._nodeCount,
      buildTimeMs: Number(this._buildTimeMs.toFixed(2)),
      memoryBytes: bytesAllocated,
      memoryFormatted:
        bytesAllocated >= 1024 * 1024
          ? `${(bytesAllocated / (1024 * 1024)).toFixed(2)} MB`
          : `${(bytesAllocated / 1024).toFixed(1)} KB`,
    };
  }
}
