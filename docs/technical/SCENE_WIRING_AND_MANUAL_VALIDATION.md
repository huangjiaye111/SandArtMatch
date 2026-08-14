# Scene Wiring And Manual Validation

## TASK034 Scope

Current runtime scenes are `Boot.scene`, `Home.scene`, and `Battle.scene`. Collection, Settings, and Shop are runtime surfaces or placeholder states owned by scripts; they are not separate scenes in the current MVP flow.

No serialized scene or prefab file should be edited for this task unless the editor scene is opened and the affected component references are inspected first.

## Scene Contracts

### Boot

- Scene: `assets/scenes/Boot.scene`.
- Required component: `BootRoot`.
- Expected flow: loads the runtime navigator, then enters Home.
- Manual check: launch from Boot and confirm Home loads without missing script warnings.

### Home

- Scene: `assets/scenes/Home.scene`.
- Required component: `HomeRoot`.
- Runtime-created surface: Home title, top resource labels, settings button, level cards, play button, collection button, and shop placeholder entry.
- Typed data owner: `HomeData`.
- Placeholder contract: `HomeViewData.placeholderEntries` must include a disabled `shop` entry with a clear message. This entry must not change `canPlay`.
- Manual check: click Play from the unlocked level and confirm Battle loads. Then return to Home and click Shop; it should show placeholder feedback and must not block Play.

### Battle

- Scene: `assets/scenes/Battle.scene`.
- Required component: `BattleRoot` with references to `SandGridView`, `ConveyorView`, `BucketPoolView`, and `ToolbarView`.
- Runtime-created surfaces: sand canvas, conveyor carriers, bucket pool cells, result panel actions, tool buttons, revive action, and workshop backdrop.
- Typed contracts: `BattleViewContract`, `BattleThemePresentationModel`, `BattleResultPresentationModel`, `BattleToolRules`, and `FeatureFlags`.
- Manual check: start Battle, select a legal bucket, use Hint, use Shuffle, replay from result, and verify no UI control mutates battle state directly.

### Collection

- Current implementation surface: collection data and progression contracts, plus Home collection entry.
- No dedicated `Collection.scene` exists in this task.
- Manual check: after clearing the first level, verify collection progress data updates via the existing progress store path. If an editor scene is added later, bind it to the collection typed contracts before exposing it in navigation.

### Settings

- Current implementation surface: runtime settings toggles on Home and Battle toolbars.
- No dedicated `Settings.scene` exists in this task.
- Manual check: click Settings on Home and Battle. Confirm sound/vibration data toggles without navigating away or blocking battle input after the feedback clears.

## Repeatable Manual Validation

1. Open Cocos Creator with the project and confirm `Boot.scene`, `Home.scene`, and `Battle.scene` open without missing script/component warnings.
2. Set the design resolution to portrait `750 x 1334` and confirm the Canvas content fits the safe area.
3. Start from Boot. Confirm the flow reaches Home.
4. On Home, confirm stamina, coins, level card, Play, Collection, Shop, and Settings controls are visible and tappable.
5. Tap Shop. Confirm placeholder feedback appears and Play remains usable.
6. Tap Play. Confirm Battle loads the selected catalog level.
7. In Battle, confirm sand canvas, conveyor, bucket pool, toolbar, Hint, Shuffle, Settings, and Home controls are visible and have hit areas matching their visuals.
8. Tap Hint and Shuffle. Confirm feedback appears, Shuffle redraws the bucket pool, and no console error is thrown.
9. Force or reach a failed battle. Confirm Replay, Home, and Revive are shown; Revive uses the mock rewarded-ad flow and does not require any SDK.
10. Return Home from Battle and restart Battle. Confirm there are no duplicate listeners, duplicate pooled nodes, or stale result panels.
11. Replace no art assets during this validation unless import settings and SpriteFrame bindings are explicitly reviewed.
12. Record any Cocos-only issues with scene name, node path, screenshot, console warning, and exact action sequence.

## Do Not Change Without Inspection

- `.scene` and `.prefab` serialized references.
- `.meta` UUID files.
- `BattleRoot` component references.
- `ToolbarView.resultRoot` and result button children.
- Home root button/node names that are used by runtime setup.
