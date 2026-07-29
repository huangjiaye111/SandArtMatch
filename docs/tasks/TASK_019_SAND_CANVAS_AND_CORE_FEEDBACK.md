# TASK 019: Sand Canvas And Core Feedback

## Goal

Bring the Battle screen from a completed technical presentation baseline to a showcase-ready sand-art elimination slice.

This task focuses on one original, high-density sand canvas and the complete visual feedback around the existing core loop. It must not copy any existing game screenshot, character, UI layout, asset, or concrete interface. The intended result is an original SandArtMatch Battle screen that clearly reads as a colorful sand-art puzzle rather than a debug grid.

This task is planning for the next implementation stage. Do not implement code, scene changes, or assets while creating this document.

## Current Audit

Confirmed current implementation shape:

- `assets/scripts/domain/config/TestLevels.ts` still uses a single built-in 4 x 4 test level.
- `SandGridView` hides debug labels at runtime, but renders one `Node` plus one `Graphics` component per logical cell.
- The current 4 x 4 grid cannot form a meaningful sand-art subject and leaves too much low-information space.
- `SandGridView` renders final snapshots, but it has no formal API for exposed-cell highlight, absorption trails, gravity interpolation, or Undo redraw intent.
- `BattleStateMachine` already emits read-only stage events for bucket enqueue, merge, exposed sand, absorption schedule, gravity result, bucket completion, and result check.
- `BattlePresenter` currently maps only bucket click, bucket entry, merge, full bucket exit, Undo restored, victory, deadlock, and invalid click into `BattlePresentationEvent`.
- `exposedSandResolved`, `absorbResolved`, and `sandGravityResolved` data are available from the domain result but are not yet consumed by presentation feedback.
- Current gravity result exposes aggregate counts and the settled grid snapshot, but not per-cell movement paths.
- `BattleRoot` routes all player actions through `BattlePresenter` and `BattleStateMachine`; keep this route.

Planning judgment:

- TASK019 should add or extend read-only presentation events if animation needs them.
- Do not move absorption, exposure, gravity, merge, deadlock, or Undo rules into Cocos views.
- If smooth gravity needs per-cell paths, prefer adding deterministic domain settlement trace data or a presentation-only diff derived from before/after snapshots, without changing rule order.
- Undo should immediately redraw the restored snapshot and cancel active feedback; it should not attempt to reverse previous animations.

## Prerequisites

Read before implementation:

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/INDEX.md`
- `docs/planning/MVP_ROADMAP.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/ui/BATTLE_LAYOUT.md`
- `docs/ui/UI_SPEC.md`
- `docs/art/ART_DECISIONS.md`
- `docs/art/ART_DIRECTION.md`
- `docs/art/COLOR_PALETTE.md`
- `docs/art/UI_STYLE_GUIDE.md`
- `docs/tasks/TASK_018_BATTLE_PRESENTATION_COMPLETION.md`

## Scope

- Implement a formal `SandCanvas` renderer for high-density sand art.
- Remove or fully hide formal-runtime debug text/grid presentation.
- Replace the 4 x 4 built-in showcase battle with one original high-density display level.
- Start performance validation at 24 x 32 or a close size, then adjust only if the measured result requires it.
- Make colored regions form a clear, original sand-art subject.
- Make empty cells, background, and every used `colorId` visually distinguishable.
- Expose and animate exposed sand-cell highlight.
- Animate absorption movement from sand canvas toward the absorbing bucket.
- Animate deterministic gravity settlement feedback after absorption.
- Animate three-bucket merge feedback.
- Animate full bucket completion and leaving feedback.
- Ensure Undo immediately restores the correct visual state.
- Rebalance SandCanvas, Conveyor, and BucketPool proportions for a showcase portrait battle.
- Remove large black or undesigned runtime regions.
- Convert bucket state from debug labels to formal visual state.

## Explicitly Out Of Scope

- Do not expand to multiple levels.
- Do not implement level select, save, unlock, progression, shop, ads, leaderboard, sign-in, daily challenge, or social systems.
- Do not copy Sand Art Match, Sand Blast, or any other existing game surface one-to-one.
- Do not use screenshots, characters, concrete UI assets, or traced layouts from existing products.
- Do not perform a large rewrite of the gameplay domain architecture.
- Do not change core settlement order.
- Do not add production dependencies without approval.
- Do not implement complex physics particles or high-cost shaders.
- Do not hand-edit `.scene` or `.prefab` serialized files without Cocos/Funplay inspection and a narrow editor-safe plan.

## Suggested Files

Likely Cocos presentation files:

- `assets/scripts/cocos/battle/SandGridView.ts`, either renamed later by Cocos-safe migration or reduced to a wrapper around the formal renderer.
- Optional new component: `assets/scripts/cocos/battle/SandCanvasView.ts`.
- Optional pure helper: `assets/scripts/cocos/battle/SandCanvasLayout.ts`.
- Optional pure helper: `assets/scripts/cocos/battle/SandCanvasColorMap.ts`.
- Optional new component: `assets/scripts/cocos/battle/SandFeedbackView.ts`.
- `assets/scripts/cocos/battle/BattlePresenter.ts`.
- `assets/scripts/cocos/battle/BattleViewContract.ts`.
- `assets/scripts/cocos/battle/BattleRoot.ts`.
- `assets/scripts/cocos/battle/ConveyorView.ts`.
- `assets/scripts/cocos/battle/BucketPoolView.ts`.
- `assets/scripts/cocos/battle/BucketVisualView.ts`.
- Cocos editor work: `assets/scenes/Battle.scene`.
- Cocos editor work if needed: `assets/prefabs/battle/*.prefab`.

Likely domain/config/test files:

- `assets/scripts/domain/config/TestLevels.ts`.
- Optional pure helper: `assets/scripts/domain/config/ShowcaseLevel.ts`, if separating generated showcase data keeps `TestLevels.ts` readable.
- `tests/domain/LevelLoader.test.ts`.
- `tests/domain/BattlePresenter.test.ts`.
- Optional new pure tests for presentation-event mapping and deterministic level data.

Prefer extending current Battle presentation contracts before creating parallel scene systems.

## Showcase Level Spec

Create exactly one built-in high-density showcase level for this stage.

Recommended first validation target:

- Grid size: 24 x 32, portrait.
- Cell count: 768 logical cells.
- Used sand colors: 5 to 7 colors from the existing sand palette.
- Empty-cell ratio: roughly 8% to 18%, enough to show holes, gravity, and background without making the canvas sparse.
- Subject: one original, simple, readable sand-art image such as a stylized sunburst shell, workshop flower, gem jar, or abstract sand mandala. Avoid any recognizable copied character, mascot, logo, or game screenshot composition.
- Structure: large contiguous colored regions plus smaller accent regions, so absorption visibly changes the picture.
- Gameplay function: bucket queue must allow meaningful absorption, at least one three-bucket merge, at least one full bucket exit, and at least one Undo-restorable intermediate state.
- Conveyor remains default 6 slots.
- Bucket pool remains 2 rows x 4 columns.
- Do not add multiple showcase levels in this task.

Implementation note:

- Keep `SandGrid` as pure two-dimensional data represented through the existing flat `sandMap`.
- If the sand map is hand-authored, keep it deterministic and reviewable.
- If a helper generates the map, it must use deterministic data or seeded randomness, never `Math.random()`, and generated output should be committed as readable level config unless there is a clear test reason not to.

## SandCanvas Renderer Plan

Replace the per-cell-node approach for formal Battle rendering.

Required behavior:

- Render the logical grid as a dense sand-art canvas inside the sand frame.
- Do not create an independent Cocos `Node` for every logical sand cell.
- Use a low-node strategy: one or a small fixed number of `Graphics` components, a generated `Mesh`, a batched texture approach, or an equivalent renderer that keeps node count stable as grid size grows.
- Keep the renderer driven by `SandGridSnapshot`.
- Empty cells must have a deliberate background treatment, not black transparency.
- Sand colors must use the documented palette or a local mapping derived from it.
- Different `colorId` values need either distinct hue/value, subtle texture, edge treatment, or small highlight variation.
- Canvas layout must be deterministic: the same snapshot always maps to the same visual cells and positions.
- Do not rebuild all nodes in `update`.
- Rebuild draw geometry only on explicit render or feedback events.
- Keep visual particle effects separate from logical grid cells.

Suggested rendering model:

- One background `Graphics` or sprite for the sand tray and empty cells.
- One batched colored-cell layer that can redraw rectangles, rounded mini-tiles, or compact quads per snapshot.
- One highlight/effect layer for exposed-cell outlines, absorption streaks, gravity traces, and completion flashes.
- Optional pooled transient sprites or graphics strokes for suction flow, capped by a strict count.

## Presentation Events

Current domain events are enough to identify several feedback moments, but the presentation contract does not expose all of them.

Add only read-only presentation data where needed:

- `exposedSandHighlighted`: from `exposedSandResolved.exposedSand`.
- `sandAbsorbed`: from `absorbResolved.schedule.allocations`.
- `sandGravitySettled`: from `sandGravityResolved.result` and final grid snapshot.
- Optional `sandCanvasRedrawn`: presentation-only marker for immediate redraw after Undo or full resync.

Rules:

- Events may contain coordinates, color ids, bucket ids, slot indexes, counts, final snapshots, and before/after visual hints.
- Events must not grant views permission to decide what sand is exposed, absorbed, moved, merged, completed, won, or failed.
- If per-cell gravity movement is required, first decide whether to add a pure, deterministic gravity trace to the domain result or to approximate presentation motion from before/after snapshots. Document the chosen path in code comments/tests during implementation.
- Animation consumes the already-resolved result. It must not affect the next `BattleStateMachine` snapshot.

## Feedback Sequence

On accepted bucket tap:

1. Bucket click feedback, 80 to 140 ms.
2. Bucket enters the conveyor slot, 160 to 240 ms.
3. If three matching buckets merge, pulse participants and resolve into the inserted merged bucket, 300 to 500 ms.
4. Highlight exposed same-color sand for absorbing conveyor buckets, 120 to 220 ms.
5. Play short suction trails from a capped subset of absorbed sand cells toward the destination bucket, 240 to 420 ms.
6. Redraw the canvas to the post-absorption snapshot.
7. Play gravity fall feedback from the pre-gravity visual state toward the settled snapshot, 180 to 420 ms depending on move count.
8. Redraw the canvas to the settled snapshot.
9. If buckets become full, play fill sparkle or rim glow, then move completed buckets off the conveyor, 300 to 500 ms.
10. If the result is terminal, show victory or deadlock panel after the final local feedback.

On rejected input:

- Keep domain snapshot unchanged.
- Play short invalid click feedback on the relevant bucket, conveyor, or toolbar target.

On Undo:

- Cancel active local feedback.
- Hide terminal result UI if visible.
- Immediately redraw SandCanvas, Conveyor, and BucketPool from the restored snapshot.
- Play only a brief non-rule-changing confirmation, such as a canvas shimmer or toolbar pulse.

## Layout And Visual Proportion

Rebalance the baseline 750 x 1334 screen around the sand canvas:

- SandCanvas should become the first-read area and occupy substantially more visual attention than the conveyor or bucket pool.
- Conveyor remains a compact middle interaction/status band with 6 clear slots.
- BucketPool remains 2 x 4 and should read as selectable objects, not a debug inventory table.
- Bottom toolbar should be compact and not compete with the canvas.
- Remove large black, transparent, or undesigned regions by ensuring every viewport area is covered by deliberate background, tray, panel, or safe negative space.
- Bucket labels should be minimized or replaced by formal fill, capacity, full, disabled, selected, and merge-ready visuals.

Suggested baseline proportions:

- Top bar: about 80 to 110 px.
- SandCanvas and frame: about 560 to 650 px.
- Conveyor: about 160 to 190 px.
- BucketPool: about 300 to 340 px.
- Bottom toolbar and safe area: remaining space.

Exact coordinates remain implementation details and must be verified in Cocos.

## Bucket Formal State Plan

Bucket state should no longer look like a debug label surface.

Required states:

- Available in pool.
- Selected or tapped.
- Disabled or non-selectable.
- Empty.
- Partial fill.
- Full.
- Merge-ready.
- Merging.
- Completing/leaving.

Rules:

- Bucket body remains visually neutral.
- Fill height and fill color carry sand state.
- Full state must use a visible non-text marker or rim treatment.
- Disabled state must use opacity/desaturation plus a non-color cue.
- Merge-ready should use short warm highlight or connector feedback, not permanent noisy glow.
- Quantity text may remain only if compact, readable, and subordinate to the bucket art.

## Architecture Constraints

- `SandGrid` remains pure domain two-dimensional data.
- Views must not implement absorption, gravity, merge, win, deadlock, or Undo rules.
- UI components must not directly mutate gameplay state.
- Player actions continue through `BattleStateMachine`.
- Animation only consumes settlement results already determined by `BattleStateMachine`.
- Visual particles and trails are presentation-only and separate from logical grid cells.
- Undo restores from snapshots; it does not reverse domain logic.
- Do not modify the core settlement order: enqueue, merge, exposed sand, absorption, gravity, bucket completion, result check.
- Do not use `Math.random()` in gameplay logic. For deterministic visual variation tied to gameplay state, use seeded or coordinate-derived deterministic values.
- Do not add production dependencies without approval.

## Performance Budget

Targets for validation:

- Steady-state should be close to 60 FPS in Cocos preview and target WeChat validation.
- Steady-state draw calls below 80.
- Heavy feedback moments below 120 draw calls.
- Stable node count should not scale linearly with logical cell count.
- 24 x 32 should run without per-cell nodes.
- No full node rebuild in `update`.
- No complex physics particles.
- No high-cost shader requirement.
- Pool or cap transient visual trails and sparkles.
- Record FPS, draw calls, node count, active node count, labels, sprites, graphics components, texture memory, and console warnings.

Suggested caps for the first implementation:

- Persistent SandCanvas nodes: under 12.
- Transient suction/trail elements: under 48 active at once.
- Exposed highlight draw layer: one batched layer.
- Gravity feedback: aggregate/trace animation capped by move count buckets rather than one Cocos node per moved sand cell.

## Automated Tests

Run existing checks:

- `npm.cmd test`
- `npm.cmd run typecheck`

Expected test coverage:

- Existing domain tests continue to pass.
- `Math.random()` ban continues to pass.
- Level loader accepts the single high-density showcase level.
- Showcase level dimensions, cell count, color ids, and bucket queue are deterministic and valid.
- `BattlePresenter` maps exposed, absorption, gravity, merge, full exit, Undo, invalid input, victory, and deadlock into read-only presentation events.
- Undo redraw path is testable through fake `BattleView` without loading Cocos.
- Presentation event tests must not require loading `Battle.scene`.

## Cocos Manual Acceptance

Use Cocos Creator and Funplay MCP during implementation validation:

- Inspect `Battle.scene` before editing references.
- Confirm no missing `@property`, SpriteFrame, Prefab, or script references.
- Confirm formal runtime hides debug SandGrid text.
- Confirm SandCanvas displays a dense 24 x 32 or similar original picture.
- Confirm empty cells, background, and each used `colorId` are distinguishable.
- Confirm exposed sand highlight is visible and local.
- Confirm absorption motion clearly links source sand to the absorbing bucket.
- Confirm gravity feedback appears after absorption and final canvas matches the settled domain snapshot.
- Confirm three-bucket merge feedback is clear and does not alter rules.
- Confirm full buckets complete and leave the conveyor.
- Confirm Undo immediately restores the correct SandCanvas, Conveyor, BucketPool, result panel, and toolbar state.
- Confirm no large black or undesigned screen region remains.
- Confirm bucket states read as formal UI, not debug labels.
- Record FPS, draw calls, node count, active node count, graphics count, labels, texture memory, and console errors/warnings.
- Capture a final no-profiler 750 x 1334 showcase screenshot.

## Acceptance Criteria

- Battle uses one original high-density showcase level, not the old 4 x 4 debug grid.
- No additional levels, level select, progression, save, shop, ads, leaderboard, sign-in, daily challenge, or social system are introduced.
- SandCanvas renders the full logical grid without one persistent node per sand cell.
- SandCanvas can display a clear colorful sand-art subject.
- Empty cells, background, and all used `colorId` values are easy to tell apart.
- Formal runtime does not show debug text grid UI.
- Exposed sand highlight is visible before absorption.
- Absorption, gravity, merge, full bucket exit, invalid click, victory, deadlock, and Undo feedback are present.
- Feedback timing follows the existing settlement order and never changes domain rules.
- Undo cancels stale feedback and immediately redraws from the restored snapshot.
- Views do not implement gameplay rules or mutate domain state directly.
- Player actions still route through `BattleStateMachine`.
- Core settlement order is unchanged.
- No `Math.random()` is added to gameplay logic.
- Steady-state performance is close to 60 FPS, below 80 draw calls, and heavy feedback is below 120 draw calls, or any miss is recorded with a concrete follow-up.
- Cocos Console has no blocking Battle errors.
- `npm.cmd test` passes.
- `npm.cmd run typecheck` passes.

## Completion Report Requirements

When TASK019 implementation is later completed, report:

- Changed files.
- Showcase level dimensions, color count, empty-cell ratio, and subject.
- Rendering approach and node/draw-call strategy.
- Presentation events added or deliberately not added.
- Animation sequence implemented.
- Performance measurements.
- Automated test commands and results.
- Cocos manual validation results.
- Any unresolved risks or deferred polish.
