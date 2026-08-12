import { BUILT_IN_LEVEL_CATALOG, getFirstLevelEntry, getLevelCatalogEntry, LevelCatalog, type LevelCatalog as LevelCatalogData, type LevelCatalogEntry } from "../config/LevelCatalog";
import type { ThemeConfig, ThemeId } from "../../theme/ThemeTypes";
import { ThemeCatalog } from "../../theme/ThemeCatalog";
import {
  completeLevelInProgress,
  getContinueLevelId,
  isLevelUnlocked,
  selectLevelInProgress,
  type GameProgress,
} from "../progress/GameProgress";
import type { ProgressStore } from "../progress/ProgressStore";

export type GameSceneName = "Home" | "Battle";

export interface SceneDriver {
  loadScene(sceneName: GameSceneName): Promise<void>;
}

export interface GameSession {
  selectedLevelId: string | null;
  currentLevelId: string | null;
  currentThemeId: ThemeId | null;
}

export interface NavigationResult {
  readonly accepted: boolean;
  readonly sceneName: GameSceneName | null;
  readonly levelId: string | null;
  readonly reason?: string;
}

export interface VictoryProgressResult {
  readonly progress: GameProgress;
  readonly nextLevelId: string | null;
  readonly canStartNext: boolean;
}

export class GameNavigator {
  private navigationInFlight = false;
  private readonly driver: SceneDriver;
  private readonly progressStore: ProgressStore;
  private readonly session: GameSession;
  private readonly catalog: LevelCatalogData;

  public constructor(
    driver: SceneDriver,
    progressStore: ProgressStore,
    session: GameSession,
    catalog: LevelCatalogData = BUILT_IN_LEVEL_CATALOG,
  ) {
    this.driver = driver;
    this.progressStore = progressStore;
    this.session = session;
    this.catalog = catalog;
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
    const progress = completeLevelInProgress(this.progressStore.load(), currentLevelId, this.catalog);
    this.progressStore.save(progress);
    const nextLevelId = LevelCatalog.getNextLevel(currentLevelId, this.catalog)?.levelId ?? null;
    return Object.freeze({
      progress,
      nextLevelId,
      canStartNext: nextLevelId !== null && isLevelUnlocked(progress, nextLevelId, this.catalog),
    });
  }

  public resetProgress(): void {
    this.progressStore.reset();
    this.session.selectedLevelId = null;
    this.session.currentLevelId = null;
    this.session.currentThemeId = null;
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
    this.session.currentThemeId = level.themeId;
  }
}
