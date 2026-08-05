import type { LevelConfig, RawLevelConfig } from "./LevelConfig";
import { getBuiltInTestLevel, TEST_LEVELS } from "./TestLevels";

export interface LevelCatalogEntry {
  readonly levelId: string;
  readonly displayNumber: number;
  readonly configLevelId: number;
  readonly initialUnlocked: boolean;
  readonly nextLevelId: string | null;
}

export type LevelCatalog = readonly LevelCatalogEntry[];

export const BUILT_IN_LEVEL_CATALOG: LevelCatalog = Object.freeze([
  Object.freeze({
    levelId: "level-001",
    displayNumber: 1,
    configLevelId: 1,
    initialUnlocked: true,
    nextLevelId: null,
  }),
]);

export function getFirstLevelEntry(catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry {
  const first = catalog[0];
  if (first === undefined) {
    throw new Error("Level catalog is empty.");
  }
  return first;
}

export function getLevelCatalogEntry(levelId: string, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry {
  const entry = catalog.find((candidate) => candidate.levelId === levelId);
  if (entry === undefined) {
    throw new Error(`Unknown catalog levelId: ${levelId}.`);
  }
  return entry;
}

export function getLevelCatalogEntryByConfigLevelId(
  configLevelId: number,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
): LevelCatalogEntry {
  const entry = catalog.find((candidate) => candidate.configLevelId === configLevelId);
  if (entry === undefined) {
    throw new Error(`Unknown config levelId in catalog: ${configLevelId}.`);
  }
  return entry;
}

export function getLevelConfigForCatalogEntry(
  entry: LevelCatalogEntry,
  levels: readonly LevelConfig[] = TEST_LEVELS,
): RawLevelConfig {
  const config = levels.find((candidate) => candidate.levelId === entry.configLevelId);
  if (config === undefined) {
    throw new Error(`Missing level config for catalog levelId ${entry.levelId} (configLevelId ${entry.configLevelId}).`);
  }
  return config as RawLevelConfig;
}

export function getBuiltInLevelConfigByCatalogLevelId(levelId: string): RawLevelConfig {
  return getLevelConfigForCatalogEntry(getLevelCatalogEntry(levelId));
}

export function getDisplayLevelText(entry: LevelCatalogEntry): string {
  return `Level ${entry.displayNumber}`;
}

export function assertCatalogIntegrity(catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): void {
  if (catalog.length === 0) {
    throw new Error("Level catalog must contain at least one level.");
  }
  const levelIds = new Set<string>();
  const displayNumbers = new Set<number>();
  for (const entry of catalog) {
    if (levelIds.has(entry.levelId)) {
      throw new Error(`Duplicate catalog levelId: ${entry.levelId}.`);
    }
    if (displayNumbers.has(entry.displayNumber)) {
      throw new Error(`Duplicate catalog displayNumber: ${entry.displayNumber}.`);
    }
    levelIds.add(entry.levelId);
    displayNumbers.add(entry.displayNumber);
    getBuiltInTestLevel(entry.configLevelId);
  }
  for (const entry of catalog) {
    if (entry.nextLevelId !== null && !levelIds.has(entry.nextLevelId)) {
      throw new Error(`Catalog level ${entry.levelId} references missing nextLevelId ${entry.nextLevelId}.`);
    }
  }
}
