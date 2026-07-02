import type { MonsterType } from './data/sprites';

export type ArchetypeLabel = '坦克' | '輸出' | '狙擊' | '輔助' | '全能';
export type SkillType = 'attack' | 'heal' | 'buff';
export type SkillTarget = 'enemy' | 'ally' | 'self';
export type BuffStat = 'atk' | 'def' | 'spd';
export type Element = 'fire' | 'ice' | 'thunder' | 'toxin' | 'physical';
export type StatusEffectType = 'poison' | 'burn' | 'freeze' | 'stun';

export type SkillTreeBranch = 'offense' | 'control' | 'support';

export interface SkillTreeNode {
  id: string;           // `${templateId}_${branch}_${tier}`, e.g. 'rex_offense_1'
  branch: SkillTreeBranch;
  tier: 1 | 2;           // tier 2 requires tier 1 of the same branch unlocked first
  skillId: string;       // key into SKILLS
  cost: number;          // skillPoints required; 1 for tier 1, 2 for tier 2
}

export interface ActiveStatusEffect {
  type: StatusEffectType;
  /** Decremented by 1 at the start of each command phase tick. Removed when reaches 0. */
  turnsRemaining: number;
  sourceSkillId: string;
}

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  /** Who this skill can be aimed at */
  target: SkillTarget;
  /** attack: ATK multiplier for damage. heal: ATK multiplier for heal amount. unused for buff. */
  multiplier: number;
  description: string;
  /** Number of rounds this skill is locked after use. 0 or absent = no cooldown. */
  cooldown?: number;
  /** Elemental type. undefined treated as 'physical'; heal/buff skills have no element. */
  element?: Element;
  /** buff-only fields */
  buffStat?: BuffStat;
  buffAmountPct?: number;
  buffDuration?: number;
  /** attack skills only — applied on hit if target survives */
  appliesStatus?: StatusEffectType;
}

export interface ActiveBuff {
  stat: BuffStat;
  amountPct: number;
  turnsRemaining: number;
  sourceSkillId: string;
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
  unlockMethod: 'start' | 'stage' | 'recruit';
  unlockStageId?: string;  // for 'stage' and 'recruit' types
  skillTree: SkillTreeNode[];  // exactly 6 nodes: 3 branches × 2 tiers
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
  recruited?: boolean;  // true = this enemy was convinced to join
  activeBuffs: ActiveBuff[];
  activeStatusEffects: ActiveStatusEffect[];
  /** Maps skill.id → remaining locked rounds (0 = ready). Only non-zero entries need to be present. */
  skillCooldowns: Record<string, number>;
  _monsterType?: MonsterType;
  /** Elemental weakness, if any. Copied from EnemyTemplate at creation for enemies; bosses may gain one mid-battle via BossPhase.weaknessOverride. */
  weakness?: Element;
  /** True if this character was hit by a weakness this round (visual stagger only). */
  knockedDown?: boolean;
  /** True if this character already earned a bonus action this round. */
  bonusActionUsed?: boolean;
  /** Currently equipped weapon/armor, if any. Always {} for enemy characters. */
  equipment: CharacterEquipment;
  skillPoints?: number;             // earned +1 per level-up; spent unlocking skill-tree nodes
  unlockedSkillNodeIds?: string[];  // SkillTreeNode.id values this character has unlocked
}

export interface EnemyTemplate {
  id: string;
  name: string;
  baseStats: StatBlock;
  skillIds: string[];
  monsterType?: MonsterType;
  weakness?: Element;
}

export interface StageDialog {
  speaker: string;
  lines: string[];
}

export interface StageItemReward {
  itemId: string;   // resolves against SHOP_ITEMS or EXCLUSIVE_ITEMS
  quantity: number;
}

export interface Stage {
  id: string;
  chapterId: string;
  name: string;
  stageIndex: number;           // 0–4 within chapter (or 0 for side quests)
  isBoss: boolean;
  isSideQuest: boolean;
  unlockAfterStageId?: string;  // side quests only
  enemies: EnemyTemplate[];
  expReward: number;
  currencyReward: number;
  unlockCharacterId?: string;   // character unlocked on first clear
  preDialog?: StageDialog;      // shown before battle on first visit
  itemRewards?: StageItemReward[]; // side quests only, granted on first clear
}

export interface Chapter {
  id: string;
  name: string;
  stageIds: string[];           // ordered, 5 entries
  unlockAfterChapterId?: string;
}

export interface BattleSceneData {
  playerParty: Character[];
  stageIndex: number;
  expPool?: number;
  gameState?: GameState;
  isChallengeRun?: boolean;
}

export interface BattlePerformanceStats {
  playerKOCount: number;
  weaknessHitCount: number;
  roundsUsed: number;
}

export interface ResultSceneData {
  victory: boolean;
  playerParty: Character[];
  stageIndex: number;
  expGained: number;
  expPool?: number;
  recruitedEnemy?: Character;  // set if a recruit succeeded during battle
  gameState?: GameState;
  isChallengeRun?: boolean;
  battleStats?: BattlePerformanceStats;
}

export interface PrepSceneData {
  playerParty: Character[];
  stageIndex: number;
  expPool: number;
}

export type BattlePhase = 'command' | 'executing' | 'auto' | 'all-out-attack-prompt';

export interface PendingCommand {
  character: Character;
  action: 'attack' | 'skill' | 'defend';
  skill?: Skill;       // the specific skill chosen when action === 'skill'
  target?: Character; // undefined for 防禦
}

export interface ChapterRunState {
  chapterId: string;
  currentStageIndex: number;   // 0–4, which stage within chapter is next
  lockedSquad: Character[];    // squad frozen for this run
}

export interface StageProgress {
  completedStageIds: string[]; // stages fully cleared (using Stage.id strings)
  inChapterRun?: ChapterRunState;
}

export interface ChallengeRunState {
  bossStageIds: string[];      // remaining boss stage ids to fight, in order
  lockedSquad: Character[];    // squad snapshot, HP/buffs carry between fights
  accumulatedCurrency: number; // running total of currencyReward across cleared bosses this run
}

export interface GameState {
  slotId: 0 | 1 | 2;
  pool: Character[];           // all unlocked characters
  squad: Character[];          // active squad (max 5, subset of pool)
  expPool: number;
  currency: number;            // 廢土幣
  stageProgress: StageProgress;
  savedAt: number;             // Date.now() timestamp
  inventory: InventoryEntry[];
  ngPlusCycle: number;         // 0 = first playthrough; +1 each time NG+ is started
  hasClearedGame: boolean;     // true once stage '5-5' is cleared the first time; NEVER reset by NG+
  challengeRun?: ChallengeRunState; // present while a Boss Rush attempt is in progress
  discoveredWeaknesses?: Record<string, Element>; // key = EnemyTemplate.id
  equipmentInventory: EquipmentInventoryEntry[]; // owned, currently-unequipped equipment
}

export type ShopItemType = 'skill_scroll' | 'supply' | 'respec';

export interface ShopItem {
  id: string;
  name: string;
  type: ShopItemType;
  price: number;
  description: string;
  skillId?: string;      // skill_scroll only — id into SKILLS
  healAmount?: number;   // supply only — flat HP restored
}

export interface InventoryEntry {
  itemId: string;        // ShopItem.id, supply items only
  quantity: number;
}

export type EquipmentSlot = 'weapon' | 'armor';

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  price: number;
  description: string;
  /** Flat stat bonus while equipped. Applied live via battle/Buffs.ts, never baked into Character.stats. */
  statBonus: Partial<Record<'atk' | 'def' | 'spd', number>>;
}

export interface CharacterEquipment {
  weapon?: EquipmentItem;
  armor?: EquipmentItem;
}

export interface EquipmentInventoryEntry {
  itemId: string;   // EquipmentItem.id
  quantity: number;
}
