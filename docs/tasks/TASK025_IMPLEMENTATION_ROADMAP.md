# TASK025: Implementation Roadmap For Full Game Delivery

## Source

- Derived from `docs/tasks/TASK024_PROTOTYPE_UI_PRESENTATION_ROADMAP.md` and the current repo state.

## Goal

Turn the prototype-driven MVP plan into a concrete, dependency-ordered task queue that can be executed one task at a time until the game is complete.

## Order

1. `TASK026_HOME_ACQUIRE_AND_SELECTION_SURFACES.md`
2. `TASK027_BATTLE_RESULT_AND_TOOL_PRESENTATION_HOOKS.md`
3. `TASK028_COLLECTION_CONTRACT_AND_CERTIFICATE_POLISH.md`
4. `TASK029_SETTINGS_AND_MOCK_REWARD_FLOWS.md`
5. `TASK030_BATTLE_THEME_ASSET_BINDINGS.md`
6. `TASK031_BATTLE_TOOL_RULE_SPEC_AND_STATE_MACHINE.md`
7. `TASK032_REWARDED_AD_AND_EXTRA_SLOT_FEATURE_GATES.md`
8. `TASK033_SHOP_AND_GAME_CIRCLE_PLACEHOLDERS.md`
9. `TASK034_SCENE_WIRING_AND_MANUAL_COCOS_VALIDATION.md`
10. `TASK035_PERFORMANCE_AND_RELEASE_HARDENING.md`

## Rules

- Follow `docs/DECISIONS.md` and `AGENTS.md` before prototype text.
- Keep gameplay-domain logic independent from Cocos Creator.
- Keep post-MVP systems gated until their task explicitly promotes them.
- Do not add production dependencies without approval.
- Do not edit serialized Cocos scene or prefab files until the related script contract and manual editor instructions are ready.

## Success Criteria

- Every follow-up task has a single dependency parent unless it is the first task in a sequence.
- Each task can be completed and verified independently.
- The queue is safe to execute in order without ambiguity about feature priority.

