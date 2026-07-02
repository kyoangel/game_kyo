# Random Travel Event System

## Goal
To introduce unpredictable events during the journey between stages that affect player resources and progression.

## Rules
- Events trigger randomly while traveling between cleared stages (or during a designated "travel phase").
- The system must select one of the following event types: Supply Drop (補給), Ambush (伏擊), or Merchant Encounter (商旅).
- Each event type must have specific effects on the player's resources (`resources` object) and potentially introduce new items or challenges.
- Event resolution must be deterministic based on the random seed used for the journey segment, ensuring reproducibility.

### Event Types and Effects:
1. **Supply Drop (補給):**
    - Effect: Grants a small, randomized amount of basic resources (e.g., food, medicine).
    - Effect: May optionally grant a minor resource bonus (e.g., +1 extra unit of currency).
2. **Ambush (伏擊):**
    - Effect: Triggers a minor combat encounter against hostile entities. The difficulty should scale with the current game stage/chapter progression.
    - Effect: Successful combat resolves into resource gains (loot) or losses (if the player retreats).
3. **Merchant Encounter (商旅):**
    - Effect: Presents the player with a limited selection of items to buy or sell. This interaction must integrate with the existing `ShopSystem`.
    - Effect: Buying/Selling actions consume time or resources and must be logged in the journey history.

## Acceptance Criteria
- Given the player has cleared Stage N and is beginning travel to Stage N+1.
- When the `TravelPhase` begins, a random event is triggered based on the journey segment's unique seed.
- Then, the selected event occurs and its effect is applied to the player's `resources` object.
- Given an Ambush event occurs, When combat is resolved, Then the outcome (win/loss) correctly updates `resources` and journey logs.
- Given a Merchant Encounter occurs, When the player interacts with the merchant, Then the transaction correctly updates `resources` and triggers appropriate UI flow.