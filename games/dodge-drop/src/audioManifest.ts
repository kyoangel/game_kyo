import type { AudioManifest } from '@gf/game-kit';

/**
 * SFX that deliberately keep the synth voice. `click` (Kenney interface click_003) is only 7 ms long: after mp3
 * padding and at the SFX bus level it is a faint tick rather than a click, so the 30 ms synth blip stays.
 * The shipped sfx-click.mp3 is unused until the Task 3.9 listening check says otherwise.
 */
export const SYNTH_ONLY_SFX: readonly string[] = ['click'];

const sfx = (name: string): string => `assets/audio/sfx-${name}.mp3`;
const music = (mode: string): string => `assets/audio/music-${mode}.mp3`;

/**
 * Mix table (linear gains before the SFX_BUS 0.42 / MUSIC_BUS 0.58 buses). Coarse: evened to measured levels from
 * ffmpeg on the shipped files (music to about -14 LUFS integrated, SFX to about -13 dB mean), which also pulls the
 * loops that peak above 1.0 after decode (chomp +1.4, rush +0.8, normal +0.4 dBTP) back under it and lifts the
 * quieter overdrive loop (-16.3 LUFS). Full loudness normalisation and a listening check are Task 3.9.
 */
export const AUDIO_MANIFEST: AudioManifest = {
  sfx: {
    nearMiss: sfx('nearMiss'),
    pickup: sfx('pickup'),
    shield: sfx('shield'),
    shieldBreak: sfx('shieldBreak'),
    death: sfx('death'),
    medal: sfx('medal'),
    rush: sfx('rush'),
    newBest: sfx('newBest'),
  },
  music: {
    'music-normal': music('normal'),
    'music-rush': music('rush'),
    'music-overdrive': music('overdrive'),
    'music-chomp': music('chomp'),
  },
  gains: {
    'music-normal': 0.85,
    'music-rush': 0.7,
    'music-overdrive': 1.2,
    'music-chomp': 0.7,
    nearMiss: 1.45,
    pickup: 1.5,
    shield: 0.9,
    shieldBreak: 1.15,
    death: 0.7,
    medal: 1.3,
    rush: 0.8,
    newBest: 0.75,
  },
};
