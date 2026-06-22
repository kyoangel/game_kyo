import type { ArchetypeLabel, StatBlock } from '../types';

export function computeArchetype(stats: StatBlock): ArchetypeLabel {
  const normHp = stats.hp / 10;
  const total = normHp + stats.atk + stats.def + stats.spd;
  if (total === 0) return '全能';
  const hp = normHp / total;
  const atk = stats.atk / total;
  const def = stats.def / total;
  const spd = stats.spd / total;
  if (hp > 0.35 && def > 0.2) return '坦克';
  if (atk > 0.4) return '輸出';
  if (spd > 0.3 && atk > 0.2) return '狙擊';
  if (def > 0.25 || hp > 0.4) return '輔助';
  return '全能';
}
