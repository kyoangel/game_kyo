import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkArtifact, MAX_ARTIFACT_BYTES, SDK_HOSTS } from './check-artifact.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'gk-artifact-'));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const INDEX = '<!doctype html><script type="module" src="./assets/main.js"></script>';

describe('checkArtifact', () => {
  it('passes a clean crazygames build (own SDK host + inert namespace host)', () => {
    const dir = fixture({
      'index.html': INDEX,
      'assets/main.js': `fetch("https://${SDK_HOSTS.crazygames}/crazygames-sdk-v3.js");var ns="http://www.w3.org/2000/svg";`,
    });
    expect(checkArtifact(dir, 'crazygames')).toEqual([]);
  });

  it('passes a clean gamedistribution build', () => {
    const dir = fixture({
      'index.html': INDEX,
      'assets/main.js': `load("https://${SDK_HOSTS.gamedistribution}/main.min.js")`,
    });
    expect(checkArtifact(dir, 'gamedistribution')).toEqual([]);
  });

  it('reports a missing directory', () => {
    expect(checkArtifact(join(tmpdir(), 'gk-does-not-exist-xyz'), 'crazygames')[0]).toMatch(/does not exist/);
  });

  it('requires index.html at the root', () => {
    const dir = fixture({ 'sub/index.html': INDEX });
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/index\.html missing at the artifact root/);
  });

  it('rejects artifacts over 10 MB', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/big.bin': Buffer.alloc(MAX_ARTIFACT_BYTES + 1) });
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/exceeds the 10 MB limit/);
  });

  it('accepts an artifact exactly at the limit', () => {
    const pad = MAX_ARTIFACT_BYTES - INDEX.length;
    const dir = fixture({ 'index.html': INDEX, 'assets/pad.bin': Buffer.alloc(pad) });
    expect(checkArtifact(dir, 'crazygames')).toEqual([]);
  });

  it('rejects external hosts outside the allowlist, naming host and file', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/main.js': 'img.src="https://cdn.evil.test/x.png"' });
    const errors = checkArtifact(dir, 'crazygames');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/cdn\.evil\.test/);
    expect(errors[0]).toMatch(/assets\/main\.js/);
  });

  it('scans css and json too', () => {
    const dir = fixture({
      'index.html': INDEX,
      'a.css': 'body{background:url(https://css.evil.test/b.png)}',
      'b.json': '{"u":"http://json.evil.test/p"}',
    });
    const text = checkArtifact(dir, 'gamedistribution').join('\n');
    expect(text).toMatch(/css\.evil\.test/);
    expect(text).toMatch(/json\.evil\.test/);
  });

  it("rejects the other portal's SDK host with a foreign-SDK message (and no duplicate allowlist error)", () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/main.js': `"https://${SDK_HOSTS.crazygames}/x.js"` });
    const errors = checkArtifact(dir, 'gamedistribution');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/foreign portal SDK/);
    expect(errors[0]).toContain(SDK_HOSTS.crazygames);
  });

  it('rejects the foreign SDK host even when it is not a full URL', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/main.js': `var h="${SDK_HOSTS.gamedistribution}"` });
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/foreign portal SDK/);
  });

  it('rejects root-absolute and protocol-relative paths in index.html', () => {
    const a = fixture({ 'index.html': '<script src="/assets/main.js"></script>' });
    const b = fixture({ 'index.html': '<link href="//cdn.test/x.css">' });
    expect(checkArtifact(a, 'crazygames').join('\n')).toMatch(/root-absolute/);
    expect(checkArtifact(b, 'crazygames').join('\n')).toMatch(/root-absolute/);
  });

  it('rejects symlinks', () => {
    const dir = fixture({ 'index.html': INDEX });
    symlinkSync(tmpdir(), join(dir, 'escape'));
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/symlink not allowed: escape/);
  });

  it('does not scan binary files for URLs', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/a.png': Buffer.from('http://binary.evil.test/x') });
    expect(checkArtifact(dir, 'crazygames')).toEqual([]);
  });
});
