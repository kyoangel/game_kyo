import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('../docs/specs/game-platform/checklists/', import.meta.url));

describe.each(['crazygames', 'gamedistribution'])('checklist %s', (platform) => {
  const file = `${dir}${platform}.md`;

  it('exists with Automated and Manual sections', () => {
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(text).toMatch(/^## Automated/m);
    expect(text).toMatch(/^## Manual/m);
  });

  it('points at the automated gate and marks unverified facts explicitly', () => {
    const text = readFileSync(file, 'utf8');
    expect(text).toMatch(/check-artifact/);
    expect(text).toMatch(/UNVERIFIED/);
  });

  it('has at least one unchecked manual item', () => {
    expect(readFileSync(file, 'utf8')).toMatch(/^- \[ \] /m);
  });
});
