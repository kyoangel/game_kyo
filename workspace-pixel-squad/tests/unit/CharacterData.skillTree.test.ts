import { describe, it, expect } from 'vitest';
import { PLAYER_TEMPLATES } from '../../src/data/characters';
import { SKILLS } from '../../src/data/skills';

// Spec: specs/pixel-squad-skill-tree.md — "Data model changes (src/data/characters.ts)"

interface RawSkillTreeNode {
  id: string;
  branch: string;
  tier: number;
  skillId: string;
  cost: number;
}

// Table transcribed verbatim from the spec's assignment table.
const EXPECTED: Record<string, { offense: [string, string]; control: [string, string]; support: [string, string] }> = {
  protagonist: { offense: ['swift_strike', 'fire_grenade'], control: ['cryo_round', 'emp_pulse'], support: ['combat_stim', 'overdrive'] },
  rex: { offense: ['burst_shot', 'fire_grenade'], control: ['acid_splash', 'toxic_spray'], support: ['iron_will', 'overdrive'] },
  nyx: { offense: ['burst_shot', 'fire_grenade'], control: ['emp_pulse', 'cryo_round'], support: ['combat_stim', 'overdrive'] },
  vega: { offense: ['shield_bash', 'swift_strike'], control: ['acid_splash', 'emp_pulse'], support: ['iron_will', 'overdrive'] },
  ash: { offense: ['shield_bash', 'burst_shot'], control: ['toxic_spray', 'cryo_round'], support: ['field_medic', 'overdrive'] },
  crow: { offense: ['swift_strike', 'fire_grenade'], control: ['emp_pulse', 'acid_splash'], support: ['combat_stim', 'iron_will'] },
  mira: { offense: ['burst_shot', 'shield_bash'], control: ['toxic_spray', 'cryo_round'], support: ['iron_will', 'combat_stim'] },
  zora: { offense: ['shield_bash', 'fire_grenade'], control: ['cryo_round', 'toxic_spray'], support: ['iron_will', 'field_medic'] },
  rook: { offense: ['shield_bash', 'burst_shot'], control: ['emp_pulse', 'toxic_spray'], support: ['iron_will', 'overdrive'] },
  dex: { offense: ['fire_grenade', 'shield_bash'], control: ['acid_splash', 'cryo_round'], support: ['field_medic', 'iron_will'] },
  echo: { offense: ['swift_strike', 'burst_shot'], control: ['emp_pulse', 'acid_splash'], support: ['combat_stim', 'overdrive'] },
  aaaa: { offense: ['fire_grenade', 'burst_shot'], control: ['toxic_spray', 'cryo_round'], support: ['overdrive', 'combat_stim'] },
};

const OFFENSE_SKILLS = new Set(['burst_shot', 'shield_bash', 'swift_strike', 'fire_grenade']);
const CONTROL_SKILLS = new Set(['cryo_round', 'acid_splash', 'emp_pulse', 'toxic_spray']);
const SUPPORT_SKILLS = new Set(['field_medic', 'combat_stim', 'iron_will', 'overdrive']);
const BRANCHES = ['offense', 'control', 'support'] as const;

function treeOf(templateId: string): RawSkillTreeNode[] {
  const t = PLAYER_TEMPLATES.find(t => t.id === templateId) as unknown as { skillTree?: RawSkillTreeNode[] } | undefined;
  return t?.skillTree ?? [];
}

describe('PLAYER_TEMPLATES — skillTree (rule 1)', () => {
  it('every template defines a skillTree of exactly 6 nodes', () => {
    PLAYER_TEMPLATES.forEach(t => {
      const tree = treeOf(t.id);
      expect(tree, `${t.id} missing skillTree`).toHaveLength(6);
    });
  });

  it('each tree has exactly 3 branches x 2 tiers, unique node ids following `${templateId}_${branch}_${tier}`, valid costs and skillIds', () => {
    PLAYER_TEMPLATES.forEach(t => {
      const tree = treeOf(t.id);
      const ids = tree.map(n => n.id);
      expect(new Set(ids).size, `${t.id} has duplicate node ids`).toBe(ids.length || 1);
      expect(ids.length, `${t.id} tree is empty`).toBeGreaterThan(0);

      BRANCHES.forEach(branch => {
        const nodesForBranch = tree.filter(n => n.branch === branch);
        expect(nodesForBranch, `${t.id} missing ${branch} branch nodes`).toHaveLength(2);
        const tiers = nodesForBranch.map(n => n.tier).sort();
        expect(tiers, `${t.id} ${branch} branch must have exactly tier 1 and tier 2`).toEqual([1, 2]);

        nodesForBranch.forEach(n => {
          expect(n.id, `${t.id} ${branch} tier ${n.tier} id mismatch`).toBe(`${t.id}_${branch}_${n.tier}`);
          expect(n.cost, `${t.id} ${n.id} cost mismatch`).toBe(n.tier === 1 ? 1 : 2);
          expect(SKILLS[n.skillId], `${t.id} ${n.id} skillId "${n.skillId}" not found in SKILLS`).toBeDefined();
        });
      });
    });
  });

  it('offense/control/support nodes only reference skills from their assigned category', () => {
    PLAYER_TEMPLATES.forEach(t => {
      const tree = treeOf(t.id);
      tree.filter(n => n.branch === 'offense').forEach(n =>
        expect(OFFENSE_SKILLS.has(n.skillId), `${t.id} offense node uses non-offense skill ${n.skillId}`).toBe(true));
      tree.filter(n => n.branch === 'control').forEach(n =>
        expect(CONTROL_SKILLS.has(n.skillId), `${t.id} control node uses non-control skill ${n.skillId}`).toBe(true));
      tree.filter(n => n.branch === 'support').forEach(n =>
        expect(SUPPORT_SKILLS.has(n.skillId), `${t.id} support node uses non-support skill ${n.skillId}`).toBe(true));
    });
  });

  Object.entries(EXPECTED).forEach(([templateId, expected]) => {
    it(`${templateId} matches the spec's exact skill assignment table`, () => {
      const template = PLAYER_TEMPLATES.find(t => t.id === templateId);
      expect(template, `${templateId} not found in PLAYER_TEMPLATES`).toBeDefined();
      const tree = treeOf(templateId);

      const skillAt = (branch: string, tier: number) => tree.find(n => n.branch === branch && n.tier === tier)?.skillId;
      expect(skillAt('offense', 1)).toBe(expected.offense[0]);
      expect(skillAt('offense', 2)).toBe(expected.offense[1]);
      expect(skillAt('control', 1)).toBe(expected.control[0]);
      expect(skillAt('control', 2)).toBe(expected.control[1]);
      expect(skillAt('support', 1)).toBe(expected.support[0]);
      expect(skillAt('support', 2)).toBe(expected.support[1]);
    });
  });
});
