#!/bin/bash
cd /Users/kyo.lai82/Projects/Personal/game-factory/workspace-pixel-squad
node_modules/.bin/vitest run tests/unit/AllOutAttack.trigger.test.ts tests/unit/AllOutAttack.damage.test.ts tests/unit/AllOutAttack.knockdown.test.ts tests/unit/AllOutAttack.roundState.test.ts --reporter=verbose 2>&1
