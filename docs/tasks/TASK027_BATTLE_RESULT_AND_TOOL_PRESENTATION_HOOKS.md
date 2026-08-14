# TASK027: Battle Result And Tool Presentation Hooks

## Depends On

- `TASK026_HOME_ACQUIRE_AND_SELECTION_SURFACES.md`

## Goal

Complete Battle settlement and tool-entry presentation hooks while preserving all current Battle rules.

## Scope

- Victory presentation exposes artwork text, reward text, Share, Next Level, Replay, and Home states.
- Deadlock presentation exposes failure message, stamina text, rewarded revive entry, Replay, and Home states.
- Two tool entries are visible as gated presentation hooks.
- Tool effects remain disabled until their rules are specified.

## Out Of Scope

- No tool gameplay behavior.
- No revive gameplay behavior.
- No ad SDK.
- No extra conveyor slot.

## Acceptance Criteria

- Result presentation data is typed and tested.
- Reward and stamina text come from runtime input, not hard-coded art.
- Share and revive are represented as auxiliary actions.
- Tool entries are visible but feature-gated and disabled.
- Battle actions still route through `BattleStateMachine`.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

