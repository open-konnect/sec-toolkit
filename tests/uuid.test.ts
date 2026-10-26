import { describe, it, expect } from 'vitest';
import { 
  generateSingleUuid, 
  generateBulkUuids, 
  isValidUuidV4, 
  formatUuid 
} from '../src/tools/uuid/logic/uuidGenerator';

describe('UUID v4 Generator Logic', () => {
  it('generates a valid RFC 4122 Version 4 UUID', () => {
    const uuid = generateSingleUuid();
    expect(isValidUuidV4(uuid)).toBe(true);

    // Check version 4 character at index 14 (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
    expect(uuid.charAt(14)).toBe('4');

    // Check variant bits (8, 9, a, or b) at index 19
    const variantChar = uuid.charAt(19).toLowerCase();
    expect(['8', '9', 'a', 'b']).toContain(variantChar);
  });

  it('generates unique values across bulk batches', () => {
    const count = 100;
    const bulk = generateBulkUuids(count);
    expect(bulk.length).toBe(count);

    const values = bulk.map(b => b.value);
    const uniqueSet = new Set(values);
    expect(uniqueSet.size).toBe(count);

    // All should be valid v4
    for (const item of bulk) {
      expect(isValidUuidV4(item.value)).toBe(true);
    }
  });

  it('correctly applies formatting options (uppercase and no-hyphens)', () => {
    const raw = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

    const uppercase = formatUuid(raw, { uppercase: true, hyphens: true });
    expect(uppercase).toBe('F47AC10B-58CC-4372-A567-0E02B2C3D479');

    const noHyphens = formatUuid(raw, { uppercase: false, hyphens: false });
    expect(noHyphens).toBe('f47ac10b58cc4372a5670e02b2c3d479');
    expect(noHyphens).not.toContain('-');

    const upperNoHyphens = formatUuid(raw, { uppercase: true, hyphens: false });
    expect(upperNoHyphens).toBe('F47AC10B58CC4372A5670E02B2C3D479');
  });

  it('accurately validates valid and invalid UUID strings', () => {
    expect(isValidUuidV4('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    expect(isValidUuidV4('C56A4180-65AA-42EC-A945-5FD21DEC0538')).toBe(true);

    // Invalid version (version 1)
    expect(isValidUuidV4('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false);

    // Malformed strings
    expect(isValidUuidV4('not-a-uuid')).toBe(false);
    expect(isValidUuidV4('')).toBe(false);
    expect(isValidUuidV4('f47ac10b-58cc-4372-a567')).toBe(false);
  });
});
