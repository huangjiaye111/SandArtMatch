import type { LevelConfig, RawLevelConfig } from "./LevelConfig";
import { getBuiltInTestLevel, TEST_LEVELS } from "./TestLevels";
import type { ThemeId } from "../../theme/ThemeTypes";

export interface LevelCatalogEntry {
  readonly levelId: string;
  readonly id: string;
  readonly displayNumber: number;
  readonly order: number;
  readonly configLevelId: number;
  readonly themeId: ThemeId;
  readonly artworkId: string;
  readonly initialUnlocked: boolean;
  readonly nextLevelId: string | null;
}

export type LevelCatalog = readonly LevelCatalogEntry[];

export const BUILT_IN_LEVEL_CATALOG: LevelCatalog = Object.freeze([
  createLevelEntry({
    id: "level-001",
    order: 1,
    configLevelId: 1,
    themeId: "spring-garden",
    artworkId: "artwork-spring-garden-001",
    initialUnlocked: true,
    nextLevelId: "level-002",
  }),
  createLevelEntry({
    id: "level-002",
    order: 2,
    configLevelId: 1,
    themeId: "beach-holiday",
    artworkId: "artwork-beach-holiday-001",
    initialUnlocked: false,
    nextLevelId: "level-003",
  }),
  createLevelEntry({
    id: "level-003",
    order: 3,
    configLevelId: 1,
    themeId: "cozy-home",
    artworkId: "artwork-cozy-home-001",
    initialUnlocked: false,
    nextLevelId: "level-004",
  }),
  createLevelEntry({
    id: "level-004",
    order: 4,
    configLevelId: 1,
    themeId: "cloud-dream",
    artworkId: "artwork-cloud-dream-001",
    initialUnlocked: false,
    nextLevelId: null,
  }),
]);

export function getFirstLevelEntry(catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry {
  const first = LevelCatalog.getByOrder(1, catalog) ?? LevelCatalog.getAll(catalog)[0];
  if (first === undefined) {
    throw new Error("Level catalog is empty.");
  }
  return first;
}

export function getLevelCatalogEntry(levelId: string, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry {
  return LevelCatalog.getById(levelId, catalog);
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
  return `Level ${entry.order}`;
}

export function assertCatalogIntegrity(catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): void {
  if (catalog.length === 0) {
    throw new Error("Level catalog must contain at least one level.");
  }
  const levelIds = new Set<string>();
  const orders = new Set<number>();
  const artworkIds = new Set<string>();
  for (const entry of catalog) {
    if (levelIds.has(entry.levelId)) {
      throw new Error(`Duplicate catalog levelId: ${entry.levelId}.`);
    }
    if (entry.id !== entry.levelId) {
      throw new Error(`Catalog level ${entry.levelId} has mismatched id ${entry.id}.`);
    }
    if (orders.has(entry.order)) {
      throw new Error(`Duplicate catalog order: ${entry.order}.`);
    }
    if (artworkIds.has(entry.artworkId)) {
      throw new Error(`Duplicate catalog artworkId: ${entry.artworkId}.`);
    }
    if (!Number.isSafeInteger(entry.order) || entry.order <= 0) {
      throw new Error(`Catalog level ${entry.levelId} has invalid order ${entry.order}.`);
    }
    if (entry.displayNumber !== entry.order) {
      throw new Error(`Catalog level ${entry.levelId} has mismatched displayNumber ${entry.displayNumber}.`);
    }
    levelIds.add(entry.levelId);
    orders.add(entry.order);
    artworkIds.add(entry.artworkId);
    getBuiltInTestLevel(entry.configLevelId);
  }
  for (const entry of catalog) {
    const nextLevelId = LevelCatalog.getNextLevel(entry.levelId, catalog)?.levelId ?? null;
    if (entry.nextLevelId !== nextLevelId) {
      throw new Error(`Catalog level ${entry.levelId} has stale nextLevelId ${entry.nextLevelId}.`);
    }
  }
}

export const LevelCatalog = Object.freeze({
  getById(levelId: string, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry {
    const entry = catalog.find((candidate) => candidate.levelId === levelId);
    if (entry === undefined) {
      throw new Error(`Unknown catalog levelId: ${levelId}.`);
    }
    return entry;
  },

  getByOrder(order: number, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry | null {
    if (!Number.isSafeInteger(order) || order <= 0) {
      throw new RangeError("Level order must be a positive safe integer.");
    }
    return catalog.find((candidate) => candidate.order === order) ?? null;
  },

  getNextLevel(levelId: string, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry | null {
    const current = LevelCatalog.getById(levelId, catalog);
    const levels = LevelCatalog.getAll(catalog);
    const index = levels.findIndex((entry) => entry.levelId === current.levelId);
    return index < 0 ? null : levels[index + 1] ?? null;
  },

  getPreviousLevel(levelId: string, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): LevelCatalogEntry | null {
    const current = LevelCatalog.getById(levelId, catalog);
    const levels = LevelCatalog.getAll(catalog);
    const index = levels.findIndex((entry) => entry.levelId === current.levelId);
    return index <= 0 ? null : levels[index - 1] ?? null;
  },

  getAll(catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): readonly LevelCatalogEntry[] {
    return Object.freeze([...catalog].sort((left, right) => left.order - right.order));
  },

  getCount(catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): number {
    return catalog.length;
  },

  has(levelId: string, catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG): boolean {
    return catalog.some((entry) => entry.levelId === levelId);
  },
});

interface LevelEntryOptions {
  readonly id: string;
  readonly order: number;
  readonly configLevelId: number;
  readonly themeId: ThemeId;
  readonly artworkId: string;
  readonly initialUnlocked: boolean;
  readonly nextLevelId: string | null;
}

function createLevelEntry(options: LevelEntryOptions): LevelCatalogEntry {
  return Object.freeze({
    levelId: options.id,
    id: options.id,
    displayNumber: options.order,
    order: options.order,
    configLevelId: options.configLevelId,
    themeId: options.themeId,
    artworkId: options.artworkId,
    initialUnlocked: options.initialUnlocked,
    nextLevelId: options.nextLevelId,
  });
}
