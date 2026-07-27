# Core Rules

## Authority

`docs/DECISIONS.md` is the highest-priority source for gameplay rules. This document consolidates those frozen rules and separates configurable or pending details from raw-spec suggestions.

## Frozen Rules

- Player taps a bucket to send it into the conveyor.
- A bucket occupies one conveyor slot after entering.
- Buckets automatically absorb exposed sand of the same color.
- A full bucket leaves and releases its conveyor slot.
- Three buckets of the same color can merge.
- The three merging buckets may have different capacities.
- In MVP, merge does not require adjacency by default.
- Gameplay randomness must be reproducible.
- Gameplay code must not use `Math.random()`.
- A full conveyor does not mean immediate failure.
- Deadlock must be checked only after absorption, gravity, merge, and exit resolution complete.
- Sand uses a two-dimensional logical grid.
- Visual particles are separate from logical sand particles.

## Sand Grid

Frozen:

- Sand logic is represented as a two-dimensional grid.
- Core sand rules must be implemented in pure TypeScript.
- Cocos nodes or components must not be required to evaluate core rules.

可配置:

- Grid width and height.
- Color palette and color ids.
- Initial sand pattern.
- Gravity step budget per tick.

待验证:

- Whether the MVP grid size should start at 64 x 64, 128 x 128, or another value.
- Whether exposed sand must use bottom-air flood fill exactly as proposed in the raw spec.

## Gravity

Frozen:

- Gravity must be deterministic.
- Identical input state and action history must produce identical output.
- Undo must restore random state as well as board state.

可配置:

- Number of gravity iterations per settlement phase.
- Tie-breaker seed.
- Whether diagonal priority is left-first, right-first, or seeded.

待验证:

- Exact timing between gravity, absorption, and merge checks.

## Exposed Sand

Frozen:

- Buckets absorb only exposed same-color sand.

可配置:

- Exposure algorithm implementation.
- Maximum sand absorbed per settlement step.

待验证:

- The raw spec recommends bottom-air connectivity; this should be validated against level-design needs before being frozen.

## Buckets

Frozen:

- Buckets have color and capacity.
- Buckets track current fill amount.
- Full buckets leave the conveyor and release slots.

可配置:

- Bucket capacity values.
- Absorption speed.
- Bucket spawn list per level.
- Whether partially filled buckets can merge.

待验证:

- Whether fill amount should display exact numbers, percentage, or both.

## Conveyor

Frozen:

- Default conveyor capacity is 6.
- Slot full state does not immediately trigger failure.

可配置:

- Per-level conveyor capacity.
- Temporary extra slot rules.
- Slot visual order and animation timing.

待验证:

- Whether difficult levels may use 4 or 5 slots in non-MVP content.

## Merge

Frozen:

- Three same-color buckets can merge.
- Different bucket capacities are allowed.
- MVP default does not require adjacency.

可配置:

- Whether merging partially filled buckets is allowed.
- Merge priority when more than three same-color buckets exist.
- Merge animation duration.
- Merge speed multiplier.

待验证:

- New merged bucket capacity formula.
- New merged bucket fill amount formula.
- Whether merge should happen before or after an absorption pass.

## Win And Failure

Frozen:

- Victory requires the sand artwork to be cleared.
- Failure/deadlock must not be checked immediately when slots become full.
- Failure can be checked only after active absorption, gravity, merge, and exit processing are complete.

可配置:

- Whether victory also waits for visual animations or only logical settlement.
- Failure reason labels.

待验证:

- Exact deadlock predicate for the MVP implementation.
- How special mechanisms affect deadlock if special buckets are postponed.
