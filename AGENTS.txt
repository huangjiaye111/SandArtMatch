# AGENTS.md

## Project

This is a portrait-mode WeChat mini game built with Cocos Creator and TypeScript.

Before starting any task, read:

1. `docs/DECISIONS.md`
2. `docs/INDEX.md`, if it exists
3. The active task file under `docs/tasks/`

Documents under `docs/source/` are reference material.
If they conflict with `docs/DECISIONS.md`, follow `docs/DECISIONS.md`.

## Core constraints

- Use TypeScript.
- Keep gameplay-domain logic independent from Cocos Creator.
- Gameplay logic must be testable without loading a Cocos scene.
- UI components must not directly mutate gameplay state.
- Route player actions through `BattleStateMachine`.
- Never use `Math.random()` in gameplay logic.
- Use deterministic seeded randomness.
- Do not add production dependencies without approval.
- Do not modify unrelated files.
- Do not silently change gameplay rules.
- Do not implement features outside the active task.

## Cocos constraints

- Portrait orientation.
- Base design resolution: 750 × 1334.
- Default conveyor capacity: 6.
- Bucket pool layout: 2 rows × 4 columns.
- Preserve `.meta` files and UUID references.
- Do not regenerate scenes or prefabs without inspecting them.
- Prefer component scripts and explicit editor instructions over unsafe direct editing of serialized Cocos files.

## Workflow

Before implementation:

1. Read the active task and related requirements.
2. Inspect existing code and tests.
3. Identify conflicts or assumptions.
4. Produce a concise implementation plan.

During implementation:

1. Make the smallest coherent change.
2. Keep domain logic separate from presentation.
3. Add tests.
4. Avoid unrelated refactoring.

Before completion:

1. Run relevant tests.
2. Run available TypeScript checks.
3. Review the diff.
4. Compare the result with every acceptance criterion.
5. Report changed files, commands, results and unresolved risks.