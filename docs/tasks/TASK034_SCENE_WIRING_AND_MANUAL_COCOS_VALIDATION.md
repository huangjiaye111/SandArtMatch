# TASK034: Scene Wiring And Manual Cocos Validation

## Depends On

- `TASK033_SHOP_AND_GAME_CIRCLE_PLACEHOLDERS.md`

## Goal

Wire the final runtime task surface into Cocos scenes and document the manual validation steps needed for editor/runtime confirmation.

## Scope

- Home, Battle, Collection, and Settings scene wiring.
- Node contracts for presentation models and buttons.
- Manual Cocos validation for sprite frames, button hit areas, and flow transitions.

## Out Of Scope

- No new gameplay rules.
- No asset regeneration without inspection.
- No scene or prefab edits without matching contract changes and validation notes.

## Acceptance Criteria

- Scene wiring matches the current typed contracts.
- Manual validation steps are explicit and repeatable.
- No serialized scene or prefab file is changed without inspection.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

