// scripts/check-assets.test.ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAssets } from './check-assets.ts';

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

function fixture(files: Record<string, Buffer>, manifest: unknown): { pub: string; manifestPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'assets-'));
  const pub = join(dir, 'public', 'assets');
  mkdirSync(pub, { recursive: true });
  for (const [name, buf] of Object.entries(files)) {
    mkdirSync(join(pub, name, '..'), { recursive: true });
    writeFileSync(join(pub, name), buf);
  }
  const manifestPath = join(dir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  return { pub, manifestPath };
}

const entry = (file: string, buf: Buffer, over: Record<string, unknown> = {}) => ({
  file, license: 'CC0-1.0', author: 'Kenney', sourceUrl: 'https://kenney.nl/assets/x', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  retrievedAt: '2026-11-24', sha256: sha(buf), ...over,
});

describe('checkAssets', () => {
  const png = Buffer.from('png-bytes');
  it('passes when every file has a complete CC0 entry', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png)] });
    expect(checkAssets(pub, manifestPath)).toEqual([]);
  });
  it('ignores OS dotfiles such as .DS_Store', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png, '.DS_Store': png, 'art/.DS_Store': png }, { assets: [entry('a.png', png)] });
    expect(checkAssets(pub, manifestPath)).toEqual([]);
  });
  it('flags a shipped file with no manifest entry', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/a\.png.*no manifest entry/);
  });
  it('flags a manifest entry whose file is missing', () => {
    const { pub, manifestPath } = fixture({}, { assets: [entry('gone.png', png)] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/gone\.png.*missing/);
  });
  it('flags any license other than CC0-1.0', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { license: 'CC-BY-4.0' })] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/license must be CC0-1\.0/);
  });
  it('flags a wrong sha256 (file changed after review)', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { sha256: 'deadbeef' })] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/sha256 mismatch/);
  });
  it('flags missing author, sourceUrl or retrievedAt', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { author: '', sourceUrl: 'nope', retrievedAt: '' })] });
    const out = checkAssets(pub, manifestPath).join('\n');
    expect(out).toMatch(/author/);
    expect(out).toMatch(/sourceUrl must be https/);
    expect(out).toMatch(/retrievedAt/);
  });
  it('an empty assets dir with an empty manifest passes (template works with no assets)', () => {
    const { pub, manifestPath } = fixture({}, { assets: [] });
    expect(checkAssets(pub, manifestPath)).toEqual([]);
  });
  it('accepts an optional credit string and flags a non-string credit', () => {
    const ok = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { credit: 'Art by Kenney (optional)' })] });
    expect(checkAssets(ok.pub, ok.manifestPath)).toEqual([]);
    const bad = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { credit: 42 })] });
    expect(checkAssets(bad.pub, bad.manifestPath).join('\n')).toMatch(/credit must be a string/);
  });
  it('dodge-drop shipped assets are fully documented', () => {
    expect(checkAssets('games/dodge-drop/public/assets', 'games/dodge-drop/assets/manifest.json')).toEqual([]);
  });
});
