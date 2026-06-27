export const SFX_KEYS = {
  attack: 'sfx_attack',
  hit: 'sfx_hit',
  crit: 'sfx_crit',
  heal: 'sfx_heal',
  buff: 'sfx_buff',
  recruitSuccess: 'sfx_recruit_success',
  recruitFail: 'sfx_recruit_fail',
  victory: 'sfx_victory',
  defeat: 'sfx_defeat',
  levelUp: 'sfx_level_up',
  buttonClick: 'sfx_button_click',
  purchase: 'sfx_purchase',
} as const;

export type SfxKey = typeof SFX_KEYS[keyof typeof SFX_KEYS];

export const SFX_ASSETS: Record<SfxKey, string> = {
  [SFX_KEYS.attack]: 'audio/attack.mp3',
  [SFX_KEYS.hit]: 'audio/hit.mp3',
  [SFX_KEYS.crit]: 'audio/crit.mp3',
  [SFX_KEYS.heal]: 'audio/heal.mp3',
  [SFX_KEYS.buff]: 'audio/buff.mp3',
  [SFX_KEYS.recruitSuccess]: 'audio/recruit_success.mp3',
  [SFX_KEYS.recruitFail]: 'audio/recruit_fail.mp3',
  [SFX_KEYS.victory]: 'audio/victory.mp3',
  [SFX_KEYS.defeat]: 'audio/defeat.mp3',
  [SFX_KEYS.levelUp]: 'audio/level_up.mp3',
  [SFX_KEYS.buttonClick]: 'audio/button_click.mp3',
  [SFX_KEYS.purchase]: 'audio/purchase.mp3',
};

export const MUSIC_KEYS = {
  title: 'music_title',
  theme: 'music_theme',
  battle: 'music_battle',
  victory: 'music_victory',
  defeat: 'music_defeat',
} as const;

export type MusicKey = typeof MUSIC_KEYS[keyof typeof MUSIC_KEYS];

export const MUSIC_ASSETS: Record<MusicKey, string> = {
  [MUSIC_KEYS.title]: 'audio/music_title.mp3',
  [MUSIC_KEYS.theme]: 'audio/music_theme.mp3',
  [MUSIC_KEYS.battle]: 'audio/music_battle.mp3',
  [MUSIC_KEYS.victory]: 'audio/music_victory.mp3',
  [MUSIC_KEYS.defeat]: 'audio/music_defeat.mp3',
};

export const MUSIC_LOOP_KEYS: ReadonlySet<MusicKey> = new Set([
  MUSIC_KEYS.title, MUSIC_KEYS.theme, MUSIC_KEYS.battle,
]);

export const MUSIC_VOLUME = 0.4;
export const MUSIC_FADE_MS = 500;
