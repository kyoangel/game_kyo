import type { GameGrid } from "../../../src/grid";
import { NO_UPGRADES, type BattleState } from "../../../src/adventure/battle";
import { BATTLE_ORDER, type RunState } from "../../../src/adventure/run";
import { STARTER_RELIC_IDS } from "../../../src/adventure/relics";
import { makeState } from "./battleHelpers";

/** A run in the battle phase at `battleIndex`, with a hand-built battle on `grid`. */
export function runInBattle(
  grid: GameGrid,
  battleChanges: Partial<BattleState> = {},
  runChanges: Partial<RunState> = {},
  battleIndex = 0,
): RunState {
  // makeState predates BattleState.relicData, so add it here.
  const battle = { ...makeState(grid, battleChanges, BATTLE_ORDER[battleIndex]), relicData: battleChanges.relicData ?? {} };
  return {
    phase: "battle",
    battleIndex,
    heroHp: battle.heroHp,
    heroMaxHp: battle.heroMaxHp,
    relics: [],
    upgrades: { ...NO_UPGRADES },
    pool: [...STARTER_RELIC_IDS],
    battle,
    stats: { stonesBroken: 0, maxChain: 0 },
    offers: [],
    ...runChanges,
  };
}
