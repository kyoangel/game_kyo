# Challenge Phrase Unlock System

## Goal
To implement a system where successfully clearing a stage unlocks "Challenge Phrases," which offer high rewards but impose specific constraints.

## Rules
- **Unlock Condition:** The phrase is unlocked only upon successful completion of the stage/game progression.
- **Phrase Structure:** Each phrase must contain a unique identifier, a specific constraint (e.g., "Must defeat boss in X turns," "Use only physical attacks"), and a corresponding high-value reward structure.
- **Constraint Application:** Once selected, the phrase's constraints apply to the subsequent playthrough or challenge run.
- **Reward Scaling:** The reward must scale proportionally with the difficulty imposed by the constraint, ensuring high rewards justify the added restriction.
- **Persistence:** The unlocked phrase and its constraints must be persisted across playthroughs until activated or abandoned.

## Acceptance Criteria
- Given the player successfully clears a stage, When they visit the progression screen, Then the newly unlocked Challenge Phrases are available for selection.
- Given a player selects an unlocked phrase, When they begin the next run, Then the game enforces all constraints defined by that phrase.
- Given a player successfully completes a run under the chosen phrase's constraints, When they return to the progression screen, Then the high-value reward associated with that phrase is granted.