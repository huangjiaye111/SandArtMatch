# Battle Tools

## TASK031 Frozen Rules

Battle tools are gameplay-domain actions routed through `BattleStateMachine`. UI may request a tool action, but UI must not directly mutate buckets, conveyor, sand, random state, or outcome state.

## Hint

- Action id: `hint`.
- Cost: `0` for the current MVP implementation.
- Cooldown: none.
- Allowed phase: `WaitingInput` only.
- Effect: pure query. Returns the deterministic recommended selectable bucket id.
- Selection priority: among current selectable bucket-pool front buckets, choose the first bucket whose color matches any currently exposed sand color; if no selectable bucket matches exposed sand, choose the first selectable bucket in bucket-pool order.
- State mutation: none. Hint does not advance the action index and does not consume random state.

## Shuffle

- Action id: `shuffle`.
- Cost: `0` for the current MVP implementation.
- Cooldown: none.
- Allowed phase: `WaitingInput` only.
- Effect: deterministically shuffles only bucket-pool buckets with `available` status. Conveyor buckets, completed buckets, sand grid, phase, and outcome state are not changed.
- Randomness: uses the battle state's seeded `SeededRandom` only. No `Math.random()`.
- State mutation: accepted shuffle advances the action index by `1` and updates the random snapshot.

## Current Battle UI Tools

The current Battle UI exposes the two target-selection tools from the v4 art prototype instead of the older Hint/Shuffle entries.

### Remove Lower Bucket

- Action id: `removePoolBucket`.
- Flow: tap the tool, then tap a visible lower bucket in the bucket pool.
- Effect: clears same-color sand from the painting up to the selected bucket's remaining capacity, then removes the selected `available` bucket from the bucket pool.
- State mutation: accepted use advances the battle action index by `1`.
- UI must not remove the bucket directly; route the selected bucket id through the battle runtime.

### Remove Carrier Bucket

- Action id: `removeCarrierBucket`.
- Flow: tap the tool, then tap a bucket already transported to the Carrier/conveyor.
- Effect: clears same-color sand from the painting up to the selected bucket's remaining capacity, then removes the selected `inConveyor` bucket from the Carrier/conveyor.
- State mutation: accepted use advances the battle action index by `1`.
- UI must not remove the bucket directly; route the selected bucket id through the battle runtime.
