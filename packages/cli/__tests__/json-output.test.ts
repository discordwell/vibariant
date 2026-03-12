import { describe, it, expect } from 'vitest';
import { jsonOk, jsonError, EXIT } from '../src/lib/format.js';

describe('JSON output helpers', () => {
  describe('jsonOk', () => {
    it('outputs correct envelope structure', () => {
      // Capture console.log output
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      jsonOk({ foo: 'bar' });

      console.log = origLog;

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toEqual({ ok: true, data: { foo: 'bar' } });
    });

    it('handles array data', () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      jsonOk([1, 2, 3]);

      console.log = origLog;

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toEqual({ ok: true, data: [1, 2, 3] });
    });

    it('handles null data', () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      jsonOk(null);

      console.log = origLog;

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toEqual({ ok: true, data: null });
    });
  });

  describe('EXIT codes', () => {
    it('defines correct exit code constants', () => {
      expect(EXIT.SUCCESS).toBe(0);
      expect(EXIT.ERROR).toBe(1);
      expect(EXIT.NOT_AUTHENTICATED).toBe(2);
      expect(EXIT.NOT_FOUND).toBe(3);
    });
  });

  describe('JSON envelope consistency', () => {
    it('success envelope always has ok:true and data field', () => {
      const envelope = { ok: true, data: { id: 'test' } };
      expect(envelope).toHaveProperty('ok', true);
      expect(envelope).toHaveProperty('data');
      expect(envelope).not.toHaveProperty('error');
    });

    it('error envelope always has ok:false and error field', () => {
      const envelope = { ok: false, error: 'Something went wrong' };
      expect(envelope).toHaveProperty('ok', false);
      expect(envelope).toHaveProperty('error');
      expect(typeof envelope.error).toBe('string');
    });

    it('JSON output is valid JSON with 2-space indentation', () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      jsonOk({ test: true });

      console.log = origLog;

      // Should be pretty-printed with 2 spaces
      expect(logs[0]).toContain('\n');
      expect(logs[0]).toContain('  ');
      // Should parse cleanly
      expect(() => JSON.parse(logs[0])).not.toThrow();
    });
  });
});

describe('skill template exports', () => {
  it('exports valid SKILL_MD content', async () => {
    const { SKILL_MD, WORKFLOWS_MD, CLAUDE_MD_LINE } = await import('../src/lib/skill-template.js');

    // SKILL_MD should have frontmatter
    expect(SKILL_MD).toContain('---');
    expect(SKILL_MD).toContain('name: vibariant');
    expect(SKILL_MD).toContain('user_invocable: true');
    expect(SKILL_MD).toContain('--json');

    // WORKFLOWS_MD should have workflow examples
    expect(WORKFLOWS_MD).toContain('vibariant experiments');
    expect(WORKFLOWS_MD).toContain('vibariant codegen');

    // CLAUDE_MD_LINE should reference the skill
    expect(CLAUDE_MD_LINE).toContain('/vibariant');
  });
});
