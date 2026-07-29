# MVP Roadmap

## Goal

Build a first playable portrait battle MVP that validates the core sand, bucket, conveyor, merge, undo, win, and deadlock loop.

## Phase 1: Core Domain Prototype

Frozen scope:

- Pure TypeScript sand grid.
- Deterministic gravity.
- Exposed sand detection.
- Bucket state.
- Conveyor state.
- Seeded randomness.
- Basic win and deadlock checks.

待验证:

- Exact exposure algorithm.
- Exact settlement order.
- Exact data schema.

## Phase 2: Battle Loop

Frozen scope:

- `BattleStateMachine`.
- Bucket click action.
- Automatic absorption.
- Full bucket exit.
- Three-bucket merge.
- Undo.
- Test level.

可配置:

- Bucket capacities.
- Absorption speed.
- Merge speed multiplier.
- Conveyor capacity override for future levels.

## Phase 3: Portrait Battle UI

Frozen scope:

- Portrait-only battle screen.
- 750 x 1334 baseline.
- Sand area, conveyor, bucket pool, tool bar.
- Default six conveyor slots.
- Bucket pool 2 rows x 4 columns.
- Pause, fail, win, and feedback UI.

待验证:

- Whether Home or Level Select is necessary for the first playable handoff.
- Exact adaptive layout algorithm.

## Phase 4: MVP Acceptance And Polish

Frozen scope:

- `TASK_016_FIRST_PLAYABLE_HARDENING.md`: stabilize the TASK015 First Playable before expanding MVP scope.
- `TASK_017_BATTLE_READABILITY_AND_INTERACTION_POLISH.md`: integrate the approved Sand Workshop battle visual direction into the First Playable readability and interaction layer without changing gameplay rules.
- `TASK_018_BATTLE_PRESENTATION_COMPLETION.md`: complete the baseline Battle presentation for MVP acceptance after TASK017, without level expansion or multi-resolution adaptation.
- Determinism checks.
- Undo checks.
- Deadlock checks.
- Portrait layout checks.
- Architecture boundary checks.

可配置:

- Performance target thresholds.
- Visual effects quality.
- Toast text.
- Exact battle art asset implementation details.
- Exact Cocos Prefab split, as long as scene and Prefab references remain safe.

## Explicitly Postponed

Excluded from MVP:

- Shop.
- Sign-in.
- Leaderboard.
- Daily challenge.
- Formal ad SDK.
- Social system.

待验证 for later:

- Collection.
- Special buckets.
- Rewarded-ad-like extra slot behavior.
- Economy and reward tuning.
