# Battle State Machine

## Responsibility

Frozen:

- Player actions must be routed through `BattleStateMachine`.
- UI components must not directly mutate battle state.
- The battle state machine coordinates gameplay-domain systems and exposes stable view state to UI.

## Suggested State Model

待验证:

- Exact enum names are not frozen.
- Exact transition timing is not frozen.

Proposed states:

- `Idle`: waiting for player input.
- `SelectingBucket`: validating a bucket selection.
- `BucketEntering`: moving a selected bucket into the conveyor.
- `ResolvingMerge`: checking and resolving available merges.
- `Absorbing`: collecting exposed same-color sand.
- `ApplyingGravity`: settling sand.
- `CompletingBuckets`: removing full buckets.
- `CheckingOutcome`: checking victory or deadlock.
- `Won`: battle complete.
- `Failed`: deadlock reached.
- `Undoing`: restoring a previous stable state.

## Action Routing

Frozen:

- Bucket clicks go through the state machine.
- Undo goes through the state machine.
- Hint and extra-slot actions must not mutate core state directly from UI.

可配置:

- Whether hint is a pure query or consumes a resource.
- Whether extra slot is available in MVP as a local debug/config feature.

## Settlement Loop

Frozen:

- Deadlock checks happen after absorption, gravity, merge, and exit resolution have completed.

待验证:

- Exact loop order. The raw spec proposes click, slot check, enter conveyor, merge check, absorb, gravity, bucket completion, outcome check. This is a proposal, not yet a frozen implementation contract.

## Stable Snapshot

Frozen:

- Undo must restore gameplay state deterministically.

可配置:

- Snapshot granularity.
- Maximum undo count.
- Whether UI animation state is included or reconstructed.

待验证:

- Exact serialized snapshot shape.
