import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Bug report round 1: the auto-battle "■ 停止" button rendered at the corner
// of the command window instead of inside it — showStopButton() built its
// rectangle/text at actionMenu-local (0, 0), but actionMenu is a container
// anchored at COMMAND_WIN's top-left corner, not its center.
//
// Bug report round 2 (found once the first fix was live): centering it at
// COMMAND_WIN.w/2, COMMAND_WIN.h/2 made it dead-center in the window — which
// is exactly where `messageText` (the attack/damage description line, also
// built at COMMAND_WIN.x + COMMAND_WIN.w/2, COMMAND_WIN.y + COMMAND_WIN.h/2
// in create()) renders. Since showStopButton() never removes/hides during
// an auto round, the button sat on top of and hid the damage text for the
// whole round. Fixed by pinning the button to a compact top-right badge,
// clear of the vertical center where messageText renders.

describe('BattleScene showStopButton() — visible without covering messageText', () => {
  let source: string;
  let body: string;

  beforeAll(() => {
    source = readBattleSceneSource();
    body = extractMethod(source, 'showStopButton');
  });

  it('does not place the stop rectangle/label at actionMenu-local (0, 0)', () => {
    expect(body).not.toMatch(/this\.add\.rectangle\(0,\s*0,/);
    expect(body).not.toMatch(/this\.add\.text\(0,\s*0,\s*'■ 停止'/);
  });

  it('does not center the button at COMMAND_WIN.h/2 — that is messageText\'s vertical center', () => {
    expect(body).not.toMatch(/COMMAND_WIN\.h\s*\/\s*2/);
  });

  it('anchors the button horizontally off COMMAND_WIN.w, not a bare literal', () => {
    expect(body).toMatch(/COMMAND_WIN\.w/);
  });
});
