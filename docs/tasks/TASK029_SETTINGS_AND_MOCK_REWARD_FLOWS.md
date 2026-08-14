# TASK029: Settings And Mock Reward Flows

## Depends On

- `TASK028_COLLECTION_CONTRACT_AND_CERTIFICATE_POLISH.md`

## Goal

Finish the lightweight Settings popup and the mock reward flows used by Home and Settlement entry points.

## Scope

- Settings popup with sound and vibration toggles.
- Mock reward entry points for stamina, coins, and revive-style promotion hooks.
- Keep reward flows presentation-only until platform SDK approval exists.

## Out Of Scope

- No formal ad SDK integration.
- No real currency or platform wallet logic.
- No shop checkout flow.

## Acceptance Criteria

- Settings state persists and can be toggled from Home and Battle.
- Mock reward flow data is typed and testable.
- Reward entry points do not mutate gameplay rules directly.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

