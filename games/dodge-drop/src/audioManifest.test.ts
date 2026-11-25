import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIO_MANIFEST, SYNTH_ONLY_SFX } from './audioManifest.ts';

const SFX_NAMES = ['nearMiss', 'pickup', 'shield', 'shieldBreak', 'death', 'medal', 'click', 'rush', 'newBest'];
const MODES = ['normal', 'rush', 'overdrive', 'chomp'];
const PUBLIC = join(import.meta.dirname, '..', 'public');

describe('dodge-drop audio manifest', () => {
  it('every sfx key is a valid SfxName and every music key is music-<mode>', () => {
    for (const k of Object.keys(AUDIO_MANIFEST.sfx)) expect(SFX_NAMES, k).toContain(k);
    for (const k of Object.keys(AUDIO_MANIFEST.music)) expect(MODES.map((m) => `music-${m}`), k).toContain(k);
  });
  it('covers every music mode and every sfx except the documented synth-only ones', () => {
    expect(Object.keys(AUDIO_MANIFEST.music).sort()).toEqual(MODES.map((m) => `music-${m}`).sort());
    const expected = SFX_NAMES.filter((n) => !SYNTH_ONLY_SFX.includes(n)).sort();
    expect(Object.keys(AUDIO_MANIFEST.sfx).sort()).toEqual(expected);
  });
  it('synth-only sfx stay synth: click is not sampled (7 ms sample is inaudible)', () => {
    expect(SYNTH_ONLY_SFX).toEqual(['click']);
  });
  it('uses relative urls to files that exist under public/', () => {
    for (const url of [...Object.values(AUDIO_MANIFEST.sfx), ...Object.values(AUDIO_MANIFEST.music)]) {
      expect(url.startsWith('/') || url.includes('://'), url).toBe(false);
      expect(existsSync(join(PUBLIC, url)), url).toBe(true);
    }
  });
  it('files are loudness-normalised (Task 3.9), so there are no per-track compensation gains', () => {
    expect(AUDIO_MANIFEST.gains ?? {}).toEqual({});
  });
});
