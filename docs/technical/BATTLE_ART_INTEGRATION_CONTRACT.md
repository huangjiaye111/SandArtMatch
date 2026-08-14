# Battle Art Asset Integration Contract

## Ownership

Artists provide PNG, SpriteFrame source images, sprite sheets, sequence frames, and visual reference notes only.

Programmers own Cocos import settings, SpriteFrame slicing, 9-slice borders, prefab and scene binding, layout, state switching, Tween timing, particle playback, pooling, performance validation, TypeScript, and tests.

## Current Battle Hierarchy

Runtime scene root:

- `Battle`
- `Canvas`
- `SafeArea`
- `DesignContent`
- `TopBar`
- `ResultPanel`
- `SandArea`
- `ConveyorArea`
- `BucketPoolArea`

Runtime-created nodes:

- `SandViewport`
- `SandBackground`
- `SandLayer`
- `GravityOverlay`
- `FeedbackLayer`
- `SandAbsorbEffectRoot`
- `PooledSandParticle*`
- `BucketMotionRoot`
- `BucketFly_*`
- Bucket visual child nodes created by `BucketVisualView` when missing.

## Component Contracts

`BattleRoot`

- Owns the state machine, presenter, feedback queues, revision tokens, cancellation, restart, and lifecycle cleanup.
- May create effect and motion roots.
- Must not contain gameplay rules.

`BattlePresenter`

- Converts domain `BattleStageEvent` values into read-only `BattlePresentationEvent` DTOs.
- Owns no visual styling and no Cocos nodes.
- Calls restart through `BattleStateMachine.restart()` and redraws from snapshots.

`SandGridView`

- Consumes `SandGridSnapshot`, exposure events, absorption batches, and gravity motion plans.
- Renders the static canvas through texture upload.
- Renders absorption clears and gravity settlement through the main SandLayer dynamic texture, backed by reusable pixel and presentation-grid buffers.
- Does not compute exposure, absorption, gravity, victory, or deadlock.

`ConveyorView`

- Consumes conveyor snapshots, bucket snapshots, bucket-entry events, merge events, full-bucket exit events, and presentation amount overrides.
- Owns bucket flight, merge placeholder feedback, full-bucket exit placeholder feedback, and active-flight cancellation.
- Does not decide merge or completion.

`BucketPoolView`

- Consumes bucket snapshots and selection availability from domain state.
- Owns candidate-bucket layout, click binding, in-flight hiding, and visual calibration.
- Does not mutate gameplay state.

`BucketVisualView`

- Owns visual mapping from `BucketState` to body, fill, target color, full marker, disabled marker, and merge-ready marker.
- Must accept replacement SpriteFrames without changing domain code.

`ToolbarView`

- Owns level text, settings entry binding, and result panel display.
- `SettingsButton` is the top-bar settings entry; `ResultPanel/RestartButton` is the result-panel restart entry.

`ResultPanelView`

- Currently represented by `ToolbarView.resultRoot` and children `ResultIcon`, `VictoryIcon`, `DeadlockIcon`, and `ResultLabel`.
- Victory and Deadlock are triggered only after state machine outcome events and final snapshot calibration.

## Asset Naming And Directories

Recommended source asset directories:

- `assets/art/battle/sand/`
- `assets/art/battle/buckets/`
- `assets/art/battle/conveyor/`
- `assets/art/battle/ui/`
- `assets/art/battle/effects/`

Recommended names:

- `sand_color_<id>.png`
- `bucket_body_default.png`
- `bucket_fill_mask.png`
- `bucket_full_badge.png`
- `conveyor_slot.png`
- `conveyor_base.png`
- `result_panel_bg.png`
- `result_icon_victory.png`
- `result_icon_deadlock.png`
- `particle_sand_<id>.png`

## Sprite Settings

- Simple icons: Sprite Type `Simple`, Size Mode `Custom`.
- Scalable panels and buttons: Sprite Type `Sliced`, Size Mode `Custom`.
- Bucket body and conveyor slot frames should support 9-slice if they need non-uniform scaling.
- Pixel-art or sand texture assets should use nearest filtering only when the intended style requires it; otherwise use the project default import filter after performance review.
- Sequence frames must keep stable pivot and dimensions across all frames.

## Code-Controlled Layout

Program code controls:

- `DesignContent` child positions.
- Sand viewport size and mask.
- Sand texture size and cell mapping.
- Conveyor slot positions.
- Bucket pool grid and scroll range.
- Bucket flight source and target positions.
- Effect roots, particle positions, and SandCanvas texture positions.
- Result panel active state.

Artists should not move these nodes directly in serialized scenes without a programmer applying and validating the change.

## Artist-Editable Nodes

After programmer setup, artists may request replacement assets for:

- Background sprites.
- Top bar background.
- Button background and icon sprites.
- Sand frame sprite.
- Conveyor base and slot sprites.
- Bucket body, fill surface, badge, and rim sprites.
- Result panel background and icons.
- Particle texture frames.

Programmers perform the actual import, SpriteFrame configuration, binding, and validation.

## Theme Asset Binding Contract

Battle theme replacement assets are described by `BattleThemePresentationModel.assetBindings`.

- `background`: optional SpriteFrame key from `ThemeConfig.battleBackgroundKey`; runtime falls back to `placeholderBackgroundColor`.
- `frame`: optional SpriteFrame key from `ThemeConfig.battleFrameKey`; runtime falls back to `placeholderFrameColor`.
- `decoration`: optional SpriteFrame key from `ThemeConfig.battleDecorationKey`; runtime falls back to `placeholderFrameColor`.

All three bindings are non-blocking. If a SpriteFrame is missing or not wired yet, Battle must still start and render the runtime fallback workshop backdrop. Manual Cocos validation for this step: open each catalog level, confirm the theme id logged by `BattleRoot`, confirm no missing SpriteFrame blocks startup, and confirm the sand artwork remains runtime-rendered inside the sand area rather than baked into theme art.

## Protected References

Do not manually break or rename without programmer migration:

- `BattleRoot.sandGridView`
- `BattleRoot.conveyorView`
- `BattleRoot.bucketPoolView`
- `BattleRoot.toolbarView`
- `SandGridView.titleLabel`
- `SandGridView.detailLabel`
- `ConveyorView.slotLabels`
- `BucketPoolView`
- `ToolbarView.levelLabel`
- `ToolbarView.settingsButton`
- `ToolbarView.resultRoot`
- `ToolbarView.resultLabel`
- `ToolbarView` runtime `ResultPanel/RestartButton`

## Animation Events

Presentation events:

- `bucketClicked`
- `bucketEnteredConveyor`
- `exposedSandHighlighted`
- `sandAbsorbed`
- `sandGravitySettled`
- `merge`
- `fullBucketLeft`
- `sandCanvasRedrawn`
- `invalidClick`
- `victory`
- `deadlock`

All animation timing is centralized in `BattlePresentationConfig.ts`.

## Suggested Asset Sizes

- Bucket body: 128 x 144 or larger source.
- Bucket fill surface: 96 x 96 tileable or mask-friendly source.
- Conveyor slot: 128 x 104.
- Conveyor base: 720 x 160 or 9-sliced panel.
- Result panel: 560 x 360 or 9-sliced panel.
- Result icons: 128 x 128.
- Sand particle: 8 x 8 to 16 x 16.
- Sand frame: 640 x 640 or 9-sliced frame.

## Object Pool And Performance Limits

- No Cocos node per sand cell.
- No Cocos node per gravity move.
- Sand absorption particles use a capped pool from `BattlePresentationConfig.absorptionParticlePoolCapacity`.
- Gravity overlay uses one dynamic texture and one reusable pixel buffer.
- Normal gravity run count target: under 256.
- Gravity hard run cap: 512.
- Stable Draw Calls target: under 80.
- Feedback peak Draw Calls target: under 120.
- Texture memory must be checked after replacing assets.

## Replacement Checklist

After asset replacement, programmers must verify:

- Scene opens without missing script or SpriteFrame warnings.
- Sprite Type and Size Mode match this contract.
- 9-slice borders scale cleanly.
- Bucket pool clicks still route through `BattleStateMachine`.
- Bucket fly-in completes and calibrates to conveyor snapshot.
- Absorption batches clear source cells and update bucket presentation amount.
- Gravity overlay falls, clears, and final snapshot matches domain state.
- Merge event animates only event participant buckets.
- Full-bucket exit event animates only completed bucket slots.
- Victory and Deadlock appear only after final calibration.
- Restart cancels active Tweens, schedules, particles, and overlay.
- Re-entering Battle does not duplicate listeners or pooled nodes.
- FPS, Draw Calls, node count, and texture memory stay within budget.
