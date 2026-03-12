import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installSkill, SKILL_MD, WORKFLOWS_MD, CLAUDE_MD_LINE } from '../src/lib/skill-template.js';

const TEST_DIR = join(tmpdir(), 'vibariant-skill-install-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('installSkill', () => {
  it('creates skill files in .claude/skills/vibariant/', () => {
    installSkill(TEST_DIR);

    const skillPath = join(TEST_DIR, '.claude', 'skills', 'vibariant', 'SKILL.md');
    const workflowsPath = join(TEST_DIR, '.claude', 'skills', 'vibariant', 'workflows.md');

    expect(existsSync(skillPath)).toBe(true);
    expect(existsSync(workflowsPath)).toBe(true);
    expect(readFileSync(skillPath, 'utf-8')).toBe(SKILL_MD);
    expect(readFileSync(workflowsPath, 'utf-8')).toBe(WORKFLOWS_MD);
  });

  it('creates CLAUDE.md if it does not exist', () => {
    installSkill(TEST_DIR);

    const claudeMdPath = join(TEST_DIR, 'CLAUDE.md');
    expect(existsSync(claudeMdPath)).toBe(true);

    const content = readFileSync(claudeMdPath, 'utf-8');
    expect(content).toContain(CLAUDE_MD_LINE);
    expect(content).toContain('# Project');
  });

  it('appends to existing CLAUDE.md without duplicating', () => {
    const claudeMdPath = join(TEST_DIR, 'CLAUDE.md');
    writeFileSync(claudeMdPath, '# My Project\n\nSome existing content.\n');

    installSkill(TEST_DIR);

    const content = readFileSync(claudeMdPath, 'utf-8');
    expect(content).toContain('Some existing content.');
    expect(content).toContain(CLAUDE_MD_LINE);

    // Install again — should not duplicate
    installSkill(TEST_DIR);
    const content2 = readFileSync(claudeMdPath, 'utf-8');
    const matches = content2.split(CLAUDE_MD_LINE).length - 1;
    expect(matches).toBe(1);
  });

  it('does not modify CLAUDE.md if it already references vibariant skill', () => {
    const claudeMdPath = join(TEST_DIR, 'CLAUDE.md');
    const original = '# My Project\n\n- Use the /vibariant skill for AB testing\n';
    writeFileSync(claudeMdPath, original);

    installSkill(TEST_DIR);

    const content = readFileSync(claudeMdPath, 'utf-8');
    expect(content).toBe(original);
  });
});
