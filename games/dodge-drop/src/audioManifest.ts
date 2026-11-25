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
 * No per-track gains: Task 3.9 loudness-normalised the files (music -18 LUFS, SFX -14 LUFS integrated, true peak
 * <= -1.5 dBTP), so every sample plays at unity and the SFX_BUS 0.42 / MUSIC_BUS 0.58 buses alone set the mix.
 * That puts SFX about 4 LU above the music before the buses and about 1 LU above after them, so the bed stays
 * audible under the effects. The game-kit `gains` hook stays available for future tracks.
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
  // 2026-11-25 owner feedback "the music has no sense of speed": the 80 BPM loop (music-normal.mp3) is retired.
  // Runs open on the 120 BPM loop; rush and Overdrive share the 160 BPM loop (the kit keeps it playing across the
  // switch); PlayScene also raises the playback rate with the clock (musicTempo.ts).
  music: {
    'music-normal': music('rush'),
    'music-rush': music('overdrive'),
    'music-overdrive': music('overdrive'),
    'music-chomp': music('chomp'),
  },
};
