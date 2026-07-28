# Project Documentation Index

This documentation set consolidates the current portrait-mode plan for SandArtMatch.

Priority order:

1. `docs/DECISIONS.md`
2. `AGENTS.md`
3. Files under this index
4. `docs/source/PRODUCT_SPEC_RAW.txt`

Files under `docs/source/` are raw reference material. If source material conflicts with `docs/DECISIONS.md`, follow `docs/DECISIONS.md`.

## Product

- `docs/product/GAME_DESIGN.md`: product positioning, MVP scope, and feature boundaries.
- `docs/planning/MVP_ROADMAP.md`: staged delivery plan for the first playable version.

## Gameplay

- `docs/gameplay/CORE_RULES.md`: frozen core rules, configurable rules, and open rule questions.
- `docs/gameplay/BATTLE_STATE_MACHINE.md`: battle-state responsibilities and action routing.
- `docs/gameplay/SPECIAL_BUCKETS.md`: special bucket ideas, all marked as post-MVP or pending validation unless frozen later.

## UI

- `docs/ui/UI_SPEC.md`: common UI rules, screens, components, and presentation constraints.
- `docs/ui/UI_FLOW.md`: page navigation, modal priority, and popup flow.
- `docs/ui/BATTLE_LAYOUT.md`: portrait battle layout and adaptation rules.

## Technical

- `docs/technical/ARCHITECTURE.md`: gameplay-domain and Cocos presentation boundaries.
- `docs/technical/DATA_SCHEMA.md`: proposed data structures and configuration schema.
- `docs/technical/PERFORMANCE.md`: performance targets and validation notes.

## Testing

- `docs/testing/ACCEPTANCE_CRITERIA.md`: acceptance criteria for MVP gameplay, UI, and technical boundaries.

## Tasks

- `docs/tasks/TASK_016_FIRST_PLAYABLE_HARDENING.md`: First Playable stability, deterministic replay, lifecycle, Cocos validation, and performance-baseline hardening.

## Known Source Issues

- The raw spec contains both V0.4 and V0.5 content, causing repeated coverage of UI layout, MVP scope, page flow, resources, and scene structure.
- The final project direction is portrait only.
- Non-MVP systems from the source spec, including shop, sign-in, leaderboard, daily challenge, formal ad SDK, and social systems, are not part of the first MVP.
