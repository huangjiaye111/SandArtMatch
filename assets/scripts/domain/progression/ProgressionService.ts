import { ArtworkCatalog, BUILT_IN_ARTWORK_CATALOG } from "../../artwork/ArtworkCatalog";
import type { ArtworkDefinition } from "../../artwork/ArtworkTypes";
import { BUILT_IN_LEVEL_CATALOG, LevelCatalog, type LevelCatalog as LevelCatalogData } from "../config/LevelCatalog";
import { isLevelUnlocked, type GameProgress } from "../progress/GameProgress";
import type { ProgressStore } from "../progress/ProgressStore";
import type { CollectionProgressStore } from "../../collection/CollectionProgressStore";

export interface ProgressionResult {
  readonly progress: GameProgress;
  readonly nextLevelId: string | null;
  readonly canStartNext: boolean;
}

export class ProgressionService {
  private readonly progressStore: ProgressStore;
  private readonly collectionStore: CollectionProgressStore;
  private readonly levelCatalog: LevelCatalogData;
  private readonly artworkCatalog: readonly ArtworkDefinition[];

  public constructor(
    progressStore: ProgressStore,
    collectionStore: CollectionProgressStore,
    levelCatalog: LevelCatalogData = BUILT_IN_LEVEL_CATALOG,
    artworkCatalog: readonly ArtworkDefinition[] = BUILT_IN_ARTWORK_CATALOG,
  ) {
    this.progressStore = progressStore;
    this.collectionStore = collectionStore;
    this.levelCatalog = levelCatalog;
    this.artworkCatalog = artworkCatalog;
  }

  public completeLevel(levelId: string): ProgressionResult {
    const progress = this.progressStore.completeLevel(levelId);
    const level = LevelCatalog.getById(levelId, this.levelCatalog);
    this.collectionStore.collectArtwork(level.artworkId);
    this.unlockArtworksForUnlockedLevels(progress);
    const nextLevelId = LevelCatalog.getNextLevel(levelId, this.levelCatalog)?.levelId ?? null;

    return Object.freeze({
      progress,
      nextLevelId,
      canStartNext: nextLevelId !== null && isLevelUnlocked(progress, nextLevelId, this.levelCatalog),
    });
  }

  public unlockArtworksForUnlockedLevels(progress: GameProgress = this.progressStore.load()): void {
    for (const level of LevelCatalog.getAll(this.levelCatalog)) {
      if (isLevelUnlocked(progress, level.levelId, this.levelCatalog) && ArtworkCatalog.has(level.artworkId)) {
        this.collectionStore.unlockArtwork(level.artworkId);
      }
    }
  }
}

export function createProgressionService(
  progressStore: ProgressStore,
  collectionStore: CollectionProgressStore,
  levelCatalog: LevelCatalogData = BUILT_IN_LEVEL_CATALOG,
  artworkCatalog: readonly ArtworkDefinition[] = BUILT_IN_ARTWORK_CATALOG,
): ProgressionService {
  return new ProgressionService(progressStore, collectionStore, levelCatalog, artworkCatalog);
}
