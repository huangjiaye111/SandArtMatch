# Acceptance Criteria

## Gameplay

Frozen:

- Player can tap a bucket and send it into the conveyor.
- Conveyor default capacity is 6.
- A bucket occupies one slot.
- Buckets absorb exposed same-color sand automatically.
- Full buckets leave and release slots.
- Three same-color buckets can merge.
- Different capacities can merge.
- MVP merge does not require adjacency by default.
- Full conveyor does not immediately fail the level.
- Deadlock is checked only after absorption, gravity, merge, and exit resolution complete.
- Gameplay randomness is deterministic.
- Gameplay code does not use `Math.random()`.
- Undo restores sand, buckets, conveyor, and random state.

## UI

Frozen:

- Battle UI is portrait.
- Base design resolution is 750 x 1334.
- Battle layout uses sand area, conveyor, bucket pool, and tool bar.
- Six default conveyor slots are visible.
- Bucket pool uses 2 rows x 4 columns.

可配置:

- Exact pixel positions.
- Art assets.
- Animations.
- Toast text.

待验证:

- Exact minimum tap target on all target devices.
- Whether non-battle screens are required for MVP acceptance.

## Architecture

Frozen:

- Gameplay-domain logic is pure TypeScript.
- Core gameplay can be tested without loading a Cocos scene.
- UI does not directly mutate gameplay state.
- Player actions route through `BattleStateMachine`.

## MVP Exclusions

Acceptance for the first MVP must not require:

- Shop.
- Sign-in.
- Leaderboard.
- Daily challenge.
- Formal ad SDK.
- Social system.

## Open Test Questions

待验证:

- Exact deadlock cases.
- Exact merge priority when more than three matching buckets exist.
- Exact exposure algorithm.
- Exact state-machine phase names.
- Exact performance device matrix.
