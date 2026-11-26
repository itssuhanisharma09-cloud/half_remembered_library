export interface TestCaseResult {
  id: number;
  name: string;
  passed: boolean;
  durationMs: number;
  detail: string;
}

export interface TestSuiteReport {
  passed: number;
  failed: number;
  total: number;
  totalMs: number;
  results: TestCaseResult[];
}

export function runAllTests(): TestSuiteReport;
