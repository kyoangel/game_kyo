# Permanent Death Mode (Hard Mode)

## Goal
To implement a Hard Mode where characters permanently leave the party upon death, requiring robust tracking of roster composition and game state persistence.

## Rules
- **Mode Dependency:** The permanent death mechanic is only active when the game is running in Hard Mode. Standard mode deaths allow for recovery or revival attempts (if applicable).
- **Death Sequence:** When a character dies in Hard Mode, the death sequence must play out fully. Following this, the character is flagged as permanently lost and removed from the active roster for subsequent battles.
- **Roster Persistence:** The game must persist the current party composition (minus permanently lost members) between playthroughs if a new run begins.
- **Game Over Condition:** If the entire party is wiped out in Hard Mode, the game enters a permanent failure state and cannot be revived or continued.
- **Data Model Change:** The `Character` object must gain a new status field (`deathStatus`) to differentiate between temporary incapacitation, recoverable death, and permanent loss.

**Data Model Changes:**
- **`Character` Interface Update:** Add `deathStatus?: 'alive' | 'knockedDown' | 'permanentLoss'` to track the character's current state within a battle instance.
- **`GameState` Update:** Add `currentRosterIds: string[]` to track the IDs of all characters currently belonging to the run, allowing for permanent removal tracking.

**UI Changes:**
- The death screen/end-of-battle summary must clearly indicate if the character's loss was permanent due to Hard Mode.

## Acceptance Criteria
- Given the game is running in Hard Mode, When a character's HP reaches 0, Then their `deathStatus` is set to 'permanentLoss', and they are removed from the active party roster.
- Given the game is running in Hard Mode, When a character dies but the entire party survives the battle, Then their `deathStatus` is set to 'permanentLoss', but the game continues.
- Given Hard Mode is active, When all characters in the party reach 'permanentLoss', Then the game enters a definitive failure state.
- Given Hard Mode is active, When the run successfully clears a stage and returns to the main menu, Then the `GameState` reflects the reduced roster size if any permanent losses occurred.