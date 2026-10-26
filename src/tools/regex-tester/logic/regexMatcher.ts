import { RegexTestResult, RegexMatchItem } from '../types';
import { validateInputSize } from '../../../lib/security/safeParser';

const MAX_SAFE_MATCHES = 1000;

/**
 * Safely tests a regex against input string with match extraction and replace support.
 */
export function testRegex(
  pattern: string,
  flags: string,
  testString: string,
  replacementString?: string
): RegexTestResult {
  const startTime = performance.now();

  if (!pattern) {
    return {
      isValid: true,
      matches: [],
      executionTimeMs: 0
    };
  }

  // Guard against massive input freezing the browser
  const sizeCheck = validateInputSize(testString);
  if (!sizeCheck.valid) {
    return {
      isValid: false,
      error: sizeCheck.error,
      matches: [],
      executionTimeMs: 0
    };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Invalid Regular Expression syntax',
      matches: [],
      executionTimeMs: performance.now() - startTime
    };
  }

  const matches: RegexMatchItem[] = [];
  let replacedText: string | undefined = undefined;

  try {
    if (replacementString !== undefined) {
      replacedText = testString.replace(regex, replacementString);
    }

    // Extract matches
    if (regex.global) {
      let match: RegExpExecArray | null;
      let iterations = 0;
      while ((match = regex.exec(testString)) !== null) {
        iterations++;
        if (iterations > MAX_SAFE_MATCHES) {
          break; // Avoid infinite loops on zero-length matches
        }

        const groups = match.slice(1);
        matches.push({
          index: iterations - 1,
          match: match[0],
          groups: groups.length > 0 ? groups : undefined,
          namedGroups: match.groups ? { ...match.groups } : undefined,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });

        // Avoid infinite loop on zero-width match
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } else {
      const match = regex.exec(testString);
      if (match) {
        const groups = match.slice(1);
        matches.push({
          index: 0,
          match: match[0],
          groups: groups.length > 0 ? groups : undefined,
          namedGroups: match.groups ? { ...match.groups } : undefined,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });
      }
    }

    return {
      isValid: true,
      matches,
      replacedText,
      executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100
    };
  } catch (err) {
    return {
      isValid: false,
      error: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
      matches: [],
      executionTimeMs: performance.now() - startTime
    };
  }
}
