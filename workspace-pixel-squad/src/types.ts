export type ArchetypeLabel = '坦克' | '輸出' | '狙擊' | '輔助' | '全能';
export type SkillType = 'attack' | 'heal' | 'buff';

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  /** For attack skills: damage multiplier applied to ATK */
  multiplier: number;
  description: string;
}

export interface StatBlock {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Static definition — used to instantiate Character */
export interface CharacterTemplate {
  id: string;
  name: string;
  isProtagonist: boolean;
  baseStats: StatBlock;
  skillIds: string[];
  /** Auto stat growth per level (non-protagonist only) */
  statGrowth: StatBlock;
}

/** Live combat instance */
export interface Character {
  id: string;         // unique per-battle instance
  templateId: string;
  name: string;
  isProtagonist: boolean;
  isPlayer: boolean;
  level: number;
  exp: number;
  expToNext: number;
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    spd: number;
  };
  skills: Skill[];
  statPoints: number;   // unspent points (protagonist only)
  archetype: ArchetypeLabel;
  alive: boolean;
  defending: boolean;   // true = -50% damage this round
}

export interface EnemyTemplate {
  id: string;
  name: string;
  baseStats: StatBlock;
  skillIds: string[];
}

export interface Stage {
  id: string;
  name: string;
  enemies: EnemyTemplate[];
  expReward: number;   // total EXP split among surviving player chars
}

export interface BattleSceneData {
  playerParty: Character[];
  stageIndex: number;
}

export interface ResultSceneData {
  victory: boolean;
  playerParty: Character[];
  stageIndex: number;
  expGained: number;
}

export interface AllocateSceneData {
  playerParty: Character[];
  stageIndex: number;
}
