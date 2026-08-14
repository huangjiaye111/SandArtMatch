import type { LevelCatalogEntry } from "../domain/config/LevelCatalog";
import type { ProgressStore } from "../domain/progress/ProgressStore";

export type HomeLevelStatus = "locked" | "unlocked" | "completed";

export interface HomeLevelData {
  readonly levelId: string;
  readonly displayName: string;
  readonly themeId: string;
  readonly status: HomeLevelStatus;
  readonly isCurrent: boolean;
}

export interface HomeViewData {
  readonly currentStamina: number;
  readonly currentCoins: number;
  readonly acquireEntries: readonly HomeAcquireEntryData[];
  readonly placeholderEntries: readonly HomePlaceholderEntryData[];
  readonly levels: readonly HomeLevelData[];
  readonly selectedLevelId: string | null;
  readonly canPlay: boolean;
}

export type HomeAcquireEntryAction = "stamina" | "coins";
export type HomePlaceholderEntryAction = "shop";

export interface HomeAcquireEntryData {
  readonly action: HomeAcquireEntryAction;
  readonly displayName: string;
  readonly valueText: string;
  readonly locked: boolean;
  readonly rewardHint: string;
}

export interface HomePlaceholderEntryData {
  readonly action: HomePlaceholderEntryAction;
  readonly displayName: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly featureGate: string;
  readonly message: string;
}

export interface HomeLevelCatalogRef {
  getAll(): readonly LevelCatalogEntry[];
}

export interface HomeResourceStoreRef {
  getCurrentStamina(): number;
  getCurrentCoins(): number;
}

export class HomeData {
  private readonly levelCatalog: HomeLevelCatalogRef;
  private readonly progressStore: ProgressStore;
  private readonly resourceStore: HomeResourceStoreRef;
  private selectedLevelId: string | null = null;

  public constructor(levelCatalog: HomeLevelCatalogRef, progressStore: ProgressStore, resourceStore: HomeResourceStoreRef) {
    this.levelCatalog = levelCatalog;
    this.progressStore = progressStore;
    this.resourceStore = resourceStore;
    this.selectedLevelId = this.getDefaultSelectedLevelId();
  }

  public getViewData(): HomeViewData {
    const selectedLevelId = this.getValidSelectedLevelId();
    const currentStamina = this.resourceStore.getCurrentStamina();
    const currentCoins = this.resourceStore.getCurrentCoins();
    const levels = this.getLevelEntries().map((entry) => {
      const status = this.getLevelStatus(entry.levelId);
      return Object.freeze({
        levelId: entry.levelId,
        displayName: formatLevelDisplayName(entry),
        themeId: entry.themeId,
        status,
        isCurrent: entry.levelId === selectedLevelId,
      });
    });
    const selected = levels.find((level) => level.isCurrent) ?? null;

    return Object.freeze({
      currentStamina,
      currentCoins,
      acquireEntries: createAcquireEntries(currentStamina, currentCoins),
      placeholderEntries: createPlaceholderEntries(),
      levels: Object.freeze(levels),
      selectedLevelId,
      canPlay: selected !== null && selected.status !== "locked",
    });
  }

  public selectLevel(levelId: string): HomeViewData {
    const target = this.getLevelEntries().find((entry) => entry.levelId === levelId);
    if (target === undefined || this.getLevelStatus(levelId) === "locked") {
      return this.getViewData();
    }
    this.selectedLevelId = levelId;
    return this.getViewData();
  }

  public getSelectedLevel(): HomeLevelData | null {
    return this.getViewData().levels.find((level) => level.isCurrent) ?? null;
  }

  private getDefaultSelectedLevelId(): string | null {
    const levels = this.getLevelEntries();
    return levels.find((entry) => this.getLevelStatus(entry.levelId) !== "locked")?.levelId ?? levels[0]?.levelId ?? null;
  }

  private getValidSelectedLevelId(): string | null {
    const levels = this.getLevelEntries();
    if (this.selectedLevelId !== null && levels.some((entry) => entry.levelId === this.selectedLevelId)) {
      return this.selectedLevelId;
    }
    this.selectedLevelId = this.getDefaultSelectedLevelId();
    return this.selectedLevelId;
  }

  private getLevelEntries(): readonly LevelCatalogEntry[] {
    return Object.freeze([...this.levelCatalog.getAll()].sort((left, right) => left.order - right.order));
  }

  private getLevelStatus(levelId: string): HomeLevelStatus {
    if (this.progressStore.isLevelCompleted(levelId)) {
      return "completed";
    }
    if (this.progressStore.isLevelUnlocked(levelId)) {
      return "unlocked";
    }
    return "locked";
  }
}

function createPlaceholderEntries(): readonly HomePlaceholderEntryData[] {
  return Object.freeze([
    Object.freeze({
      action: "shop" as const,
      displayName: "Shop",
      visible: true,
      enabled: false,
      featureGate: "shop-placeholder",
      message: "Shop is not active yet",
    }),
  ]);
}

function formatLevelDisplayName(entry: LevelCatalogEntry): string {
  return `Level ${entry.displayNumber}`;
}

function createAcquireEntries(currentStamina: number, currentCoins: number): readonly HomeAcquireEntryData[] {
  return Object.freeze([
    Object.freeze({
      action: "stamina",
      displayName: "Stamina",
      valueText: `${Math.max(0, currentStamina).toString()}`,
      locked: currentStamina <= 0,
      rewardHint: currentStamina <= 0 ? "Watch to refill" : "Ready to spend",
    }),
    Object.freeze({
      action: "coins",
      displayName: "Coins",
      valueText: `${Math.max(0, currentCoins).toString()}`,
      locked: currentCoins <= 0,
      rewardHint: currentCoins <= 0 ? "Claim coins" : "Ready to spend",
    }),
  ]);
}
