export function createSeededRng(seed: number): () => number;
export const TUTORIAL_CATALOG: string[];
export const UNSEEN_DEMO_CATALOG: string[];

export function generateRandomCatalog(count?: number, seed?: number): string[];

export interface BatchQuerySpec {
  prefix: string;
  suffix: string;
  category: 'hit' | 'ambiguous' | 'miss';
}

export function generateBatchQueries(
  words: string[],
  count?: number,
  seed?: number,
): BatchQuerySpec[];

export interface DemoScriptStep {
  id: number;
  title: string;
  narration: string;
  type: 'query' | 'batch';
  prefix?: string;
  suffix?: string;
  batchCount?: number;
}

export const DEMO_SCRIPT_STEPS: DemoScriptStep[];
