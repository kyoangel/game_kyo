import { SKINS } from './economy.ts';

export type SkinAction =
  | { kind: 'use' }
  | { kind: 'inuse' }
  | { kind: 'buy'; cost: number }
  | { kind: 'poor'; need: number };

/** What the preview panel's single action button should do for the previewed skin. */
export function skinAction(state: { owned: string[]; inUse: string; coins: number }, id: string): SkinAction {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) return { kind: 'inuse' };
  if (state.owned.includes(id)) return state.inUse === id ? { kind: 'inuse' } : { kind: 'use' };
  if (state.coins >= skin.cost) return { kind: 'buy', cost: skin.cost };
  return { kind: 'poor', need: skin.cost - state.coins };
}
