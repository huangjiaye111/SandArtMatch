# MVP Release Hardening

## TASK035 Status

This document records the release-candidate hardening state for the current MVP task queue.

## Automated Regression

Required commands before every release-candidate handoff:

- `npm.cmd run typecheck`
- `npx.cmd tsc --noEmit -p tsconfig.json`
- `npm.cmd test`

Current automated coverage includes deterministic randomness, no gameplay `Math.random()` usage, sand grid, gravity, exposure, buckets, conveyor, merge, absorb scheduling, battle state machine, battle simulation, deadlock detection, level loading, feature flags, progress, collection, Home data, Shop data, mock ad service, settings, navigation, battle presenter, sand canvas model, and presentation visual models.

## Full Flow Release Checklist

Manual validation must be executed in Cocos Creator before declaring the runtime build ready:

1. Boot starts and transitions to Home.
2. Home shows resources, selected level, Play, Collection, Settings, and Shop placeholder.
3. Shop placeholder shows non-blocking feedback and does not prevent Play.
4. Play enters Battle for the selected level.
5. Battle renders sand canvas, conveyor, bucket pool, toolbar, Hint, Shuffle, Settings, Home, and result panel controls.
6. Bucket selection routes through battle logic and produces conveyor entry, absorption, gravity, merge, exit, victory, or deadlock feedback.
7. Hint and Shuffle work only while input is available.
8. Deadlock shows Replay, Home, and Revive states.
9. Revive uses mock rewarded ad only; no formal ad SDK is required.
10. Home from Battle returns to Home without stale listeners or duplicated runtime nodes.
11. Victory updates progression and collection data.
12. Re-entering Battle creates a fresh runtime without stale result panel, particle, or conveyor state.

## Performance Review Points

Validated by code structure and tests:

- No Cocos node per sand cell.
- Sand canvas uses dynamic texture and reusable buffers.
- Absorption particles are pooled and capped by `BattlePresentationConfig.absorptionParticlePoolCapacity`.
- Simulation ticks and visible presentation frames are bounded by `BattleSimulationConfig` and `BattlePresentationConfig`.
- Extra conveyor slot is feature-gated and disabled by default.

Manual performance measurements still required on target devices:

- Stable Battle draw calls target: under 80.
- Heavy feedback draw calls target: under 120.
- Texture memory after replacing final art assets.
- Frame stability during absorption, gravity, merge, full-bucket exit, and scene transitions.

## Save And Load Regression

Automated coverage protects:

- Progress persistence and recovery from corrupted data.
- Level unlock and completion idempotency.
- Collection progression updates after completed levels.
- Settings persistence and recovery.
- Navigation session level selection.

Manual validation still required:

- Close and reopen the game after completing `level-001`; Home should show the saved progression.
- Toggle settings, close and reopen, and confirm the setting persists.

## Gated Or Deferred Features

- Formal ad SDK: deferred. Current revive and extra carrier slot use mock ad service only.
- Extra conveyor slot: gated by `battleExtraCarrierSlot`, disabled by default.
- Shop economy and payment: deferred. Home Shop is a safe placeholder.
- Leaderboard, sign-in, daily challenge, and social systems: deferred by MVP decisions.
- Final art replacement: allowed later through documented asset-binding contracts and manual validation.

## Release Candidate Risk List

- Manual Cocos validation is still required in the editor and target runtime because automated tests do not load serialized scenes.
- Final art assets are not integrated yet; replacement can affect SpriteFrame settings, draw calls, texture memory, and hit-area readability.
- WeChat mini game device performance must be measured on the agreed device matrix before final production release.
- The current mock ad path is suitable for MVP testing only and must be replaced or disabled before any production ad integration.

No unresolved automated-test blocker remains for MVP release-candidate testing.
