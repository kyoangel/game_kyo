export type BoostId = 'speedPact' | 'chronoDust' | 'slayerOil' | 'goldPouch';

export interface BoostSpec {
  id: BoostId;
  cost: number; // Crystals per run
  color: number;
  icon: string;
}

export const BOOST_CATALOG: readonly BoostSpec[] = [
  { id: 'speedPact', cost: 40, color: 0x34d399, icon: '⚡' },
  { id: 'chronoDust', cost: 60, color: 0x38bdf8, icon: '⏳' },
  { id: 'slayerOil', cost: 80, color: 0xf43f5e, icon: '🔥' },
  { id: 'goldPouch', cost: 50, color: 0xd97706, icon: '💰' },
];

export function isBoostId(v: unknown): v is BoostId {
  return typeof v === 'string' && BOOST_CATALOG.some((b) => b.id === v);
}

export function getBoostSpec(id: BoostId): BoostSpec {
  return BOOST_CATALOG.find((b) => b.id === id) ?? BOOST_CATALOG[0];
}
