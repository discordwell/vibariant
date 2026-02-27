import { describe, it, expect } from 'vitest';
import { generateCode } from '../src/codegen.js';

describe('generateCode', () => {
  it('generates Next.js integration code', () => {
    const code = generateCode('nextjs', 'vv_proj_test123');
    expect(code).toContain('vv_proj_test123');
    expect(code).toContain("'use client'");
    expect(code).toContain('VibariantProvider');
    expect(code).toContain('vibariant.config');
    expect(code).toContain('layout.tsx');
  });

  it('generates React integration code', () => {
    const code = generateCode('react', 'vv_proj_abc');
    expect(code).toContain('vv_proj_abc');
    expect(code).toContain('VibariantProvider');
    expect(code).not.toContain("'use client'");
  });

  it('generates vanilla JS integration code', () => {
    const code = generateCode('vanilla', 'vv_proj_xyz');
    expect(code).toContain('vv_proj_xyz');
    expect(code).toContain("from '@vibariant/sdk'");
    expect(code).toContain('await vibariant.init()');
  });

  it('includes experiment example when key provided', () => {
    const code = generateCode('nextjs', 'vv_proj_test', 'hero-headline');
    expect(code).toContain('hero-headline');
    expect(code).toContain('useVariant');
  });

  it('omits experiment example when no key', () => {
    const code = generateCode('nextjs', 'vv_proj_test');
    expect(code).not.toContain('useVariant');
  });
});
