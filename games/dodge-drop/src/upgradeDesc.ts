import { effectValue, MAX_LEVEL, maxLevel, type UpgradeId } from './workshop.ts';

function fill(t: (key: string) => string, id: UpgradeId, level: number): string {
  const maxMagnet = id === 'magnet' && level >= MAX_LEVEL;
  return t(maxMagnet ? 'up.magnet.descMax' : `up.${id}.desc`).replace('{v}', String(Number(effectValue(id, level).toFixed(2))));
}

/** Shop card text: the NEXT level's effect while buyable ("Next: ..."), the current effect once maxed. */
export function upgradeDesc(t: (key: string) => string, id: UpgradeId, level: number): string {
  if (level >= maxLevel(id)) return fill(t, id, maxLevel(id));
  const next = fill(t, id, level + 1);
  // Latin descriptions start with a capital; lower it so "Next: pulls ..." reads as one sentence.
  return t('upNext').replace('{d}', next.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()));
}
