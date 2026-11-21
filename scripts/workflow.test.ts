import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const yml = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8');
const jobBlock = (name: string): string => {
  const start = yml.indexOf(`\n  ${name}:\n`);
  if (start < 0) return '';
  const next = yml.slice(start + 1).search(/\n {2}[a-z0-9-]+:\n/);
  return next < 0 ? yml.slice(start) : yml.slice(start, start + 1 + next);
};

describe('deploy.yml release-portals job', () => {
  const job = jobBlock('release-portals');

  it('exists and depends on a successful build-platform', () => {
    expect(job).not.toBe('');
    expect(job).toMatch(/needs: \[changes, build-platform\]/);
    expect(job).toMatch(/needs\.build-platform\.result == 'success'/);
  });

  it('has contents: write and uses GITHUB_TOKEN for gh', () => {
    expect(job).toMatch(/permissions:\s+contents: write/);
    expect(job).toMatch(/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  });

  it('runs portal smoke, builds portals and creates releases', () => {
    expect(job).toMatch(/npm run test:portals/);
    expect(job).toMatch(/npm run build:portals/);
    expect(job).toMatch(/node scripts\/release-portals\.ts/);
  });

  it('does not block the pages deploy job', () => {
    const deploy = jobBlock('deploy');
    expect(deploy).not.toMatch(/release-portals/);
  });
});
