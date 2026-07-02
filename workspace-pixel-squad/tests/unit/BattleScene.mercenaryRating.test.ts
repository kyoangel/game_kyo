import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Spec: pixel-squad-mercenary-rating
//
// This is a wiring task: calculateStarRating (extended with a 4th param,
// see resultUI.starRating.test.ts) and processVictory (extended with a 6th
// param, see VictoryProcessor.starRating.test.ts) already exist as pure
// functions. What's missing is BattleScene's `battleStats` accumulator that
// feeds them: nothing in src/scenes/BattleScene.ts currently tracks
// rounds-used, player-KO-count, or weakness-hit-count.
//
// BattleScene extends Phaser.Scene and cannot be instantiated in this
// project's Node vitest environment (see BattleScene.aoaWiring.test.ts for
// the established precedent), so these tests read the real BattleScene.ts
// source and assert the exact call sites the spec prescribes.

let source: string;

beforeAll(() => {
  source = readBattleSceneSource();
});

describe('battleStats field wiring', () => {
  it('declares a private battleStats field typed as BattlePerformanceStats, defaulting all counters to 0', () => {
    expect(source).toMatch(
      /private\s+battleStats:\s*BattlePerformanceStats\s*=\s*\{\s*playerKOCount:\s*0,\s*weaknessHitCount:\s*0,\s*roundsUsed:\s*0\s*\}/
    );
  });

  it('resets battleStats inside init() alongside the other per-battle resets', () => {
    const body = extractMethod(source, 'init');
    expect(body).toMatch(
      /this\.battleStats\s*=\s*\{\s*playerKOCount:\s*0,\s*weaknessHitCount:\s*0,\s*roundsUsed:\s*0\s*\}/
    );
  });
});

describe('AC-7: roundsUsed increments once per round start', () => {
  it('startCommandPhase increments this.battleStats.roundsUsed as the first line of the method body', () => {
    const body = extractMethod(source, 'startCommandPhase');
    expect(body).not.toBe('');
    const trimmed = body.replace(/^[^{]*\{/, '').trim();
    expect(trimmed).toMatch(/^this\.battleStats\.roundsUsed\+\+;/);
  });
});

describe('AC-8: the auto-continue round-start path increments roundsUsed exactly once (not double-counted with enterAutoMode)', () => {
  it('executeNextInQueue increments roundsUsed immediately before the runAutoRound() auto-continue call', () => {
    const body = extractMethod(source, 'executeNextInQueue');
    expect(body).toMatch(/this\.battleStats\.roundsUsed\+\+;\s*\n\s*this\.runAutoRound\(\);/);
  });

  it('enterAutoMode does NOT increment roundsUsed (the current round was already counted by startCommandPhase)', () => {
    const body = extractMethod(source, 'enterAutoMode');
    expect(body).not.toMatch(/battleStats\.roundsUsed/);
  });
});

describe('AC-9/AC-4 mapping: playerKOCount only increments for player-party deaths', () => {
  it('applyDamageAndAdvance increments playerKOCount guarded by target.isPlayer, before target.alive is set to false', () => {
    const body = extractMethod(source, 'applyDamageAndAdvance');
    expect(body).toMatch(/const died = target\.stats\.hp === 0;/);
    const diedIdx = body.indexOf('const died = target.stats.hp === 0;');
    const aliveIdx = body.indexOf('if (died) target.alive = false;');
    expect(diedIdx).toBeGreaterThan(-1);
    expect(aliveIdx).toBeGreaterThan(-1);
    const between = body.slice(diedIdx, aliveIdx);
    expect(between).toMatch(/if\s*\(died\s*&&\s*target\.isPlayer\)\s*this\.battleStats\.playerKOCount\+\+;/);
  });

  it('the All-Out-Attack confirm handler never touches playerKOCount (it only kills enemies)', () => {
    const body = extractMethod(source, 'showAoaPrompt');
    expect(body).not.toMatch(/battleStats\.playerKOCount/);
  });
});

describe('AC-10: weaknessHitCount increments once per player-inflicted weakness hit', () => {
  it('executePlayerCommand increments weaknessHitCount guarded by dmgResult.isWeaknessHit, before recordHitDiscovery', () => {
    const body = extractMethod(source, 'executePlayerCommand');
    const dmgIdx = body.indexOf('const dmgResult = calcDamage(');
    const recordIdx = body.indexOf('recordHitDiscovery(');
    expect(dmgIdx).toBeGreaterThan(-1);
    expect(recordIdx).toBeGreaterThan(-1);
    const between = body.slice(dmgIdx, recordIdx);
    expect(between).toMatch(/if\s*\(dmgResult\.isWeaknessHit\)\s*this\.battleStats\.weaknessHitCount\+\+;/);
  });
});

describe('checkBattleEnd forwards battleStats into the ResultScene transition payload', () => {
  it('includes battleStats: this.battleStats in the scene.start(\'ResultScene\', ...) payload', () => {
    const body = extractMethod(source, 'checkBattleEnd');
    expect(body).toMatch(/scene\.start\('ResultScene',/);
    expect(body).toMatch(/battleStats:\s*this\.battleStats,?/);
  });
});
