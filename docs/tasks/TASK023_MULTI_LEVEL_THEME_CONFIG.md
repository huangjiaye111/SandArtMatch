# TASK023: Multi-Level Theme Configuration System

## Scope

Build the data and runtime seams for multiple development levels and theme switching without changing accepted TASK019 gameplay behavior.

## Rules

- Keep Battle simulation, SandGrid, conveyor capacity, bucket pool behavior, absorption, gravity, merge, victory, and deadlock rules unchanged.
- Add four catalog levels: `level-001` through `level-004`.
- Reuse the accepted showcase level config as placeholder gameplay content for all four levels.
- Associate each catalog level with a stable `themeId` and `artworkId`.
- Keep Home visual theme unified for now.
- Do not edit Cocos scene or prefab serialized files for this task.

## Theme Set

- `spring-garden`: 春日花园
- `beach-holiday`: 海边假日
- `cozy-home`: 温馨小屋
- `cloud-dream`: 云朵梦境

## Verification Targets

- `level-001` enters Battle with `spring-garden`.
- `level-002` enters Battle with `beach-holiday` after unlock.
- `level-003` enters Battle with `cozy-home` after unlock.
- `level-004` enters Battle with `cloud-dream` after unlock.
- Completing a level unlocks `LevelCatalog.getNextLevel()`.
- Final-level next lookup returns `null` safely.
- Invalid theme ids warn and fall back safely.
