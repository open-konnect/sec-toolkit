export interface RegexMatchItem {
  index: number;
  match: string;
  groups?: string[];
  namedGroups?: Record<string, string>;
  startIndex: number;
  endIndex: number;
}

export interface RegexTestResult {
  isValid: boolean;
  error?: string;
  matches: RegexMatchItem[];
  replacedText?: string;
  executionTimeMs: number;
}
