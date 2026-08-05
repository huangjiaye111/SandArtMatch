# TASK021: Home Embedded Level Selection and Formal Level 1 Closeout

## Scope

The formal product flow is:

`Boot -> Home (embedded level selection) -> Battle -> Victory/Deadlock`

The current catalog contains only `level-001`. Home renders level items from
`LevelCatalog`; the scene does not hard-code a formal level list.

## Rules

- `level-001` is always unlocked.
- Home defaults to the valid saved selection, then the highest unlocked level,
  then the first catalog entry.
- Selecting a level updates selection only. Play is the only Home action that
  starts Battle.
- Victory and Deadlock expose Replay and Home. There is no Next action while
  `nextLevelId` is `null`.
- Progress loading ignores unknown legacy level IDs and falls back safely.
- `LevelCatalog`, `ProgressStore`, `GameSession`, and `GameNavigator` remain
  extensible for future catalog entries.
- LevelSelect is removed from the formal runtime flow.

## Verification

Required checks include domain tests, TypeScript typecheck, `git diff --check`,
the `Math.random()` scan, scene-list review, and Cocos/Funplay validation of
Boot, Home, and Battle after scene authoring is available.
