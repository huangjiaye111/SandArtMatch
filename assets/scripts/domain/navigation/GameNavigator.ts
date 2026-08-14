import { BUILT_IN_LEVEL_CATALOG, getFirstLevelEntry, getLevelCatalogEntry, LevelCatalog, type LevelCatalog as LevelCatalogData, type LevelCatalogEntry } from "../config/LevelCatalog";
import type { ThemeConfig } from "../../theme/ThemeTypes";
import { ThemeCatalog } from "../../theme/ThemeCatalog";
import {
  getContinueLevelId,
  isLevelUnlocked,
  selectLevelInProgress,
  type GameProgress,
} from "../progress/GameProgress";
import type { ProgressStore } from "../progress/ProgressStore";
import { ProgressionService, type ProgressionResult } from "../progression/ProgressionService";

export type GameSceneName = "Home" | "Battle";

export interface SceneDriver {
  loadScene(sceneName: GameSceneName): Promise<void>;
}

export interface GameSession {
  selectedLevelId: string | null;
  currentLevelId: string | null;
}

export interface NavigationResult {
  readonly accepted: boolean;
  readonly sceneName: GameSceneName | null;
  readonly levelId: string | null;
  readonly reason?: string;
}

export type VictoryProgressResult = ProgressionResult;

export class GameNavigator {
  private navigationInFlight = false;
  private readonly driver: SceneDriver;
  private readonly progressStore: ProgressStore;
  private readonly progressionService: ProgressionService;
  private readonly session: GameSession;
  private readonly catalog: LevelCatalogData;

  public constructor(
    driver: SceneDriver,
    progressStore: ProgressStore,
    session: GameSession,
    catalog: LevelCatalogData = BUILT_IN_LEVEL_CATALOG,
    progressionService: ProgressionService | null = null,
  ) {
    this.driver = driver;
    this.progressStore = progressStore;
    this.session = session;
    this.catalog = catalog;
    this.progressionService = progressionService ?? new ProgressionService(progressStore, createNoopCollectionProgressStore(), catalog);
  }

  public getCurrentLevelId(): string | null {
    return this.session.currentLevelId;
  }

  public getCurrentLevel(): LevelCatalogEntry | null {
    return this.session.currentLevelId === null ? null : LevelCatalog.getById(this.session.currentLevelId, this.catalog);
  }

  public getCurrentTheme(): ThemeConfig | null {
    const level = this.getCurrentLevel();
    return level === null ? null : ThemeCatalog.get(level.themeId);
  }

  public loadProgress(): GameProgress {
    return this.progressStore.load();
  }

  public selectLevel(levelId: string): NavigationResult {
    getLevelCatalogEntry(levelId, this.catalog);
    const progress = this.progressStore.load();
    if (!isLevelUnlocked(progress, levelId, this.catalog)) {
      return Object.freeze({ accepted: false, sceneName: null, levelId, reason: "levelLocked" });
    }
    this.progressStore.save(selectLevelInProgress(progress, levelId, this.catalog));
    this.session.selectedLevelId = levelId;
    return Object.freeze({ accepted: true, sceneName: null, levelId });
  }

  public async goHome(): Promise<NavigationResult> {
    return this.navigate("Home", null);
  }

  public async continueOrStartFirstLevel(): Promise<NavigationResult> {
    const progress = this.progressStore.load();
    return this.startLevel(getContinueLevelId(progress, this.catalog));
  }

  public async startLevel(levelId: string): Promise<NavigationResult> {
    const selection = this.selectLevel(levelId);
    if (!selection.accepted) {
      return selection;
    }
    return this.navigate("Battle", levelId);
  }

  public async replayCurrentLevel(): Promise<NavigationResult> {
    const levelId = this.session.currentLevelId ?? getFirstLevelEntry(this.catalog).levelId;
    return this.startLevel(levelId);
  }

  public async startNextLevel(): Promise<NavigationResult> {
    const currentLevelId = this.session.currentLevelId;
    if (currentLevelId === null) {
      return Object.freeze({ accepted: false, sceneName: null, levelId: null, reason: "missingCurrentLevel" });
    }
    const next = LevelCatalog.getNextLevel(currentLevelId, this.catalog);
    if (next === null) {
      return Object.freeze({ accepted: false, sceneName: null, levelId: currentLevelId, reason: "missingNextLevel" });
    }
    return this.startLevel(next.levelId);
  }

  public completeCurrentLevelVictory(): VictoryProgressResult {
    const currentLevelId = this.session.currentLevelId;
    if (currentLevelId === null) {
      throw new Error("Cannot complete victory without a current level.");
    }
    return this.progressionService.completeLevel(currentLevelId);
  }

  public resetProgress(): void {
    this.progressStore.reset();
    this.session.selectedLevelId = null;
    this.session.currentLevelId = null;
  }

  private async navigate(sceneName: GameSceneName, levelId: string | null): Promise<NavigationResult> {
    if (this.navigationInFlight) {
      return Object.freeze({ accepted: false, sceneName, levelId, reason: "navigationInFlight" });
    }
    this.navigationInFlight = true;
    if (levelId !== null) {
      this.applyCurrentLevel(levelId);
    }
    try {
      await this.driver.loadScene(sceneName);
      return Object.freeze({ accepted: true, sceneName, levelId });
    } catch (error) {
      return Object.freeze({
        accepted: false,
        sceneName,
        levelId,
        reason: error instanceof Error ? error.message : "sceneLoadFailed",
      });
    } finally {
      this.navigationInFlight = false;
    }
  }

  private applyCurrentLevel(levelId: string): void {
    const level = getLevelCatalogEntry(levelId, this.catalog);
    this.session.selectedLevelId = level.levelId;
    this.session.currentLevelId = level.levelId;
  }
}

function createNoopCollectionProgressStore() {
  return {
    load: () => Object.freeze({ schemaVersion: 1, unlockedArtworkIds: Object.freeze([]), collectedArtworkIds: Object.freeze([]) }),
    save: () => undefined,
    reset: () => undefined,
    isArtworkUnlocked: () => false,
    isArtworkCollected: () => false,
    unlockArtwork: () => Object.freeze({ schemaVersion: 1, unlockedArtworkIds: Object.freeze([]), collectedArtworkIds: Object.freeze([]) }),
    collectArtwork: () => Object.freeze({ schemaVersion: 1, unlockedArtworkIds: Object.freeze([]), collectedArtworkIds: Object.freeze([]) }),
    getCollectedCount: () => 0,
    getCollectedCountByTheme: () => 0,
    getUnlockedCountByTheme: () => 0,
    getThemeProgress: (themeId: string) => Object.freeze({ themeId, collected: 0, total: 0, percent: 0 }),
    getTotalProgress: () => Object.freeze({ collected: 0, total: 0, percent: 0 }),
  };
}
