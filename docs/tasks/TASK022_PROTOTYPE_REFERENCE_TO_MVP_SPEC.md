# TASK022: Prototype Reference To MVP Development Spec

## Problem Statement

The project has a richer art and interaction prototype than the current MVP should ship. The team needs a clear, agent-ready specification for continuing SandArtMatch development from the prototype reference without accidentally promoting post-MVP systems into the formal product flow or blocking code progress while final art assets are still pending.

The immediate risk is vocabulary drift: prototype pages mention stamina, ads, collection, shop, game-circle, multi-theme content, and Next Level, while the current formal catalog only contains `level-001` and the frozen MVP excludes formal ad SDK, shop, leaderboard, daily challenge, sign-in, and social systems.

## Solution

Continue development around an asset-ready MVP runtime:

- Keep the formal product flow as `Boot -> Home -> Battle -> Victory/Deadlock`.
- Treat the provided art and interaction deck as a prototype reference, not as a rule override.
- Preserve the current formal catalog with only `level-001` and no Next action while `nextLevelId` is `null`.
- Let Home own embedded level selection and highlight the selected formal level before Play starts Battle.
- Keep post-MVP systems represented only as future planning language and replacement points.
- Prepare runtime presentation components so final art assets can replace current placeholders without changing gameplay-domain rules.

## User Stories

1. As a player, I want the game to start at Home, so that I understand I am entering the formal game experience.
2. As a player, I want Home to show the current formal level, so that I know what Battle will start.
3. As a player, I want changing the selected level on Home to only update the selection, so that I do not enter Battle by accident.
4. As a player, I want Play to be the only Home action that starts Battle, so that the main action is predictable.
5. As a player, I want `level-001` to always be unlocked, so that a new or reset save can always start the game.
6. As a returning player, I want Home to restore my saved selection when it is still valid and unlocked, so that I can continue from the level I chose.
7. As a returning player, I want Home to recover safely from invalid legacy saved level IDs, so that old or corrupted progress does not block play.
8. As a returning player, I want Home to fall back to the highest unlocked level when my saved selection is invalid, so that the game highlights the furthest available formal level.
9. As a player, I want completed levels to remain recognizable on Home, so that progress feels persistent.
10. As a player, I want locked levels to be visually distinct once the catalog expands, so that I do not confuse unavailable content with playable content.
11. As a player, I want Battle to load the selected formal level, so that Home and Battle agree about what I chose.
12. As a player, I want Victory to offer Replay and Home when there is no next formal level, so that I do not see a dead-end Next button.
13. As a player, I want Deadlock to offer Replay and Home, so that I can recover without relying on post-MVP revive systems.
14. As a player, I want Replay to restart the current formal level, so that I can try again without losing the selected level.
15. As a player, I want Home to use friendly art placeholders now and final art later, so that the product can continue improving while assets are produced.
16. As a designer, I want prototype reference features separated from formal MVP behavior, so that future art work can be scoped cleanly.
17. As a designer, I want Theme to mean a visual skin only, so that backgrounds, frames, and decorations do not imply gameplay rule changes.
18. As a designer, I want future stamina, ads, collection, shop, and game-circle content documented as post-MVP systems, so that they are not mistaken for current runtime requirements.
19. As an artist, I want clear asset replacement points for Home and Battle UI, so that final images can be dropped in without changing gameplay logic.
20. As an artist, I want bucket color and state language to remain stable, so that final bucket assets can support Empty, Partial, Full, Disabled, and Selected states.
21. As an artist, I want Battle themes to preserve carrier and bucket-pool structure, so that theme art does not alter playability.
22. As a developer, I want the Level Catalog to remain the source of formal levels, so that Home does not hard-code a parallel level list.
23. As a developer, I want Progress Store normalization to ignore unknown legacy level IDs, so that save migration remains safe.
24. As a developer, I want Game Session to carry the selected formal level into Battle, so that scene loading does not depend on global test-level defaults.
25. As a developer, I want Game Navigator to own scene transitions, so that buttons do not call scene loading directly.
26. As a developer, I want UI components to read state and call domain-facing actions, so that presentation code does not mutate gameplay state.
27. As a developer, I want Battle player actions to continue through BattleStateMachine, so that absorption, gravity, merge, exit, victory, and deadlock rules stay centralized.
28. As a developer, I want gameplay randomness to remain deterministic, so that tests and replay behavior stay reproducible.
29. As a QA tester, I want a scene list without LevelSelect, so that the formal runtime flow matches TASK021.
30. As a QA tester, I want automated tests for Home selection fallback, so that catalog expansion does not regress default selection behavior.
31. As a QA tester, I want automated tests for Victory without Next, so that a single-level catalog does not show unavailable navigation.
32. As a QA tester, I want manual Cocos validation for Boot, Home, and Battle, so that serialized scene wiring and runtime art loading are verified outside Node tests.

## Implementation Decisions

- Use the domain glossary terms in `CONTEXT.md` for all follow-up tasks and handoffs.
- Treat the provided deck as a Prototype Reference. It can inform interaction intent and asset replacement points, but it does not override `docs/DECISIONS.md`.
- Keep the Formal Product Flow limited to Boot, Home, Battle, Victory, and Deadlock for the current MVP.
- Keep `level-001` as the only Formal Level in the current Level Catalog.
- Keep `level-001.nextLevelId` as `null`.
- Remove LevelSelect from the formal runtime flow. No independent LevelSelect scene should be introduced for this spec.
- Home should render Embedded Level Selection from the Level Catalog.
- Home default selection order is Saved Selection, then Highest Unlocked Level, then the first catalog entry.
- Recommended Level is progress guidance only and is not the same concept as Home's fallback selected level.
- Selecting a Home level updates selection only. Play starts Battle.
- Progress loading and selection helpers should safely ignore unknown legacy level IDs.
- Game Navigator remains the single navigation entry for Home, Battle, Replay, and future Next behavior.
- Game Session remains the bridge carrying the selected Formal Level into Battle.
- Victory and Deadlock expose Replay and Home in the current catalog.
- Next may exist as an extensibility hook, but must not be visible or actionable while the current Formal Level has no next level.
- Post-MVP Systems from the prototype reference should stay out of the runtime flow until explicitly promoted by a later task.
- Theme is a visual skin for backgrounds, frames, and decorations only; it must not change carrier capacity, bucket-pool shape, or gameplay rules.
- Final art assets should replace current runtime SpriteFrame resources through presentation-layer asset bindings or resource paths.
- Gameplay-domain logic remains pure TypeScript and independent from Cocos Creator.
- UI components must not directly mutate battle state.
- Player actions continue to route through BattleStateMachine.
- Gameplay code must not call `Math.random()`.

## Testing Decisions

- Test the highest stable seam for formal flow and progress behavior: Game Navigator plus Progress Store for navigation and save semantics.
- Test Home selection semantics through the pure progress model rather than Cocos nodes.
- Test unknown legacy IDs through Progress Store normalization and direct selection helpers where reasonable.
- Test Victory and missing Next behavior through Game Navigator.
- Test Battle action routing and presentation events through existing Battle Presenter tests with fake views.
- Keep Cocos scene rendering, SpriteFrame wiring, and button hit area checks as manual Cocos/Funplay validation because Node tests cannot load scenes.
- Continue using the existing Math.random ban test as the deterministic-gameplay guard.
- Continue using TypeScript checks and `git diff --check` as completion gates.
- A good automated test should assert player-visible or domain-visible behavior, not private implementation structure.
- Existing prior art includes ProgressStore tests for normalization and completion, GameNavigator tests for scene transitions and missing Next, BattlePresenter tests for action routing, and presentation visual model tests for UI-safe mapping.

## Out of Scope

- No shop implementation.
- No sign-in implementation.
- No leaderboard implementation.
- No daily challenge implementation.
- No formal ad SDK implementation.
- No game-circle or social implementation.
- No stamina or currency economy implementation.
- No collection system implementation.
- No multi-level catalog expansion beyond `level-001`.
- No revive flow.
- No ad-unlocked extra carrier slot.
- No new Battle gameplay rules.
- No change to conveyor default capacity.
- No change to bucket-pool layout.
- No scene or prefab regeneration without Cocos/Funplay inspection.
- No production dependency additions without approval.

## Further Notes

- Intended triage label: `ready-for-agent`.
- The project currently has no discoverable issue tracker configuration or remote repository, so this spec is published locally as a task document first.
- Final art assets are expected later. Current development should keep asset replacement points clean and avoid baking prototype-only features into code.
- Cocos/Funplay validation remains required before considering this spec complete in the editor runtime.
