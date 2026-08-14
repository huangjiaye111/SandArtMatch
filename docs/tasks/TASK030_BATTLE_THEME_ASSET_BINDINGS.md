# TASK030: Battle Theme Asset Bindings

## Depends On

- `TASK029_SETTINGS_AND_MOCK_REWARD_FLOWS.md`

## Goal

Connect Battle theme presentation data to replaceable asset bindings for background, frame, and decoration placeholders.

## Scope

- Use `BattleThemePresentationModel` as the typed contract.
- Bind theme background, sand frame, and decoration placeholders in Cocos presentation code.
- Preserve dynamic sand artwork as runtime content.
- Preserve fallback colors when final assets are missing.

## Out Of Scope

- No gameplay rule changes.
- No conveyor capacity changes.
- No bucket-pool layout changes.
- No unsafe serialized scene or prefab regeneration.

## Acceptance Criteria

- Current level theme resolves deterministically from the level catalog.
- Battle presentation can use SpriteFrame keys or fallback placeholder colors.
- Missing theme assets do not block battle startup.
- Manual Cocos validation instructions are documented if scene wiring is required.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

