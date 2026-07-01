import { readFileSync } from 'fs';
import { resolve } from 'path';

// BattleScene extends Phaser.Scene and cannot be instantiated in the Node
// vitest environment (no canvas/WebGL context — see vitest.config.ts:
// environment: 'node'). These helpers let wiring tests assert that specific
// call sites exist in the real source file, by reading it as text and
// brace-matching method bodies, instead of exercising the scene at runtime.

const BATTLE_SCENE_PATH = resolve(__dirname, '../../../src/scenes/BattleScene.ts');

export function readBattleSceneSource(): string {
  return readFileSync(BATTLE_SCENE_PATH, 'utf-8');
}

/**
 * Extracts the full text (signature + body) of a `private` class method
 * from BattleScene.ts source, by locating its declaration and brace-matching
 * to the closing `}`. Returns '' when the method doesn't exist (yet) —
 * callers assert against that as a legitimate "not implemented" signal
 * rather than treating it as a lookup error.
 */
export function extractMethod(source: string, methodName: string): string {
  // `private` is optional: Phaser lifecycle methods (init, preload, create,
  // update) override public base-class members and can't be narrowed to
  // `private`, so they're declared without the modifier in BattleScene.ts.
  const declRe = new RegExp(`\\n[ \\t]*(?:private[ \\t]+)?${methodName}[ \\t]*\\(`);
  const m = declRe.exec(source);
  if (!m) return '';
  const declStart = m.index + 1;

  const parenStart = source.indexOf('(', declStart);
  if (parenStart === -1) return '';

  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < source.length; i++) {
    if (source[i] === '(') parenDepth++;
    else if (source[i] === ')') {
      parenDepth--;
      if (parenDepth === 0) { parenEnd = i; break; }
    }
  }
  if (parenEnd === -1) return '';

  const braceStart = source.indexOf('{', parenEnd);
  if (braceStart === -1) return '';

  let braceDepth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') braceDepth++;
    else if (source[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) return source.slice(declStart, i + 1);
    }
  }
  return source.slice(declStart);
}
