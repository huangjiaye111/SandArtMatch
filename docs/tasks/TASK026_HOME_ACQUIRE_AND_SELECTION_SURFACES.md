# TASK026: Home Acquire And Selection Surfaces

## Depends On

- `TASK025_IMPLEMENTATION_ROADMAP.md`
- `TASK024_PROTOTYPE_UI_PRESENTATION_ROADMAP.md`

## Goal

Finish the Home screen presentation contract for stamina, coins, acquire entries, and level selection without changing gameplay rules or theming Home per level.

## Scope

- Render stamina and coins from runtime data.
- Expose lightweight acquire entries for stamina and coins.
- Keep Play as the only action that enters Battle.
- Keep level states visible: completed, current, unlocked, locked.
- Keep Settings, Collection, Shop, and Game Circle as visible or gated entry points only when backed by current flows.

## Out Of Scope

- No formal ad SDK.
- No shop purchase logic.
- No social or game-circle flow.
- No Home theme skinning by selected level.

## Acceptance Criteria

- `HomeData` exposes resource and acquire entry view data.
- Home presentation can show current stamina and coins without fixed art values.
- Locked levels cannot be selected or played.
- Play starts only the selected unlocked level through `GameNavigator`.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

