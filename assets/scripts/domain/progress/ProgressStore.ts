import { BUILT_IN_LEVEL_CATALOG, type LevelCatalog } from "../config/LevelCatalog";
import {
  createDefaultGameProgress,
  completeLevelInProgress,
  getHighestUnlockedLevel,
  isLevelCompleted,
  isLevelUnlocked,
  normalizeGameProgress,
  unlockLevelInProgress,
  type GameProgress,
} from "./GameProgress";

export const DEFAULT_PROGRESS_STORAGE_KEY = "sand-art-match.progress.v1";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProgressStore {
  load(): GameProgress;
  save(progress: GameProgress): void;
  reset(): void;
  isLevelUnlocked(levelId: string): boolean;
  isLevelCompleted(levelId: string): boolean;
  completeLevel(levelId: string): GameProgress;
  unlockLevel(levelId: string): GameProgress;
  getHighestUnlockedLevel(): string;
}

export class JsonProgressStore implements ProgressStore {
  private readonly storage: KeyValueStorage;
  private readonly catalog: LevelCatalog;
  private readonly key: string;

  public constructor(
    storage: KeyValueStorage,
    catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
    key = DEFAULT_PROGRESS_STORAGE_KEY,
  ) {
    this.storage = storage;
    this.catalog = catalog;
    this.key = key;
  }

  public load(): GameProgress {
    const raw = this.storage.getItem(this.key);
    if (raw === null || raw.length === 0) {
      return createDefaultGameProgress(this.catalog);
    }
    try {
      return normalizeGameProgress(JSON.parse(raw), this.catalog);
    } catch {
      return createDefaultGameProgress(this.catalog);
    }
  }

  public save(progress: GameProgress): void {
    const normalized = normalizeGameProgress(progress, this.catalog);
    this.storage.setItem(this.key, JSON.stringify(normalized));
  }

  public reset(): void {
    this.storage.removeItem(this.key);
  }

  public isLevelUnlocked(levelId: string): boolean {
    return isLevelUnlocked(this.load(), levelId, this.catalog);
  }

  public isLevelCompleted(levelId: string): boolean {
    return isLevelCompleted(this.load(), levelId);
  }

  public completeLevel(levelId: string): GameProgress {
    const progress = completeLevelInProgress(this.load(), levelId, this.catalog);
    this.save(progress);
    return progress;
  }

  public unlockLevel(levelId: string): GameProgress {
    const progress = unlockLevelInProgress(this.load(), levelId, this.catalog);
    this.save(progress);
    return progress;
  }

  public getHighestUnlockedLevel(): string {
    return getHighestUnlockedLevel(this.load(), this.catalog);
  }
}

export class MemoryProgressStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public corrupt(key: string = DEFAULT_PROGRESS_STORAGE_KEY, value = "{bad json"): void {
    this.values.set(key, value);
  }
}

export function createProgressStore(
  storage: KeyValueStorage,
  catalog: LevelCatalog = BUILT_IN_LEVEL_CATALOG,
  key = DEFAULT_PROGRESS_STORAGE_KEY,
): ProgressStore {
  return new JsonProgressStore(storage, catalog, key);
}
