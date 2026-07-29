# TASK 018: Battle Presentation Completion

## Goal

Bring the current Battle scene from a functional verification UI to a stable, playable, MVP-acceptance-ready battle presentation.

This task completes the visible Battle layer only. It must not expand level content, change core gameplay rules, rewrite `BattleStateMachine`, or introduce non-MVP systems.

## Current Gap

TASK017 imported the first Sand Workshop battle assets and connected a basic scene hierarchy, but the battle presentation is still not complete enough for stable display or MVP acceptance.

Confirmed current state:

- Current branch before planning: `dev`.
- Worktree before planning: clean.
- Latest TASK017 implementation commit: `195d731 polish battle readability and interaction`.
- `Battle.scene` contains `FullScreenBackground`, `TopBar`, `SandArea`, `ConveyorArea`, `BucketPoolArea`, and inactive `ResultPanel`.
- `BattleRoot` references `SandGridView`, `ConveyorView`, `BucketPoolView`, and `ToolbarView`.
- Funplay MCP hierarchy confirms `Battle` scene is open and core Battle nodes exist.
- Funplay MCP performance snapshot baseline: 225 nodes, 190 active nodes, 358 components, 55 sprites, 36 labels, 10 buttons, 14 masks, 14 graphics, no MCP warnings.
- TASK017 editor screenshot shows imported visuals are visible, but labels and art overlap in the central battle area.
- TASK017 runtime/core screenshot at 750 x 1334 is effectively black and not suitable as a final showcase capture.

Main presentation gaps:

- `SandGridView` still renders debug text through `Label` nodes instead of visible sand cells.
- The sand area does not yet show empty cells, distinct `colorId` cells, absorption disappearance, gravity movement, or Undo restoration visually.
- Conveyor and bucket pool still include debug-style title and quantity labels that overlap with art.
- Bucket states are partially represented, but Empty, Partial, Full, Disabled, Selected, invalid, and merge-ready states are not yet cleanly separated.
- Result panel has basic inactive/active wiring, but final Victory and Deadlock content, text, icon state, hiding rules, and re-entry/reset behavior are not acceptance-ready.
- TopBar buttons exist, but icon/text separation, Normal/Pressed/Disabled feedback, click hit area, and Settings behavior need presentation completion.
- Background and panel assets exist, but runtime display must be verified so no large undesigned black region remains.
- Visual feedback is still minimal and does not yet cover all required MVP presentation moments.

## Prerequisites

- `docs/tasks/TASK_015_FIRST_PLAYABLE.md`
- `docs/tasks/TASK_016_FIRST_PLAYABLE_HARDENING.md`
- `docs/tasks/TASK_017_BATTLE_READABILITY_AND_INTERACTION_POLISH.md`

Before implementation, read and compare against:

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/INDEX.md`
- `docs/planning/MVP_ROADMAP.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/ui/BATTLE_LAYOUT.md`
- all formal specs under `docs/art/`

## Scope

- Complete the 750 x 1334 baseline Battle presentation.
- Replace or hide debug text that is not part of the final battle UI.
- Implement a real SandGrid presentation driven by domain snapshots.
- Finish background, top bar, sand frame, conveyor, bucket pool, bucket, button, feedback, and result panel presentation.
- Keep all player actions routed through `BattleStateMachine`.
- Keep gameplay-domain logic independent from Cocos.
- Add or update tests only where presentation state mapping can be tested without loading a Cocos scene.
- Use Cocos Creator/editor-safe operations for scene or prefab changes.
- Use Funplay MCP read-only checks before and after scene/prefab work.

## Explicitly Out Of Scope

- No level-count expansion.
- No level select.
- No save, unlock, or progression systems.
- No shop, ads, sign-in, leaderboard, daily challenge, or social systems.
- No core gameplay rule changes.
- No `BattleStateMachine` rewrite.
- No direct hand editing of `.scene` or `.prefab` serialized files.
- No large-scale art remake.
- No complex particles or shaders.
- No production dependency additions without approval.
- No multi-resolution adaptation work in this task.

## Suggested Files

- `assets/scripts/cocos/battle/SandGridView.ts`
- `assets/scripts/cocos/battle/BattleRoot.ts`
- `assets/scripts/cocos/battle/BattlePresenter.ts`
- `assets/scripts/cocos/battle/BattleViewContract.ts`
- `assets/scripts/cocos/battle/BucketVisualView.ts`
- `assets/scripts/cocos/battle/BucketPoolView.ts`
- `assets/scripts/cocos/battle/ConveyorView.ts`
- `assets/scripts/cocos/battle/ToolbarView.ts`
- optional new Cocos presentation component: `assets/scripts/cocos/battle/ResultPanelView.ts`
- optional new Cocos presentation component: `assets/scripts/cocos/battle/InteractionFeedbackView.ts`
- Cocos editor changes: `assets/scenes/Battle.scene`
- Cocos editor changes if needed: `assets/prefabs/battle/*.prefab`
- existing battle art under `assets/art/battle/**` and `assets/art/ui/**`
- tests for pure presentation mapping, if existing test structure supports it without loading Cocos scenes

Prefer extending existing Battle components before introducing parallel component systems.

## SandGrid Presentation Plan

- Remove or hide the current debug text grid from normal play.
- Render each domain grid cell as a stable visual cell under the sand frame.
- Represent empty cells with a clear, low-contrast empty background.
- Represent each non-empty `colorId` with an approved sand color/tint from `docs/art/COLOR_PALETTE.md`.
- Use simple colored cells, light sand blocks, or small reusable sand sprites; complex particles and shaders are not required.
- Keep cell layout deterministic: same snapshot produces same visual positions.
- On absorption, consumed sand cells disappear according to the domain snapshot/action result.
- After gravity, visual positions match the settled domain grid.
- After Undo, grid cells, empty spaces, and colors fully restore from the restored snapshot.
- Do not implement absorption, exposure, gravity, or Undo rules in `SandGridView`.
- Do not use `Math.random()` for visual gameplay state.
- Avoid rebuilding all permanent UI every frame; update changed cells or rebuild only on snapshot render events.

## Background And Panels

- Ensure `battle_bg` fills the battle screen at the baseline resolution.
- Ensure `top_bar` displays behind Level, Undo, and Settings without hiding them.
- Ensure `sand_area_frame` surrounds only the sand artwork/grid area.
- Ensure `bucket_pool_panel` sits under the 4 x 2 bucket pool.
- Keep conveyor, slots, and buckets visually consistent with the Sand Workshop style.
- Remove large black or editor-only-looking areas from runtime Battle.
- Do not bake gameplay text into images.
- Keep decorative assets subordinate to sand and bucket readability.

## ResultPanel State Rules

- `WaitingInput` and other non-terminal playable phases must hide `ResultPanel`.
- Victory must show `result_panel`, `icon_win`, and final victory text.
- Deadlock must show `result_panel`, `icon_deadlock`, and final deadlock text.
- Undo, restart, or starting a new battle must hide `ResultPanel` before normal play resumes.
- `BattlePresenter` remains responsible for mapping domain phase to result-panel state.
- Result panel View code must not duplicate win, lose, or deadlock judgment logic.
- Result feedback should block battle input only while terminal result UI is visible.

## TopBar And Buttons

- Level, Undo, and Settings must be fully visible.
- Undo and Settings must use their imported icon assets.
- Icons and text must be separate nodes or separately controllable visual elements.
- Button Normal, Pressed, and Disabled states must be readable.
- The clickable area must match the visible button area.
- Undo disabled state must match `snapshot.canUndo`.
- Settings may remain a minimal non-domain UI action, but it must not mutate gameplay state.
- Re-entering Battle or rebinding actions must not duplicate click listeners.

## Bucket And Conveyor Completion

- Bucket body remains neutral; sand fill uses `colorId` tint.
- Sand fill must stay inside the bucket mouth/fill area.
- Empty, Partial, Full, Disabled, and Selected states must be visually distinct.
- FULL mark, quantity text, and state icon must not overlap.
- If quantity text remains, it must be compact and readable; prefer icon/shape state where possible.
- Empty conveyor slots must not display bucket visuals.
- Conveyor buckets must not overlap or hide adjacent slots.
- The default conveyor must keep 6 visible slots.
- The bucket pool must remain 4 columns x 2 rows.

## Visual Feedback

Minimum required feedback:

- Bucket click feedback.
- Selected bucket feedback.
- Invalid click feedback.
- Bucket entering conveyor feedback.
- Merge feedback.
- Full bucket leaving feedback.
- Victory result panel appearance feedback.
- Deadlock result panel appearance feedback.

Feedback should be short and local. Do not introduce complex tween chains, large particle bursts, or a formal audio system.

## Multi-Resolution Plan

Multi-resolution adaptation is explicitly not part of TASK018 after scope adjustment.

TASK018 must preserve the existing portrait baseline and avoid knowingly breaking Boot or Home, but it does not need to validate 390 x 844, 375 x 667, 414 x 896, or device-specific layout behavior. A later task can reopen adaptation once the baseline Battle presentation is stable.

## Performance Budget

- Steady-state FPS should be close to 60 in Cocos preview or the target validation environment.
- Steady-state draw calls should stay below 80.
- Heavy feedback moments should stay below 120 draw calls.
- Avoid unnecessary masks, duplicated sprites, and invisible nodes that continue rendering.
- Do not use complex shaders.
- Do not rebuild the full UI in `update`.
- Keep feedback nodes pooled, reused, or short-lived with cleanup.
- Record node count, active node count, labels, sprites, masks, draw calls, FPS, and texture memory during manual validation.

## Automated Tests

Run existing automated checks:

- `npm.cmd test`
- `npm.cmd run typecheck`

Expected test coverage:

- Existing domain tests continue to pass.
- Existing `Math.random()` ban continues to pass.
- Existing deterministic replay, Undo, deadlock, input lock, and recovery tests remain valid.
- Add or update pure presentation-mapping tests if possible without loading Cocos scenes.
- Result panel state mapping should be testable through Presenter/View contract fakes.
- Undo button enabled/disabled mapping should remain testable without Cocos scene loading.
- Invalid click/input lock feedback must not mutate gameplay snapshots.

Do not add tests that require loading `Battle.scene` in Node-based domain tests.

## Cocos Manual Acceptance

Use Cocos Creator and Funplay MCP to validate:

- Open `Battle.scene`; confirm no missing `@property`, SpriteFrame, or Prefab references.
- Confirm `battle_bg`, `top_bar`, `sand_area_frame`, `bucket_pool_panel`, conveyor art, bucket art, result panel, and icons render in the scene.
- Play from Battle scene to Victory once.
- Trigger Deadlock once.
- Perform Undo and continue playing.
- Verify absorption, gravity, merge, full bucket exit, and Undo visuals match domain state.
- Verify WaitingInput hides the result panel.
- Verify Victory shows win panel/icon/text.
- Verify Deadlock shows deadlock panel/icon/text.
- Verify result panel hides after Undo, restart, or new battle.
- Verify click feedback, selected feedback, invalid feedback, bucket enter, merge, full exit, and result appearance feedback.
- Verify no large black undesigned runtime region remains at 750 x 1334.
- Record FPS, draw calls, node count, active node count, texture memory, and console errors/warnings.
- Generate a final no-profiler showcase screenshot.

## Acceptance Criteria

- Battle scene remains playable from start to Victory or Deadlock.
- All player actions still route through `BattleStateMachine`.
- Core rules for absorption, gravity, merge, full bucket exit, win, deadlock, and Undo are unchanged.
- Debug SandGrid text is removed or hidden during normal play.
- SandGrid displays actual visible cells for empty spaces and different `colorId` values.
- SandGrid visuals stay consistent after absorption, gravity, merge settlement, full bucket exit, and Undo.
- Background, top bar, sand frame, bucket pool panel, conveyor, slots, buckets, buttons, and result panel form one coherent Sand Workshop battle screen.
- ResultPanel obeys Presenter-driven terminal-state visibility rules.
- Undo and Settings buttons are readable, clickable, and do not duplicate listeners.
- Bucket and conveyor states are readable and do not overlap.
- Minimum visual feedback set is implemented.
- Performance budget is recorded and not obviously exceeded.
- Cocos Console has no blocking Battle-related errors.
- Scene and Prefab references are intact.
- `npm.cmd test` passes.
- `npm.cmd run typecheck` passes.

## Forbidden

- Do not expand levels.
- Do not add level select.
- Do not add save, unlock, shop, ads, sign-in, leaderboard, daily challenge, or social systems.
- Do not change core gameplay rules.
- Do not rewrite `BattleStateMachine`.
- Do not route UI actions around `BattleStateMachine`.
- Do not implement gravity, absorption, merge, win, or deadlock logic inside Views.
- Do not use `Math.random()` in gameplay logic.
- Do not directly hand edit `.scene` or `.prefab` serialized content.
- Do not regenerate scenes or prefabs blindly.
- Do not delete or regenerate `.meta` files.
- Do not add production dependencies without approval.
- Do not introduce complex particles or shaders.
- Do not hide correctness issues with logs or purely cosmetic workarounds.

## Milestone Judgment After Completion

After TASK018, the First Playable Battle should be considered ready for MVP presentation acceptance if:

- the full Battle loop is visually playable at the 750 x 1334 baseline;
- SandGrid, buckets, conveyor, buttons, feedback, and results all reflect domain state clearly;
- the final no-profiler showcase screenshot is representative and free of debug UI;
- automated tests and TypeScript checks pass;
- Cocos manual acceptance records no blocking scene, reference, runtime, or performance issue.

If these conditions are met, the project can move from "readability polish" to "MVP battle presentation complete" and prepare for a separate acceptance or packaging task. Multi-resolution adaptation should remain a later task unless explicitly reprioritized.
