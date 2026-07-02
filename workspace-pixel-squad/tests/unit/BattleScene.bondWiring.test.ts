import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Spec: pixel-squad-bond-system
//
// BondSystem.ts (pickSupporter, getBond, rollSupportAttack, calcSupportDamage,
// resetSupportRoundFlags) implements the business logic and has its own
// passing unit tests (BondSystem.test.ts). What's missing is the wiring into
// BattleScene.ts: no call sites for any of the above symbols exist there yet.
// BattleScene extends Phaser.Scene and cannot be instantiated under this
// project's Node vitest environment, so wiring is verified by reading the
// real source and asserting the exact call sites / guard ordering the spec
// prescribes.
//
// AC-13, AC-14.

let source: string;

beforeAll(() => {
  source = readBattleSceneSource();
});

describe('BondSystem imports', () => {
  it('imports pickSupporter, getBond, rollSupportAttack, calcSupportDamage, resetSupportRoundFlags from ../battle/BondSystem', () => {
    expect(source).toMatch(/pickSupporter/);
    expect(source).toMatch(/getBond/);
    expect(source).toMatch(/rollSupportAttack/);
    expect(source).toMatch(/calcSupportDamage/);
    expect(source).toMatch(/resetSupportRoundFlags/);
    expect(source).toMatch(/from ['"]\.\.\/battle\/BondSystem['"]/);
  });
});

describe('AC-13: executePlayerCommand\'s final damage block gates the support attack on finalTarget.alive', () => {
  let body: string;

  beforeAll(() => {
    body = extractMethod(source, 'executePlayerCommand');
  });

  it('calls pickSupporter with the attacker, playerParty, and gameState bondLevels', () => {
    expect(body).toMatch(/pickSupporter\(cmd\.character,\s*this\.playerParty,\s*this\.gameState\?\.bondLevels\)/);
  });

  it('the pickSupporter call site sits inside a branch guarded by finalTarget.alive (a killing blow never reaches it)', () => {
    const guardMatch = /if\s*\(!finalTarget\.alive\)\s*\{\s*next\(\);\s*return;\s*\}/;
    expect(body).toMatch(guardMatch);

    const guardIdx = body.search(guardMatch);
    const pickIdx = body.indexOf('pickSupporter(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(pickIdx).toBeGreaterThan(-1);
    expect(pickIdx).toBeGreaterThan(guardIdx);
  });

  it('rolls the support attack via rollSupportAttack(bond) before triggering it', () => {
    expect(body).toMatch(/rollSupportAttack\(bond\)/);
  });

  it('marks the supporter as having used their support this round before applying the follow-up hit', () => {
    expect(body).toMatch(/supporter\.supportUsedThisRound\s*=\s*true/);
  });

  it('the supporter-triggered call to applyDamageAndAdvance uses calcSupportDamage and the label 援護攻擊', () => {
    expect(body).toMatch(/calcSupportDamage\(supporter,\s*finalTarget\)/);
    expect(body).toMatch(/applyDamageAndAdvance\(supporter,\s*finalTarget,\s*supportDmg,\s*'援護攻擊',\s*next\)/);
  });
});

describe('AC-14: startCommandPhase resets support-attack round flags alongside resetRoundFlags', () => {
  it('calls resetSupportRoundFlags(this.playerParty)', () => {
    const body = extractMethod(source, 'startCommandPhase');
    expect(body).toMatch(/resetRoundFlags\(\[\.\.\.this\.playerParty,\s*\.\.\.this\.enemyParty\]\)/);
    expect(body).toMatch(/resetSupportRoundFlags\(this\.playerParty\)/);
  });
});
