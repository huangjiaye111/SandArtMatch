import { ArtworkCatalog, BUILT_IN_ARTWORK_CATALOG } from "../artwork/ArtworkCatalog";
import type { ArtworkDefinition } from "../artwork/ArtworkTypes";
import type { ThemeId } from "../theme/ThemeTypes";
import type { KeyValueStorage } from "../domain/progress/ProgressStore";
import {
  COLLECTION_PROGRESS_SCHEMA_VERSION,
  type CollectionProgressState,
  type CollectionThemeProgress,
  type CollectionTotalProgress,
} from "./CollectionTypes";

export const DEFAULT_COLLECTION_PROGRESS_STORAGE_KEY = "sand-art-match.collection.v1";

export interface CollectionProgressStore {
  load(): CollectionProgressState;
  save(progress: CollectionProgressState): void;
  reset(): void;
  isArtworkUnlocked(artworkId: string): boolean;
  isArtworkCollected(artworkId: string): boolean;
  unlockArtwork(artworkId: string): CollectionProgressState;
  collectArtwork(artworkId: string): CollectionProgressState;
  getCollectedCount(): number;
  getCollectedCountByTheme(themeId: ThemeId): number;
  getUnlockedCountByTheme(themeId: ThemeId): number;
  getThemeProgress(themeId: ThemeId): CollectionThemeProgress;
  getTotalProgress(): CollectionTotalProgress;
}

export class JsonCollectionProgressStore implements CollectionProgressStore {
  private readonly storage: KeyValueStorage;
  private readonly key: string;
  private readonly artworkCatalog: readonly ArtworkDefinition[];

  public constructor(
    storage: KeyValueStorage,
    artworkCatalog: readonly ArtworkDefinition[] = BUILT_IN_ARTWORK_CATALOG,
    key = DEFAULT_COLLECTION_PROGRESS_STORAGE_KEY,
  ) {
    this.storage = storage;
    this.key = key;
    this.artworkCatalog = artworkCatalog;
  }

  public load(): CollectionProgressState {
    const raw = this.storage.getItem(this.key);
    if (raw === null || raw.length === 0) {
      return createDefaultCollectionProgress();
    }
    try {
      return normalizeCollectionProgress(JSON.parse(raw), this.artworkCatalog);
    } catch {
      return createDefaultCollectionProgress();
    }
  }

  public save(progress: CollectionProgressState): void {
    this.storage.setItem(this.key, JSON.stringify(normalizeCollectionProgress(progress, this.artworkCatalog)));
  }

  public reset(): void {
    this.storage.removeItem(this.key);
  }

  public isArtworkUnlocked(artworkId: string): boolean {
    const progress = this.load();
    return getArtworkStatus(progress, artworkId, this.artworkCatalog) !== "locked";
  }

  public isArtworkCollected(artworkId: string): boolean {
    return getArtworkStatus(this.load(), artworkId, this.artworkCatalog) === "collected";
  }

  public unlockArtwork(artworkId: string): CollectionProgressState {
    const progress = this.load();
    const updated = withArtworkUnlocked(progress, artworkId, this.artworkCatalog);
    this.save(updated);
    return updated;
  }

  public collectArtwork(artworkId: string): CollectionProgressState {
    const progress = this.load();
    const updated = withArtworkCollected(progress, artworkId, this.artworkCatalog);
    this.save(updated);
    return updated;
  }

  public getCollectedCount(): number {
    return this.load().collectedArtworkIds.length;
  }

  public getCollectedCountByTheme(themeId: ThemeId): number {
    return this.getArtworkIdsByTheme(themeId).filter((artworkId) => this.isArtworkCollected(artworkId)).length;
  }

  public getUnlockedCountByTheme(themeId: ThemeId): number {
    return this.getArtworkIdsByTheme(themeId).filter((artworkId) => this.isArtworkUnlocked(artworkId)).length;
  }

  public getThemeProgress(themeId: ThemeId): CollectionThemeProgress {
    const total = this.getArtworkIdsByTheme(themeId).length;
    const collected = this.getCollectedCountByTheme(themeId);
    return Object.freeze({
      themeId,
      collected,
      total,
      percent: total === 0 ? 0 : collected / total,
    });
  }

  public getTotalProgress(): CollectionTotalProgress {
    const total = this.artworkCatalog.length;
    const collected = this.getCollectedCount();
    return Object.freeze({
      collected,
      total,
      percent: total === 0 ? 0 : collected / total,
    });
  }

  private getArtworkIdsByTheme(themeId: ThemeId): readonly string[] {
    return ArtworkCatalog.getByTheme(themeId).map((artwork) => artwork.id);
  }
}

export class MemoryCollectionStorage implements KeyValueStorage {
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
}

export function createCollectionProgressStore(
  storage: KeyValueStorage,
  artworkCatalog: readonly ArtworkDefinition[] = BUILT_IN_ARTWORK_CATALOG,
  key = DEFAULT_COLLECTION_PROGRESS_STORAGE_KEY,
): CollectionProgressStore {
  return new JsonCollectionProgressStore(storage, artworkCatalog, key);
}

export function createDefaultCollectionProgress(): CollectionProgressState {
  return Object.freeze({
    schemaVersion: COLLECTION_PROGRESS_SCHEMA_VERSION,
    unlockedArtworkIds: Object.freeze([]),
    collectedArtworkIds: Object.freeze([]),
  });
}

export function normalizeCollectionProgress(
  value: unknown,
  artworkCatalog: readonly ArtworkDefinition[] = BUILT_IN_ARTWORK_CATALOG,
): CollectionProgressState {
  if (!isRecord(value) || value.schemaVersion !== COLLECTION_PROGRESS_SCHEMA_VERSION) {
    return createDefaultCollectionProgress();
  }

  const knownIds = new Set(artworkCatalog.map((artwork) => artwork.id));
  const unlocked = uniqueKnownArtworkIds(Array.isArray(value.unlockedArtworkIds) ? value.unlockedArtworkIds : [], knownIds);
  const collected = uniqueKnownArtworkIds(Array.isArray(value.collectedArtworkIds) ? value.collectedArtworkIds : [], knownIds);
  for (const artworkId of collected) {
    if (!unlocked.includes(artworkId)) {
      unlocked.push(artworkId);
    }
  }

  return Object.freeze({
    schemaVersion: COLLECTION_PROGRESS_SCHEMA_VERSION,
    unlockedArtworkIds: Object.freeze(unlocked),
    collectedArtworkIds: Object.freeze(collected),
  });
}

function withArtworkUnlocked(
  progress: CollectionProgressState,
  artworkId: string,
  artworkCatalog: readonly ArtworkDefinition[],
): CollectionProgressState {
  if (!isKnownArtworkId(artworkId, artworkCatalog)) {
    warnMissingArtwork(artworkId);
    return progress;
  }
  if (progress.collectedArtworkIds.includes(artworkId) || progress.unlockedArtworkIds.includes(artworkId)) {
    return progress;
  }
  return normalizeCollectionProgress({
    schemaVersion: COLLECTION_PROGRESS_SCHEMA_VERSION,
    unlockedArtworkIds: [...progress.unlockedArtworkIds, artworkId],
    collectedArtworkIds: progress.collectedArtworkIds,
  }, artworkCatalog);
}

function withArtworkCollected(
  progress: CollectionProgressState,
  artworkId: string,
  artworkCatalog: readonly ArtworkDefinition[],
): CollectionProgressState {
  if (!isKnownArtworkId(artworkId, artworkCatalog)) {
    warnMissingArtwork(artworkId);
    return progress;
  }
  const unlocked = progress.unlockedArtworkIds.includes(artworkId) ? progress.unlockedArtworkIds : [...progress.unlockedArtworkIds, artworkId];
  if (progress.collectedArtworkIds.includes(artworkId)) {
    return progress;
  }
  return normalizeCollectionProgress({
    schemaVersion: COLLECTION_PROGRESS_SCHEMA_VERSION,
    unlockedArtworkIds: unlocked,
    collectedArtworkIds: [...progress.collectedArtworkIds, artworkId],
  }, artworkCatalog);
}

function getArtworkStatus(
  progress: CollectionProgressState,
  artworkId: string,
  artworkCatalog: readonly ArtworkDefinition[],
): "locked" | "unlocked" | "collected" {
  if (!isKnownArtworkId(artworkId, artworkCatalog)) {
    warnMissingArtwork(artworkId);
    return "locked";
  }
  if (progress.collectedArtworkIds.includes(artworkId)) {
    return "collected";
  }
  if (progress.unlockedArtworkIds.includes(artworkId)) {
    return "unlocked";
  }
  return "locked";
}

function uniqueKnownArtworkIds(values: readonly unknown[], knownIds: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && knownIds.has(value) && !ids.includes(value)) {
      ids.push(value);
    }
  }
  return ids;
}

function isKnownArtworkId(artworkId: string, artworkCatalog: readonly ArtworkDefinition[]): boolean {
  return artworkCatalog.some((artwork) => artwork.id === artworkId);
}

function warnMissingArtwork(artworkId: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[CollectionProgressStore] Unknown artworkId "${artworkId}".`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

