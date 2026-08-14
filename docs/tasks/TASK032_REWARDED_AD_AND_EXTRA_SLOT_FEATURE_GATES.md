# TASK032: Rewarded Ad And Extra Slot Feature Gates

## Depends On

- `TASK031_BATTLE_TOOL_RULE_SPEC_AND_STATE_MACHINE.md`

## Goal

Promote rewarded revive and optional extra conveyor slot from placeholders into feature-gated, tested runtime flows.

## Scope

- Keep mock ad service as the first implementation layer.
- Implement revive only after its rules are documented.
- Implement extra carrier slot only behind an explicit feature flag.
- Ensure conveyor capacity changes are localized, deterministic, and tested.

## Out Of Scope

- No formal ad SDK without approval.
- No untested conveyor capacity changes.
- No shop dependency.

## Acceptance Criteria

- Revive flow has explicit acceptance and rejection states.
- Extra slot cannot affect default conveyor capacity unless the feature flag is active.
- Existing default conveyor capacity remains 6.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

