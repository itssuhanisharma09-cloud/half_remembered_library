export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export interface CatalogParseError {
  line: number;
  text: string;
  reason: string;
}

export interface CatalogParseResult {
  valid: boolean;
  words: string[];
  errors: CatalogParseError[];
}

export interface BruteForceResult {
  matched: boolean;
  id: number | null;
  word: string | null;
  recordsExamined: number;
  durationUs: number;
}

export interface WordRotation {
  k: number;
  suffix: string;
  key: string;
}

export interface SiblingBranch {
  char: string;
  slot: number;
  nodeId: number;
  maxId: number;
}

export interface TriePathStep {
  nodeId: number;
  char: string;
  segment: 'root' | 'suffix' | 'separator' | 'prefix';
  maxId: number;
  siblings: SiblingBranch[];
}

export interface FailedQueryInfo {
  part: 'suffix' | 'prefix';
  index: number;
  char: string;
  keyIndex: number;
  reason: string;
}

export interface DiagnosisInfo {
  code: 'NO_SUFFIX' | 'NO_PREFIX' | 'BOTH_SEPARATE';
  message: string;
}

export interface LoosenHint {
  suggestedPrefix: string;
  suggestedSuffix: string;
  id: number;
}

export interface QueryResult {
  matched: boolean;
  valid: boolean;
  error: string | null;
  id: number | null;
  word: string | null;
  nodesVisited: number;
  durationUs: number;
  path: TriePathStep[];
  failedAt: FailedQueryInfo | null;
  diagnosis: DiagnosisInfo | null;
  hint: LoosenHint | null;
}

export interface IndexStats {
  wordCount: number;
  uniqueWordCount: number;
  duplicateGroups: number;
  trieNodes: number;
  buildTimeMs: number;
  memoryBytes: number;
  memoryFormatted: string;
}

export interface IncrementalAddResult {
  id: number;
  word: string;
  nodesAdded: number;
  totalNodes: number;
}

export function validateClue(clue: unknown, label?: string): ValidationResult;
export function validateCatalogWord(word: unknown, maxLength?: number): ValidationResult;
export function validateCatalogText(
  rawText: string,
  maxWords?: number,
  maxLength?: number,
): CatalogParseResult;
export function bruteForceQuery(words: string[], prefix: string, suffix: string): BruteForceResult;
export function getWordRotations(word: string): WordRotation[];

export class PrefixSuffixIndex {
  maxWordLength: number;
  words: string[];
  ids: number[];
  constructor(options?: { maxWordLength?: number });
  build(words: string[]): IndexStats;
  add(word: string): IncrementalAddResult;
  query(prefix: string, suffix: string, options?: { trace?: boolean }): QueryResult;
  getDuplicateIds(word: string): number[];
  findAllMatchingIdsForDisplay(prefix: string, suffix: string): number[];
  stats(): IndexStats;
}
