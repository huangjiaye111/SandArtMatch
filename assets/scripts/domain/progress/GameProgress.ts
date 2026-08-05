import { BUILT_IN_LEVEL_CATALOG, getFirstLevelEntry, getLevelCatalogEntry, type LevelCatalog } from "../config/LevelCatalog";

export const GAME_PROGRESS_SCHEMA_VERSION = 1;

export interface GameProgress {
  readonly schemaVersion: number;
  readonly highestUnlockedLevel: string;
  readonly completedLevelIds: readonly string[];
  readonly lastSelectedLevelId: string | null;
}

export interface LevelUnlockState {
  readonly levelId: string;
  readonly unlocked: boolean;
  readonly completed: boolean;
  readonly recommended: boolean;
}

export interface HomeSelectionState {
  readonly selectedLevelId: string;
}

export function createDefaultGameProgress(catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): GameProgress {
  const first = getFirstLevelEntry(catalog);
  return freezeProgress({
    schemaVersion: GAME_PROGRESS_SCHEMA_VERSION,
    highestUnlockedLevel: first.levelId,
    completedLevelIds: [],
    lastSelectedLevelId: null,
  });
}

export function normalizeGameProgress(value: unknown, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): GameProgress {
  if (!isRecord(value) || value.schemaVersion !== GAME_PROGRESS_SCHEMA_VERSION) {
    return createDefaultGameProgress(catalog);
  }
  const completed = Array.isArray(value.completedLevelIds)
    ? uniqueKnownLevelIds(value.completedLevelIds, catalog)
    : [];
  const highestUnlockedLevel = typeof value.highestUnlockedLevel === "string" && isKnownLevelId(value.highestUnlockedLevel, catalog)
    ? value.highestUnlockedLevel
    : getFirstLevelEntry(catalog).levelId;
  const lastSelectedLevelId = typeof value.lastSelectedLevelId === "string" && isKnownLevelId(value.lastSelectedLevelId, catalog)
    ? value.lastSelectedLevelId
    : null;

  return freezeProgress({
    schemaVersion: GAME_PROGRESS_SCHEMA_VERSION,
    highestUnlockedLevel,
    completedLevelIds: completed,
    lastSelectedLevelId,
  });
}

export function isLevelUnlocked(
  progress: GameProgress,
  levelId: string,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): boolean {
  const entry = getLevelCatalogEntry(levelId, catalog);
  const highest = getLevelCatalogEntry(progress.highestUnlockedLevel, catalog);
  return entry.initialUnlocked || entry.displayNumber <= highest.displayNumber;
}

export function isLevelCompleted(progress: GameProgress, levelId: string): boolean {
  return progress.completedLevelIds.includes(levelId);
}

export function getRecommendedLevelId(
  progress: GameProgress,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): string {
  const firstIncomplete = catalog.find((entry) => isLevelUnlocked(progress, entry.levelId, catalog) && !isLevelCompleted(progress, entry.levelId));
  return firstIncomplete?.levelId ?? progress.highestUnlockedLevel;
}

export function getContinueLevelId(
  progress: GameProgress,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): string {
  if (progress.lastSelectedLevelId !== null && isLevelUnlocked(progress, progress.lastSelectedLevelId, catalog)) {
    return progress.lastSelectedLevelId;
  }
  return getRecommendedLevelId(progress, catalog);
}

export function getHomeSelectionState(
  progress: GameProgress,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): HomeSelectionState {
  return Object.freeze({
    selectedLevelId: getContinueLevelId(progress, catalog),
  });
}

export function selectLevelInProgress(
  progress: GameProgress,
  levelId: string,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): GameProgress {
  getLevelCatalogEntry(levelId, catalog);
  return freezeProgress({ ...progress, lastSelectedLevelId: levelId });
}

export function completeLevelInProgress(
  progress: GameProgress,
  levelId: string,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): GameProgress {
  const entry = getLevelCatalogEntry(levelId, catalog);
  const completed = progress.completedLevelIds.includes(levelId)
    ? [...progress.completedLevelIds]
    : [...progress.completedLevelIds, levelId];
  const highest = getLevelCatalogEntry(progress.highestUnlockedLevel, catalog);
  const next = entry.nextLevelId === null ? null : getLevelCatalogEntry(entry.nextLevelId, catalog);
  const highestUnlockedLevel = next !== null && next.displayNumber > highest.displayNumber
    ? next.levelId
    : progress.highestUnlockedLevel;

  return freezeProgress({
    schemaVersion: GAME_PROGRESS_SCHEMA_VERSION,
    highestUnlockedLevel,
    completedLevelIds: completed,
    lastSelectedLevelId: levelId,
  });
}

export function getLevelUnlockStates(
  progress: GameProgress,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): readonly LevelUnlockState[] {
  const recommended = getRecommendedLevelId(progress, catalog);
  return Object.freeze(catalog.map((entry) => Object.freeze({
    levelId: entry.levelId,
    unlocked: isLevelUnlocked(progress, entry.levelId, catalog),
    completed: isLevelCompleted(progress, entry.levelId),
    recommended: entry.levelId === recommended,
  })));
}

function freezeProgress(progress: GameProgress): GameProgress {
  return Object.freeze({
    schemaVersion: progress.schemaVersion,
    highestUnlockedLevel: progress.highestUnlockedLevel,
    completedLevelIds: Object.freeze([...progress.completedLevelIds]),
    lastSelectedLevelId: progress.lastSelectedLevelId,
  });
}

function uniqueKnownLevelIds(values: readonly unknown[], catalog: LevelCatalog): readonly string[] {
  const ids: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && isKnownLevelId(value, catalog) && !ids.includes(value)) {
      ids.push(value);
    }
  }
  return ids;
}

function isKnownLevelId(levelId: string, catalog: LevelCatalog): boolean {
  return catalog.some((entry) => entry.levelId === levelId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
