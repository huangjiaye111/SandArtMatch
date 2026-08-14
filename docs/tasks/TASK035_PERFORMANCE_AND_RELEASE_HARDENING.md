# TASK035: Performance And Release Hardening

## Depends On

- `TASK034_SCENE_WIRING_AND_MANUAL_COCOS_VALIDATION.md`

## Goal

Perform final regression, performance, and release-readiness hardening for the complete game flow.

## Scope

- Full flow validation: Boot -> Home -> Battle -> Victory/Deadlock -> Home -> Collection.
- Performance review of sand canvas, particle feedback, conveyor motion, and scene loading.
- Save/load regression checks.
- Final risk list for any post-MVP gated feature.

## Out Of Scope

- No new feature implementation.
- No design rule changes.
- No production dependency additions.

## Acceptance Criteria

- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.
- Manual Cocos validation passes for the full runtime flow.
- Known post-MVP features are documented as gated or deferred.
- No unresolved blocker remains for MVP release candidate testing.

