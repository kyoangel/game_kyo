import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Bug report: the auto-battle "■ 停止" button rendered at the corner of the
// command window instead of centered inside it. showStopButton() built its
// rectangle/text at actionMenu-local (0,0), but actionMenu is a container
// anchored at COMMAND_WIN's top-left corner (see COMMAND_WIN.x/y passed to
// this.add.container(...) in create()), not its center — every other panel
// added to actionMenu (e.g. showAoaPrompt's confirm/decline buttons) uses
// COMMAND_WIN.w/2 and COMMAND_WIN.h/2 as the local center instead.

describe('BattleScene showStopButton() — centers inside COMMAND_WIN, not at its corner', () => {
  let source: string;
  let body: string;

  beforeAll(() => {
    source = readBattleSceneSource();
    body = extractMethod(source, 'showStopButton');
  });

  it('computes the window center from COMMAND_WIN.w/2 and COMMAND_WIN.h/2', () => {
    expect(body).toMatch(/COMMAND_WIN\.w\s*\/\s*2/);
    expect(body).toMatch(/COMMAND_WIN\.h\s*\/\s*2/);
  });

  it('places the stop rectangle and label at the computed center, not local (0, 0)', () => {
    expect(body).not.toMatch(/this\.add\.rectangle\(0,\s*0,\s*120,\s*36/);
    expect(body).not.toMatch(/this\.add\.text\(0,\s*0,\s*'■ 停止'/);
  });
});
