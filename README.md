# The Half-Remembered Library — Partial-Title Retrieval System

An interactive web application and framework-free trie engine that resolves a **prefix** and **suffix** simultaneously in **$O(P + S)$** time—independent of catalog size—returning the **last-added (highest ID)** matching record.

## How to Run

### Web Application
```bash
npm install
npm run dev
```
Open the local dev URL (port `3000`) in your browser.

### Headless Test Suite (Node, zero dependencies)
```bash
node tests.js
```
All 12 tests also run inside the application's **Built-In Verification Suite** panel.

## Complexity Analysis

Let $N$ be the catalog size, $L \le 8$ the maximum title length, $P$ the query prefix length, and $S$ the query suffix length:

- **Build Time**: $O(N \cdot L^2)$. Each word $w$ inserts $L + 1$ keys (`w.slice(k) + '#' + w` for $k = 0 \dots |w|$) of length $\le 2L + 1$. With our flat `Int32Array` node arena, 3,000 words build in ~25 ms.
- **Query Time**: $O(P + S)$. Walking `suffix + '#' + prefix` inspects at most $S + 1 + P$ trie nodes and performs at most one $O(1)$ array lookup `words[id]` on match—zero catalog scanning.
- **Space Complexity**: $O(N \cdot L^2)$ trie nodes worst-case (~85k nodes for $N = 3{,}000, L = 8$, ~9.5 MB in a contiguous `Int32Array` pool with 28 `Int32` slots per node: 26 letters + `'#'` + `maxId`).
- **Incremental Insert (`add(word)`)**: $O(L^2)$ without rebuilding the index.

## Design Decisions

1. **Flat `Int32Array` Arena (`src/core/index-core.js`)**: Eliminates per-node JS object/GC overhead, keeps 3,000-word builds under 30 ms, and ensures deterministic microsecond queries.
2. **Framework-Free Core**: `PrefixSuffixIndex` has zero DOM/React dependencies and runs identically in Node (`tests.js`) and the browser.
3. **Deterministic No-Match Diagnosis**: When walking `suffix + '#' + prefix` fails at index $i$:
   - $i \le |suffix|$ (failing inside `suffix` or on `'#'` right after `suffix`) $\rightarrow$ `NO_SUFFIX` (*"No title ends with '...'"*).
   - $i > |suffix|$ $\rightarrow$ walks `'#' + prefix` to distinguish `NO_PREFIX` (*"Titles end with '...', but none begin with '...'"*) from `BOTH_SEPARATE` (*"Both clues exist separately, but no single title has both"*).
4. **Silent Brute-Force Verification**: Every interactive query verifies its result against a backward-scanning oracle (`bruteForceQuery`) and charts cumulative work divergence.

## Requirement Checklist

| Requirement | Where It Lives |
|---|---|
| Fixed insertion order IDs (`0, 1, 2, ...`) & duplicate preservation | `src/core/index-core.js` (`PrefixSuffixIndex.build`, `_occurrences`), `src/components/TheShelf.tsx` |
| Non-empty lowercase `a-z` validation with inline feedback | `validateClue` / `validateCatalogWord` in `src/core/index-core.js`, `src/components/SearchAltar.tsx` |
| `suffix#prefix` trie + `k = len(w)` key + `maxId` overwrite | `PrefixSuffixIndex._insertWordKeys` & `query` in `src/core/index-core.js` |
| Worked example (`[catalog, catch, catdog]`, `cat`+`og` $\rightarrow$ `catdog` `#2`) | `TUTORIAL_CATALOG` in `src/core/datasets.js`, `Try Worked Example` in `SearchAltar.tsx` |
| No-match deterministic diagnosis (`NO_SUFFIX`, `NO_PREFIX`, `BOTH_SEPARATE`) | `PrefixSuffixIndex.query` (`src/core/index-core.js`), `ResultCard.tsx`, `TrieObservatory.tsx` |
| Extension Mode (3,000 words, 5,000 queries, incremental `add(word)`) | `PrefixSuffixIndex.add`, `BatchLab.tsx`, `CatalogManagerModal.tsx` |
| Trie Observatory (zoomed neighborhood, `requestAnimationFrame`, speed & step controls) | `src/components/TrieObservatory.tsx` |
| Virtualized Bookshelf with newest-match elevation & duplicate stacks | `src/components/TheShelf.tsx` |
| Efficiency Duel (live race, oracle verification, cumulative divergence chart) | `src/components/EfficiencyDuel.tsx` |
| Batch Lab (2,000/5,000 queries, histogram, most contested pair, custom paste, CSV export) | `src/components/BatchLab.tsx` |
| Unseen Demo Catalog (~42 words) & 5-step auto-playing Demo Script | `UNSEEN_DEMO_CATALOG` & `DEMO_SCRIPT_STEPS` in `src/core/datasets.js`, `SearchAltar.tsx` |
| 12-Test Suite (Node CLI `node tests.js` + In-App Runner) | `/tests.js`, `src/components/TestRunnerPanel.tsx` |
| Extras (Guided Tour, Teach Me, History, Shortcuts/`Ctrl+K`, Web Audio, Dual Theme, A11y) | `GuidedTour.tsx`, `TeachMeModal.tsx`, `CommandPalette.tsx`, `sound.ts`, `App.tsx` |
