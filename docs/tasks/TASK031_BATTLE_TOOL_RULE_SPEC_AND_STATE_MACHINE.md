# TASK031: Battle Tool Rule Spec And State Machine

## Depends On

- `TASK030_BATTLE_THEME_ASSET_BINDINGS.md`

## Goal

Define and implement the actual gameplay rules for the two Battle tools, then route them through `BattleStateMachine` with tests.

## Scope

- Specify tool names, costs, cooldowns, and allowed phases.
- Route player tool actions through `BattleStateMachine`.
- Keep deterministic seeded behavior.
- Update Battle presenter and view contracts as needed.

## Out Of Scope

- No extra slot feature.
- No ad revive feature beyond later gating.
- No shop or social systems.

## Acceptance Criteria

- Tool rules are documented before implementation details are changed.
- Tool actions are deterministic and testable outside Cocos.
- UI components do not mutate gameplay state directly.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

