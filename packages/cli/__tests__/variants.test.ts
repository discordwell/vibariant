import { describe, it, expect } from 'vitest';
import { parseVariantKeys, DEFAULT_VARIANT_KEYS } from '../src/lib/variants.js';

describe('parseVariantKeys', () => {
  it('returns the default pair when input is undefined', () => {
    expect(parseVariantKeys(undefined)).toEqual(DEFAULT_VARIANT_KEYS);
  });

  it('returns the default pair for an empty string', () => {
    expect(parseVariantKeys('')).toEqual(DEFAULT_VARIANT_KEYS);
  });

  it('returns the default pair for blank/comma-only input', () => {
    expect(parseVariantKeys('   ')).toEqual(DEFAULT_VARIANT_KEYS);
    expect(parseVariantKeys(',,')).toEqual(DEFAULT_VARIANT_KEYS);
    expect(parseVariantKeys(' , , ')).toEqual(DEFAULT_VARIANT_KEYS);
  });

  it('splits a simple comma-separated list', () => {
    expect(parseVariantKeys('control,variant_a')).toEqual(['control', 'variant_a']);
  });

  it('trims surrounding whitespace', () => {
    expect(parseVariantKeys(' control , variant_a ')).toEqual(['control', 'variant_a']);
  });

  it('drops blank entries from accidental double commas', () => {
    expect(parseVariantKeys('a,,b')).toEqual(['a', 'b']);
    expect(parseVariantKeys('a,')).toEqual(['a']);
    expect(parseVariantKeys(',a,b,')).toEqual(['a', 'b']);
  });

  it('preserves a single explicit variant', () => {
    expect(parseVariantKeys('only')).toEqual(['only']);
  });

  it('does NOT de-duplicate (lets the API flag genuine mistakes)', () => {
    expect(parseVariantKeys('a,a')).toEqual(['a', 'a']);
  });

  it('returns a fresh array (callers cannot mutate the default)', () => {
    const a = parseVariantKeys(undefined);
    a.push('mutated');
    expect(parseVariantKeys(undefined)).toEqual(DEFAULT_VARIANT_KEYS);
  });
});
