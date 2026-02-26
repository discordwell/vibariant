import { describe, it, expect } from 'vitest';
import { fnv1a, assignVariantLocally } from '../core/assignment.js';

describe('fnv1a', () => {
  it('produces correct hash for empty string', () => {
    // FNV offset basis: 0x811c9dc5 = 2166136261
    expect(fnv1a('')).toBe(2166136261);
  });

  it('produces correct hash for "hello"', () => {
    expect(fnv1a('hello')).toBe(1335831723);
  });

  it('produces correct hash for "abc"', () => {
    expect(fnv1a('abc')).toBe(440920331);
  });

  it('produces correct hash for "test"', () => {
    expect(fnv1a('test')).toBe(2949673445);
  });

  it('produces correct hash for visitor:experiment compound key', () => {
    expect(fnv1a('visitor123:hero-headline')).toBe(2187615758);
  });

  it('always returns unsigned 32-bit integer', () => {
    const hash = fnv1a('any string');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

describe('assignVariantLocally', () => {
  it('is deterministic — same inputs always produce same output', () => {
    const a1 = assignVariantLocally('visitor123', 'hero-headline', ['control', 'variant_a']);
    const a2 = assignVariantLocally('visitor123', 'hero-headline', ['control', 'variant_a']);
    expect(a1.variantKey).toBe(a2.variantKey);
    expect(a1.bucket).toBe(a2.bucket);
  });

  it('assigns correctly with 2 variants', () => {
    const result = assignVariantLocally('visitor123', 'hero-headline', ['control', 'variant_a']);
    // bucket = 2187615758 % 1000 = 758; 758 % 2 = 0 -> 'control'
    expect(result.bucket).toBe(758);
    expect(result.variantKey).toBe('control');
    expect(result.experimentKey).toBe('hero-headline');
    expect(result.visitorId).toBe('visitor123');
    expect(result.source).toBe('local');
  });

  it('assigns correctly with 3 variants', () => {
    const result = assignVariantLocally('visitor123', 'hero-headline', ['a', 'b', 'c']);
    // bucket = 758; 758 % 3 = 2 -> 'c'
    expect(result.bucket).toBe(758);
    expect(result.variantKey).toBe('c');
  });

  it('assigns correctly with 5 variants', () => {
    const result = assignVariantLocally('visitor123', 'hero-headline', ['a', 'b', 'c', 'd', 'e']);
    // bucket = 758; 758 % 5 = 3 -> 'd'
    expect(result.bucket).toBe(758);
    expect(result.variantKey).toBe('d');
  });

  it('different visitors get different buckets', () => {
    const r1 = assignVariantLocally('visitor123', 'hero-headline', ['control', 'variant_a']);
    const r2 = assignVariantLocally('visitor456', 'hero-headline', ['control', 'variant_a']);
    expect(r1.bucket).not.toBe(r2.bucket);
  });

  it('distributes visitors roughly evenly across 2 variants', () => {
    const counts: Record<string, number> = { control: 0, variant_a: 0 };
    for (let i = 0; i < 1000; i++) {
      const result = assignVariantLocally(`visitor-${i}`, 'test-exp', ['control', 'variant_a']);
      counts[result.variantKey]++;
    }
    // Each variant should get roughly 500 +/- 100 (generous tolerance)
    expect(counts['control']).toBeGreaterThan(350);
    expect(counts['control']).toBeLessThan(650);
    expect(counts['variant_a']).toBeGreaterThan(350);
    expect(counts['variant_a']).toBeLessThan(650);
  });

  it('respects custom weights', () => {
    // 90% / 10% split
    const counts: Record<string, number> = { control: 0, variant_a: 0 };
    for (let i = 0; i < 1000; i++) {
      const result = assignVariantLocally(
        `visitor-${i}`,
        'weighted-exp',
        ['control', 'variant_a'],
        [0.9, 0.1],
      );
      counts[result.variantKey]++;
    }
    // Control should get ~900
    expect(counts['control']).toBeGreaterThan(800);
    expect(counts['variant_a']).toBeLessThan(200);
  });

  it('throws if no variants are provided', () => {
    expect(() => assignVariantLocally('visitor', 'exp', [])).toThrow('has no variants');
  });
});
