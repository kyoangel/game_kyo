# Battle Scene State Initialization Insertion Point

## Goal
To provide a precise and unambiguous location within `BattleScene.ts` where new game state initialization logic must be inserted during the scene's `create()` lifecycle.

## Rules
- The insertion point is fixed at `scenes/BattleScene.ts:135`.
- The new logic must execute immediately following the line where `this.gameState` is assigned its initial value (`this.gameState = data.gameState`).
- The spec must reference this specific file and line number to ensure the developer knows exactly where to place their code.

## Acceptance Criteria
- Given a new feature requires initialization of `this.gameState` data structures, When the implementation spec is written, Then it must explicitly state: "Insert new logic after `this.gameState = data.gameState` at `scenes/BattleScene.ts:135`."