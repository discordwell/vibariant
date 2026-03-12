import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installSkill, SKILL_FILES, CLAUDE_MD_LINE, AGENT_INSTRUCTIONS } from '../src/lib/skill-template.js';

const TEST_DIR = join(tmpdir(), 'vibariant-skill-install-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('installSkill — Claude Code', () => {
  it('creates all skill files in .claude/skills/vibariant/', () => {
    installSkill(TEST_DIR);

    for (const [filename, content] of Object.entries(SKILL_FILES)) {
      const filePath = join(TEST_DIR, '.claude', 'skills', 'vibariant', filename);
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf-8')).toBe(content);
    }
  });

  it('installs all expected reference files', () => {
    const expectedFiles = ['SKILL.md', 'auth.md', 'experiments.md', 'projects.md', 'codegen.md', 'goals.md', 'workflows.md'];
    installSkill(TEST_DIR);

    for (const filename of expectedFiles) {
      const filePath = join(TEST_DIR, '.claude', 'skills', 'vibariant', filename);
      expect(existsSync(filePath), `${filename} should exist`).toBe(true);
    }
  });

  it('SKILL.md is a lean router with links to reference files', () => {
    const skillContent = SKILL_FILES['SKILL.md'];
    expect(skillContent).toContain('name: vibariant');
    expect(skillContent).toContain('allowed-tools: Bash, Read, Grep');
    expect(skillContent).toContain('[auth.md](auth.md)');
    expect(skillContent).toContain('[experiments.md](experiments.md)');
    expect(skillContent).toContain('[codegen.md](codegen.md)');
    const lineCount = skillContent.split('\n').length;
    expect(lineCount).toBeLessThan(60);
  });

  it('creates CLAUDE.md if it does not exist', () => {
    installSkill(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');
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
    expect(readFileSync(claudeMdPath, 'utf-8')).toBe(original);
  });
});

describe('installSkill — AGENTS.md (OpenAI Codex)', () => {
  it('creates AGENTS.md with CLI reference', () => {
    installSkill(TEST_DIR);

    const agentsMdPath = join(TEST_DIR, 'AGENTS.md');
    expect(existsSync(agentsMdPath)).toBe(true);

    const content = readFileSync(agentsMdPath, 'utf-8');
    expect(content).toContain('vibariant');
    expect(content).toContain('--json');
    expect(content).toContain('experiments create');
  });

  it('appends to existing AGENTS.md without duplicating', () => {
    const agentsMdPath = join(TEST_DIR, 'AGENTS.md');
    writeFileSync(agentsMdPath, '# My Agents\n\nExisting instructions.\n');

    installSkill(TEST_DIR);
    const content = readFileSync(agentsMdPath, 'utf-8');
    expect(content).toContain('Existing instructions.');
    expect(content).toContain('vibariant');

    // Install again — should not duplicate
    installSkill(TEST_DIR);
    const content2 = readFileSync(agentsMdPath, 'utf-8');
    const vibariantCount = content2.split('# Vibariant').length - 1;
    expect(vibariantCount).toBe(1);
  });
});

describe('installSkill — GitHub Copilot', () => {
  it('creates .github/copilot-instructions.md', () => {
    installSkill(TEST_DIR);

    const copilotPath = join(TEST_DIR, '.github', 'copilot-instructions.md');
    expect(existsSync(copilotPath)).toBe(true);

    const content = readFileSync(copilotPath, 'utf-8');
    expect(content).toContain('vibariant');
    expect(content).toContain('--json');
  });

  it('appends to existing copilot-instructions.md without duplicating', () => {
    const copilotDir = join(TEST_DIR, '.github');
    mkdirSync(copilotDir, { recursive: true });
    const copilotPath = join(copilotDir, 'copilot-instructions.md');
    writeFileSync(copilotPath, '# Copilot\n\nExisting rules.\n');

    installSkill(TEST_DIR);
    const content = readFileSync(copilotPath, 'utf-8');
    expect(content).toContain('Existing rules.');
    expect(content).toContain('vibariant');

    // Install again — should not duplicate
    installSkill(TEST_DIR);
    const content2 = readFileSync(copilotPath, 'utf-8');
    const vibariantCount = content2.split('# Vibariant').length - 1;
    expect(vibariantCount).toBe(1);
  });
});
