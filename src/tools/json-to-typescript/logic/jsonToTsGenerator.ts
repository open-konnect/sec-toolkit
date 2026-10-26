import { JsonToTsOptions, JsonToTsResult } from '../types';
import { validateInputSize } from '../../../lib/security/safeParser';

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Item';
}

function isValidIdentifier(key: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

/**
 * Generates TypeScript declarations from raw JSON string.
 */
export function generateTypeScriptFromJson(
  jsonString: string,
  options: JsonToTsOptions = { rootName: 'Root', declarationType: 'interface' }
): JsonToTsResult {
  if (!jsonString || !jsonString.trim()) {
    return { code: '', success: true };
  }

  const sizeCheck = validateInputSize(jsonString);
  if (!sizeCheck.valid) {
    return { code: '', success: false, error: sizeCheck.error };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      code: '',
      success: false,
      error: `Invalid JSON syntax: ${(err as Error).message}`
    };
  }

  const collectedDeclarations: Array<{ name: string; body: string }> = [];

  function inferType(val: unknown, keyHint: string): string {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';

    const t = typeof val;
    if (t === 'string') return 'string';
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';

    if (Array.isArray(val)) {
      if (val.length === 0) return 'unknown[]';

      // Sample elements to determine array item type
      const elementTypes = Array.from(new Set(val.map(item => inferType(item, `${keyHint}Item`))));
      if (elementTypes.length === 1) {
        return `${elementTypes[0]}[]`;
      }
      return `(${elementTypes.join(' | ')})[]`;
    }

    if (typeof val === 'object' && val !== null) {
      const typeName = toPascalCase(keyHint);
      const entries = Object.entries(val as Record<string, unknown>);

      const lines: string[] = [];
      for (const [propKey, propVal] of entries) {
        const propType = inferType(propVal, propKey);
        const safeKey = isValidIdentifier(propKey) ? propKey : JSON.stringify(propKey);
        lines.push(`  ${safeKey}: ${propType};`);
      }

      collectedDeclarations.push({
        name: typeName,
        body: `{\n${lines.join('\n')}\n}`
      });

      return typeName;
    }

    return 'unknown';
  }

  const rootTypeName = toPascalCase(options.rootName || 'Root');
  inferType(parsed, rootTypeName);

  if (collectedDeclarations.length === 0) {
    // Primitive root
    const primitiveType = typeof parsed;
    const decl = options.declarationType === 'interface'
      ? `type ${rootTypeName} = ${primitiveType};`
      : `type ${rootTypeName} = ${primitiveType};`;
    return { code: decl, success: true };
  }

  // Format collected interfaces
  const formatted = collectedDeclarations
    .map(decl => {
      if (options.declarationType === 'interface') {
        return `export interface ${decl.name} ${decl.body}`;
      } else {
        return `export type ${decl.name} = ${decl.body};`;
      }
    })
    .join('\n\n');

  return {
    code: formatted,
    success: true
  };
}
