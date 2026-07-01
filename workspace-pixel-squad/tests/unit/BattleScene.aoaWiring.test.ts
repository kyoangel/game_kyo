import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Spec: pixel-squad-all-out-attack-wiring
//
// AllOutAttack.ts and TurnEngine.ts already implement (and already have
// passing unit tests for) all the business logic this feature needs:
// canKnockDown, shouldTriggerAoa, applyAllOutAttack, resetAoaRoundState,
// applyWeaknessBonus, resetRoundFlags. See AllOutAttack.*.test.ts and
// TurnEngine.bonusAction.test.ts (AC-14 — those suites are untouched here).
//
// What's missing is entirely the *wiring*: BattleScene.ts has zero call
// sites for any of the above (verified: `grep` for every symbol below
// against src/scenes/BattleScene.ts returns nothing). BattleScene extends
// Phaser.Scene and cannot be instantiated in this project's Node vitest
// environment, so the wiring can't be exercised by construction. Instead,
// these tests read the real BattleScene.ts source and assert the exact
// call sites the spec prescribes — they fail today because the wiring is
// genuinely absent, and will pass once BattleScene.ts is edited per spec.

let source: string;

beforeAll(() => {
  source = readBattleSceneSource();
});

// ── Data model: aoaState field ──────────────────────────────────────────────

describe('aoaState field wiring', () => {
  it('declares a private aoaState field typed as AoaRoundState, defaulting to usedThisRound: false', () => {
    expect(source).toMatch(/private\s+aoaState:\s*AoaRoundState\s*=\s*\{\s*usedThisRound:\s*false\s*\}/);
  });

  it('imports the AoaRoundState type from ../battle/AllOutAttack', () => {
    expect(source).toMatch(/AoaRoundState/);
    expect(source).toMatch(/from ['"]\.\.\/battle\/AllOutAttack['"]/);
  });

  it('resets aoaState inside init() alongside the other per-battle resets', () => {
    const body = extractMethod(source, 'init');
    expect(body).toMatch(/this\.aoaState\s*=\s*\{\s*usedThisRound:\s*false\s*\}/);
  });
});

// ── Structural: index-based executeNextInOrder → queue-based executeNextInQueue ──

describe('structural refactor: queue-based execution replaces index-based executeNextInOrder', () => {
  it('executeNextInQueue is defined and drains dead entries from the front of the queue', () => {
    const body = extractMethod(source, 'executeNextInQueue');
    expect(body).not.toBe('');
    expect(body).toMatch(/while\s*\(queue\.length\s*>\s*0\s*&&\s*!queue\[0\]\.alive\)\s*queue\.shift\(\)/);
  });

  it('the old index-based executeNextInOrder no longer exists', () => {
    expect(source).not.toMatch(/executeNextInOrder/);
  });

  it('startExecution builds a turn-order queue and delegates to executeNextInQueue', () => {
    const body = extractMethod(source, 'startExecution');
    expect(body).toMatch(/computeTurnOrder\(\[\.\.\.this\.playerParty,\s*\.\.\.this\.enemyParty\]\)/);
    expect(body).toMatch(/executeNextInQueue\(queue\)/);
  });

  it('runAutoRound builds a turn-order queue and delegates to executeNextInQueue', () => {
    const body = extractMethod(source, 'runAutoRound');
    expect(body).toMatch(/executeNextInQueue\(queue\)/);
  });
});

// ── AC-1 / AC-2 / AC-3: knockdown on weakness hit, guarded by survival + canKnockDown ──

describe('AC-1/AC-2/AC-3: knockdown wiring in executePlayerCommand', () => {
  it('imports canKnockDown from ../battle/AllOutAttack', () => {
    expect(source).toMatch(/canKnockDown/);
  });

  it('computes hpAfterHit from the resolved damage before deciding knockdown', () => {
    const body = extractMethod(source, 'executePlayerCommand');
    expect(body).toMatch(/hpAfterHit\s*=\s*Math\.max\(0,\s*target\.stats\.hp\s*-\s*dmgResult\.damage\)/);
  });

  it('AC-1/AC-3: sets target.knockedDown = true only when weakness hit AND survives AND canKnockDown(target)', () => {
    const body = extractMethod(source, 'executePlayerCommand');
    expect(body).toMatch(/dmgResult\.isWeaknessHit\s*&&\s*hpAfterHit\s*>\s*0\s*&&\s*canKnockDown\(target\)/);
    expect(body).toMatch(/target\.knockedDown\s*=\s*true/);
  });

  it('AC-2: the knockdown guard requires hpAfterHit > 0, so a lethal weakness hit never sets knockedDown', () => {
    const body = extractMethod(source, 'executePlayerCommand');
    // The guard string itself encodes AC-2: the same condition checked above
    // must include the survival clause, not just the weakness-hit clause.
    expect(body).toMatch(/hpAfterHit\s*>\s*0/);
  });

  it('plays the non-blocking hit reaction and shows a stagger banner on knockdown', () => {
    const body = extractMethod(source, 'executePlayerCommand');
    expect(body).toMatch(/animator\.playHit\(false,\s*\(\)\s*=>\s*\{\s*\}\)/);
    expect(body).toMatch(/showStaggerBanner\(target\)/);
  });

  it('defines showStaggerBanner rendering a STAGGER banner that auto-destroys after 800ms', () => {
    const body = extractMethod(source, 'showStaggerBanner');
    expect(body).not.toBe('');
    expect(body).toMatch(/STAGGER/);
    expect(body).toMatch(/delayedCall\(800/);
  });
});

// ── AC-4 / AC-5 / AC-13: bonus action wiring — applyWeaknessBonus mutates the live queue ──

describe('AC-4/AC-5/AC-13: bonus action wiring via applyWeaknessBonus', () => {
  it('imports applyWeaknessBonus and resetRoundFlags from ../battle/TurnEngine', () => {
    expect(source).toMatch(/applyWeaknessBonus/);
    expect(source).toMatch(/resetRoundFlags/);
  });

  it('executePlayerCommand takes the remaining turn queue as a parameter', () => {
    expect(source).toMatch(
      /executePlayerCommand\(cmd:\s*PendingCommand,\s*queue:\s*Character\[\],\s*next:\s*\(\)\s*=>\s*void\)/
    );
  });

  it('calls applyWeaknessBonus with the attacker, post-hit HP, weakness flag, and queue', () => {
    const body = extractMethod(source, 'executePlayerCommand');
    expect(body).toMatch(/applyWeaknessBonus\(cmd\.character,\s*hpAfterHit,\s*dmgResult\.isWeaknessHit,\s*queue\)/);
  });

  it('executeNextInQueue forwards the same queue reference into executePlayerCommand (so unshift is visible to the caller)', () => {
    const body = extractMethod(source, 'executeNextInQueue');
    expect(body).toMatch(/executePlayerCommand\(cmd,\s*queue,\s*afterAction\)/);
  });
});

// ── AC-6 / AC-11: AOA prompt triggers after an action knocks down the last alive enemy ──

describe('AC-6/AC-11: AOA trigger check runs after every resolved action, before advancing the queue', () => {
  it('imports shouldTriggerAoa from ../battle/AllOutAttack and defines showAoaPrompt', () => {
    expect(source).toMatch(/shouldTriggerAoa/);
    expect(extractMethod(source, 'showAoaPrompt')).not.toBe('');
  });

  it('executeNextInQueue checks shouldTriggerAoa(this.enemyParty, this.aoaState) and interrupts with showAoaPrompt', () => {
    const body = extractMethod(source, 'executeNextInQueue');
    expect(body).toMatch(/shouldTriggerAoa\(this\.enemyParty,\s*this\.aoaState\)/);
    expect(body).toMatch(/showAoaPrompt\(/);
  });

  it('showAoaPrompt sets phase to all-out-attack-prompt', () => {
    const body = extractMethod(source, 'showAoaPrompt');
    expect(body).toMatch(/this\.phase\s*=\s*'all-out-attack-prompt'/);
  });
});

// ── AC-7 / AC-8: AOA confirm applies damage, kills enemies, and resumes/ends the battle ──

describe('AC-7/AC-8: AOA confirm path', () => {
  let body: string;

  beforeAll(() => {
    body = extractMethod(source, 'showAoaPrompt');
  });

  it('imports applyAllOutAttack from ../battle/AllOutAttack', () => {
    expect(source).toMatch(/applyAllOutAttack/);
  });

  it('confirm handler calls applyAllOutAttack with the player and enemy parties', () => {
    expect(body).toMatch(/applyAllOutAttack\(this\.playerParty,\s*this\.enemyParty\)/);
  });

  it('marks enemies with stats.hp <= 0 as dead and updates their HP bar', () => {
    expect(body).toMatch(/stats\.hp\s*<=\s*0/);
    expect(body).toMatch(/\.alive\s*=\s*false/);
    expect(body).toMatch(/updateHpBar\(e\)/);
  });

  it('sets aoaState.usedThisRound = true and returns phase to executing', () => {
    expect(body).toMatch(/this\.aoaState\.usedThisRound\s*=\s*true/);
    expect(body).toMatch(/this\.phase\s*=\s*'executing'/);
  });

  it('AC-8: after a 1200ms delay, checks battle end and only resumes the queue if the battle continues', () => {
    expect(body).toMatch(/delayedCall\(1200/);
    expect(body).toMatch(/checkBattleEnd\(\)/);
    expect(body).toMatch(/onDone\(\)/);
  });
});

// ── AC-9: AOA decline resumes execution and blocks re-trigger for the rest of the round ──

describe('AC-9: AOA decline path', () => {
  it('decline handler sets aoaState.usedThisRound = true, returns to executing, and resumes without applying AOA damage', () => {
    const body = extractMethod(source, 'showAoaPrompt');
    expect(body).toMatch(/declineBtn\.once\('pointerdown'/);

    const declineIdx = body.indexOf(`declineBtn.once('pointerdown'`);
    expect(declineIdx).toBeGreaterThan(-1);
    const declineSegment = body.slice(declineIdx);

    expect(declineSegment).toMatch(/this\.aoaState\.usedThisRound\s*=\s*true/);
    expect(declineSegment).toMatch(/this\.phase\s*=\s*'executing'/);
    expect(declineSegment).toMatch(/onDone\(\)/);
    expect(declineSegment).not.toMatch(/applyAllOutAttack/);
  });
});

// ── AC-10: round reset clears knockdown, bonus action, and AOA state ────────

describe('AC-10: startCommandPhase resets round-scoped flags', () => {
  it('calls resetRoundFlags with the combined player + enemy party', () => {
    const body = extractMethod(source, 'startCommandPhase');
    expect(body).toMatch(/resetRoundFlags\(\[\.\.\.this\.playerParty,\s*\.\.\.this\.enemyParty\]\)/);
  });

  it('calls resetAoaRoundState with this.aoaState', () => {
    const body = extractMethod(source, 'startCommandPhase');
    expect(source).toMatch(/resetAoaRoundState/);
    expect(body).toMatch(/resetAoaRoundState\(this\.aoaState\)/);
  });
});
