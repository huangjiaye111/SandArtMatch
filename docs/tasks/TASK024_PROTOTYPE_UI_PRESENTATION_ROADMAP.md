# TASK024: Prototype UI And Presentation Roadmap

## Source

- Reference prototype: `C:/Users/bai/Desktop/SandArtMatch_美术需求交互原型v4.pptx`.
- The prototype is a functional and interaction reference. It is not final art and must not be copied as production visual design.

## Goal

Convert the prototype direction into shippable MVP presentation work while preserving the accepted TASK019 gameplay behavior and the TASK023 multi-level theme foundation.

## Priority Rules

- Follow `docs/DECISIONS.md` before prototype text when conflicts exist.
- Keep gameplay-domain logic independent from Cocos Creator.
- Route player battle actions through `BattleStateMachine`.
- Do not change conveyor, sand absorption, gravity, merge, victory, or deadlock rules in this task.
- Do not add production dependencies without approval.
- Do not edit serialized Cocos scene or prefab files until the related script contract and manual editor instructions are ready.

## Prototype Items Confirmed For Near-Term Work

### Home

- Show stamina and coins with lightweight acquire entries.
- Keep Home visually unified for now; do not theme-skin Home per level.
- Support multi-level path/card state: completed, current, unlocked, locked.
- Keep Play as the only action that enters Battle.
- Keep Settings, Collection, Shop, and Game Circle as visible entry points only when their backing flow is ready.

### Battle

- Preserve six default conveyor carrier slots.
- Preserve current bucket pool rule unless a later decision changes it.
- Apply level theme to Battle background, sand frame, and decoration placeholders.
- Keep dynamic sand artwork as runtime content, not baked into background art.
- Add clearer combo/progress/result presentation as visual-only feedback.
- Prepare two tool entry points as presentation hooks, without changing gameplay rules until tool behavior is specified.
- Treat ad extra-slot as a later feature flag. It must only affect conveyor capacity when explicitly implemented and tested.

### Settlement

- Victory needs artwork display, dynamic coin reward text, Share, Next Level, and Home actions.
- Deadlock needs clear failure messaging, stamina display, rewarded revive entry, Replay, and Home actions.
- Reward values and stamina values must come from runtime data, not fixed art.

### Collection

- Preserve the three-layer structure: chapter list, artwork list, artwork detail/certificate.
- Chapters map to the first four themes: spring garden, beach holiday, cozy home, cloud dream.
- Certificate frame should use the current artwork/theme contract once final art arrives.

### Settings, Shop, Game Circle

- Settings remains a lightweight popup with sound and vibration toggles.
- Shop and Game Circle are post-MVP or feature-gated unless a later task explicitly promotes them.
- Rewarded-ad entry points may use mock ad services until platform SDK integration is approved.

## Known Conflicts And Decisions Needed

- Prototype says BucketPool is 4 columns x 4 buckets per column. Current project decisions freeze the default bucket pool layout as 2 rows x 4 columns. Keep the current rule until `docs/DECISIONS.md` is updated.
- Prototype includes ad revive, ad extra conveyor slot, shop, and game circle. Current MVP decisions exclude formal ad SDK, shop, and social systems. Treat these as placeholders or later tasks.
- Prototype says Battle has two battle tools. Tool UI hooks can be prepared, but actual tool effects need their own gameplay specification and tests.

## Suggested Development Order

1. Close TASK023 by verifying multi-level theme routing, next-level unlock, final-level safety, and fallback theme behavior.
2. Add a Battle theme application layer that can swap placeholder colors or SpriteFrame keys without editing gameplay rules.
3. Add visual-only Battle HUD polish: progress label, combo feedback model, and result panel button surface.
4. Add Home resource/acquire popup data models and mock ad reward flow.
5. Add Victory and Deadlock settlement data models for dynamic reward, stamina, Next Level, Replay, and Home actions.
6. Expand collection presentation using the existing artwork/theme catalogs.
7. Create explicit tasks for tool behavior, ad revive, extra carrier slot, shop, and game circle only after their rules are approved.

## Acceptance Criteria For The Next Implementation Task

- Battle can resolve and expose the current level theme without mutating gameplay state.
- Theme placeholder values are visible to Cocos presentation code through a typed contract.
- Existing TASK019 battle behavior remains unchanged in domain tests.
- Home remains unified and does not auto-skin per theme.
- No serialized scene or prefab files are modified.
- `npm.cmd test` passes.
- `npm.cmd run typecheck` passes.

