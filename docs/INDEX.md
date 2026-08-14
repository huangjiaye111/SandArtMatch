# Project Documentation Index

This documentation set consolidates the current portrait-mode plan for SandArtMatch.

Priority order:

1. `docs/DECISIONS.md`
2. `AGENTS.md`
3. Files under this index
4. `docs/source/PRODUCT_SPEC_RAW.txt`

Files under `docs/source/` are raw reference material. If source material conflicts with `docs/DECISIONS.md`, follow `docs/DECISIONS.md`.

## Domain Language

- `CONTEXT.md`: canonical product and gameplay terms for distinguishing formal MVP behavior from prototype and post-MVP planning.

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
- `docs/technical/BATTLE_ART_INTEGRATION_CONTRACT.md`: Battle runtime asset integration contract, including ownership, node contracts, replacement points, animation events, and performance budgets.
- `docs/technical/SCENE_WIRING_AND_MANUAL_VALIDATION.md`: Current Cocos scene wiring contracts and repeatable manual validation checklist.
- `docs/technical/DATA_SCHEMA.md`: proposed data structures and configuration schema.
- `docs/technical/PERFORMANCE.md`: performance targets and validation notes.

## Testing

- `docs/testing/ACCEPTANCE_CRITERIA.md`: acceptance criteria for MVP gameplay, UI, and technical boundaries.

## Release

- `docs/release/MVP_RELEASE_HARDENING.md`: final automated regression, manual validation, performance review, deferred-feature, and release-candidate risk record.

## Tasks

- `docs/tasks/TASK_019_SAND_CANVAS_AND_CORE_FEEDBACK.md`: Plan the next Battle presentation stage: a formal high-density SandCanvas renderer, one original showcase level, core feedback for exposed sand, absorption, gravity, merge, full bucket exit, Undo redraw, layout rebalance, and performance validation.
- `docs/tasks/TASK022_PROTOTYPE_REFERENCE_TO_MVP_SPEC.md`: Agent-ready spec for continuing from the art/interaction prototype while keeping prototype-only systems out of the current MVP flow.
- `docs/tasks/TASK024_PROTOTYPE_UI_PRESENTATION_ROADMAP.md`: Convert the v4 art/interaction prototype into an ordered MVP presentation roadmap, including conflicts, feature gates, and the next implementation acceptance criteria.
- `docs/tasks/TASK025_IMPLEMENTATION_ROADMAP.md`: Dependency-ordered task queue for completing the full game from the current MVP presentation foundation.
- `docs/tasks/TASK026_HOME_ACQUIRE_AND_SELECTION_SURFACES.md`: Home resource, acquire entry, and level-selection surface completion.
- `docs/tasks/TASK027_BATTLE_RESULT_AND_TOOL_PRESENTATION_HOOKS.md`: Battle settlement and feature-gated tool presentation hooks.
- `docs/tasks/TASK028_COLLECTION_CONTRACT_AND_CERTIFICATE_POLISH.md`: Collection chapter, artwork list, and certificate contract polish.
- `docs/tasks/TASK029_SETTINGS_AND_MOCK_REWARD_FLOWS.md`: Settings popup and mock reward flow completion.
- `docs/tasks/TASK030_BATTLE_THEME_ASSET_BINDINGS.md`: Battle theme asset binding and fallback presentation layer.
- `docs/tasks/TASK031_BATTLE_TOOL_RULE_SPEC_AND_STATE_MACHINE.md`: Battle tool rule specification and state-machine implementation.
- `docs/tasks/TASK032_REWARDED_AD_AND_EXTRA_SLOT_FEATURE_GATES.md`: Rewarded revive and extra-slot feature gates.
- `docs/tasks/TASK033_SHOP_AND_GAME_CIRCLE_PLACEHOLDERS.md`: Safe Shop and Game Circle placeholder surfaces.
- `docs/tasks/TASK034_SCENE_WIRING_AND_MANUAL_COCOS_VALIDATION.md`: Scene wiring and manual Cocos validation plan.
- `docs/tasks/TASK035_PERFORMANCE_AND_RELEASE_HARDENING.md`: Final performance, regression, and release-readiness hardening.
- `docs/tasks/TASK_018_BATTLE_PRESENTATION_COMPLETION.md`: Complete the baseline Battle presentation for MVP acceptance, including SandGrid visuals, result panel, top bar/buttons, bucket/conveyor finishing, feedback, and performance/manual validation, without level expansion or multi-resolution adaptation.
- `docs/tasks/TASK_017_BATTLE_READABILITY_AND_INTERACTION_POLISH.md`: First Playable battle readability, Sand Workshop art integration, interaction feedback, accessibility, portrait adaptation, and Cocos validation planning.
- `docs/tasks/TASK_016_FIRST_PLAYABLE_HARDENING.md`: First Playable stability, deterministic replay, lifecycle, Cocos validation, and performance-baseline hardening.

## Known Source Issues

- The raw spec contains both V0.4 and V0.5 content, causing repeated coverage of UI layout, MVP scope, page flow, resources, and scene structure.
- The final project direction is portrait only.
- Non-MVP systems from the source spec, including shop, sign-in, leaderboard, daily challenge, formal ad SDK, and social systems, are not part of the first MVP.
