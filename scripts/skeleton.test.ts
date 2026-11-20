import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('workspace skeleton', () => {
  it('does not list legacy game folders as workspaces', () => {
    const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { workspaces: string[] };
    expect(pkg.workspaces).toEqual(['packages/*', 'games/*']);
  });

  it.each(['workspace', 'workspace-merge10x', 'workspace-pixel-squad'])(
    '%s is still its own npm project root',
    (dir) => {
      const prefix = execFileSync('npm', ['prefix'], { cwd: `${root}${dir}`, encoding: 'utf8' }).trim();
      expect(prefix.endsWith(dir)).toBe(true);
    },
  );
});
