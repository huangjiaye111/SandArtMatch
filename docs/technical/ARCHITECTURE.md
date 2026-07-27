# Technical Architecture

## Authority

Frozen technical constraints come from `AGENTS.md` and `docs/DECISIONS.md`.

## Core Principles

Frozen:

- Use TypeScript.
- Keep gameplay-domain logic independent from Cocos Creator.
- Gameplay logic must be testable without loading a Cocos scene.
- Core rules must not depend on Cocos `Node` or `Component`.
- UI components must not directly mutate gameplay state.
- Player actions go through `BattleStateMachine`.
- Do not use `Math.random()` in gameplay logic.
- Use deterministic seeded randomness.

## Layering

Frozen:

```text
UI / Cocos Presentation
-> BattleStateMachine
-> Pure TypeScript Gameplay Domain
-> Deterministic Data + Random Seed
```

## Gameplay Domain

Frozen:

- Sand grid logic.
- Deterministic gravity.
- Exposed sand detection.
- Bucket and conveyor rules.
- Merge logic.
- Win/deadlock judgment.
- Undo state.

可配置:

- Module names.
- Folder layout.
- Data serialization format.
- Test framework details, according to the current project setup.

## Presentation Layer

Frozen:

- Visual particles are separate from logical sand.
- UI reads battle state and sends actions; it does not directly mutate core battle data.

可配置:

- Cocos component names.
- Scene node names.
- Prefab composition.
- Animation and effect implementation.

## Dependencies

Frozen:

- Do not add production dependencies without approval.

待验证:

- Whether any test-only utility dependencies are needed.
- Whether a seeded random helper already exists or should be implemented locally.
