import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../packages/game-kit/src/manifest.ts';
import { scaffoldGame, titleFromSlug } from './new-game.ts';

const templateDir = fileURLToPath(new URL('../templates/game', import.meta.url));
const freshGamesDir = () => mkdtempSync(join(tmpdir(), 'gf-new-'));

describe('new-game', () => {
  it('titleFromSlug', () => expect(titleFromSlug('dodge-drop')).toBe('Dodge Drop'));

  it('scaffolds a valid game with placeholders replaced', () => {
    const gamesDir = freshGamesDir();
    const dest = scaffoldGame('sky-hop', { templateDir, gamesDir });
    const manifest = JSON.parse(readFileSync(join(dest, 'game.json'), 'utf8'));
    expect(validateManifest(manifest).ok).toBe(true);
    expect(manifest.slug).toBe('sky-hop');
    expect(manifest.title.en).toBe('Sky Hop');
    expect(readFileSync(join(dest, 'package.json'), 'utf8')).toContain('"@gf-game/sky-hop"');
    expect(readFileSync(join(dest, 'public/cover.svg'), 'utf8')).toContain('Sky Hop');
    expect(existsSync(join(dest, 'src/PlayScene.ts'))).toBe(true);
  });

  it('refuses invalid, reserved or existing slugs', () => {
    const gamesDir = freshGamesDir();
    expect(() => scaffoldGame('Bad_Slug', { templateDir, gamesDir })).toThrow(/kebab-case/);
    expect(() => scaffoldGame('pixel-squad', { templateDir, gamesDir })).toThrow(/reserved/);
    scaffoldGame('twice', { templateDir, gamesDir });
    expect(() => scaffoldGame('twice', { templateDir, gamesDir })).toThrow(/already exists/);
  });
});
