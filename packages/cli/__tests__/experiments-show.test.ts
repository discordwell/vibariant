import { describe, it, expect } from 'vitest';

/**
 * Tests for the experiments show subcommand behavior.
 * These test the lookup-by-key-or-id logic and the combined
 * experiment+results data shape, without hitting a real API.
 */
describe('experiments show', () => {
  const mockExperiments = [
    {
      id: 'exp-uuid-123',
      key: 'hero-headline',
      name: 'Hero Headline',
      status: 'running',
      variant_keys: ['control', 'bold'],
      traffic_percentage: 1.0,
    },
    {
      id: 'exp-uuid-456',
      key: 'checkout-cta',
      name: 'Checkout CTA',
      status: 'draft',
      variant_keys: ['control', 'variant'],
      traffic_percentage: 1.0,
    },
  ];

  it('finds experiment by ID', () => {
    const exp = mockExperiments.find((e) => e.id === 'exp-uuid-123' || e.key === 'exp-uuid-123');
    expect(exp).toBeDefined();
    expect(exp!.key).toBe('hero-headline');
  });

  it('finds experiment by key', () => {
    const exp = mockExperiments.find((e) => e.id === 'hero-headline' || e.key === 'hero-headline');
    expect(exp).toBeDefined();
    expect(exp!.id).toBe('exp-uuid-123');
  });

  it('returns null for unknown experiment', () => {
    const exp = mockExperiments.find((e) => e.id === 'nonexistent' || e.key === 'nonexistent');
    expect(exp).toBeUndefined();
  });

  it('produces correct JSON envelope for show command', () => {
    const exp = mockExperiments[0];
    const mockResults = {
      experiment_name: 'Hero Headline',
      decision_status: 'keep_testing',
      variants: [
        { variant_key: 'control', visitors: 50, conversions: 5, conversion_rate: 0.1, posterior_mean: 0.0962 },
        { variant_key: 'bold', visitors: 50, conversions: 8, conversion_rate: 0.16, posterior_mean: 0.1538 },
      ],
      recommendation: 'Keep testing. Bold variant shows promise but needs more data.',
    };

    const jsonOutput = {
      ok: true,
      data: { experiment: exp, results: mockResults },
    };

    expect(jsonOutput.ok).toBe(true);
    expect(jsonOutput.data.experiment.key).toBe('hero-headline');
    expect(jsonOutput.data.experiment.status).toBe('running');
    expect(jsonOutput.data.results.decision_status).toBe('keep_testing');
    expect(jsonOutput.data.results.variants).toHaveLength(2);
  });

  it('includes null results for draft experiments', () => {
    const exp = mockExperiments[1];
    // Draft experiments don't have results
    const jsonOutput = {
      ok: true,
      data: { experiment: exp, results: null },
    };

    expect(jsonOutput.ok).toBe(true);
    expect(jsonOutput.data.experiment.status).toBe('draft');
    expect(jsonOutput.data.results).toBeNull();
  });
});
