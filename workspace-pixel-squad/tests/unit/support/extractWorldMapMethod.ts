import { readFileSync } from 'fs';
import { resolve } from 'path';

// WorldMapScene extends Phaser.Scene and cannot be instantiated in the Node
// vitest environment (no canvas/WebGL context — see vitest.config.ts:
// environment: 'node'). Mirrors tests/unit/support/extractMethod.ts, which
// establishes this same pattern for BattleScene.ts.

const WORLD_MAP_SCENE_PATH = resolve(__dirname, '../../../src/scenes/WorldMapScene.ts');

export function readWorldMapSceneSource(): string {
  return readFileSync(WORLD_MAP_SCENE_PATH, 'utf-8');
}

/**
 * Extracts the full text (signature + body) of a `private` class method
 * from WorldMapScene.ts source, by locating its declaration and
 * brace-matching to the closing `}`. Returns '' when the method doesn't
 * exist.
 */
export function extractMethod(source: string, methodName: string): string {
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
