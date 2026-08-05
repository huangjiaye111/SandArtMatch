# TASK020: Main Flow, Level Select, Progress Save, Battle Entry

## Scope

Build the first complete main loop:

Boot -> Home -> Level Select -> Battle -> Victory / Deadlock -> Next / Replay / Home, with local progress save and restore.

This task owns:

- A stable level catalog that separates gameplay config IDs from UI display numbers.
- A pure TypeScript progress model and storage abstraction.
- Unlock rules for first level, victory completion, next-level unlock, locked-level rejection, and idempotent repeat victory.
- A single navigation entry for Home, Level Select, Battle, Replay, and Next.
- Cocos adapters for local storage and scene loading.
- Battle result actions for Victory and Deadlock.
- Automated tests for catalog, progress, navigation, replay, next, and duplicate navigation behavior.

## Explicitly Out Of Scope

No shop, ads, IAP, daily rewards, sign-in, leaderboard, cloud save, login, stamina, social share, sound-system expansion, formal art rebuild, or TASK021 work.

## Architecture Choice

Use the existing scene direction and extend it to:

- `Boot.scene`
- `Home.scene`
- `LevelSelect.scene`
- `Battle.scene`

Scene and prefab serialization must be changed through Funplay Cocos MCP, not by hand. Code may create stable runtime UI nodes where scene authoring is not yet available.

## Acceptance Notes

- UI must not directly reference `TestLevels`.
- Battle must load the level selected by the unified session.
- Buttons must call the navigator instead of directly calling `director.loadScene`.
- Progress is local-only and schema-versioned.
- Domain logic remains independent from Cocos.
- Gameplay code continues to avoid `Math.random()`.
