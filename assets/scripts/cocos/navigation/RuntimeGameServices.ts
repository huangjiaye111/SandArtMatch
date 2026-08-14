import { director, sys } from "cc";
import { createCollectionProgressStore, type CollectionProgressStore } from "../../collection/CollectionProgressStore";
import { BUILT_IN_LEVEL_CATALOG } from "../../domain/config/LevelCatalog";
import { GameNavigator, type GameSceneName, type GameSession, type SceneDriver } from "../../domain/navigation/GameNavigator";
import { createProgressStore, type KeyValueStorage, type ProgressStore } from "../../domain/progress/ProgressStore";
import { createProgressionService } from "../../domain/progression/ProgressionService";
import { SettingsData } from "../../settings/SettingsData";
import type { AdService } from "../../services/AdService";
import { MockAdService } from "../../services/MockAdService";
import { createFeatureFlags, type FeatureFlagsData } from "../../services/FeatureFlags";

export interface RuntimeResourceStore {
  getCurrentStamina(): number;
  getCurrentCoins(): number;
  addStamina(amount: number): void;
  addCoins(amount: number): void;
}

class CocosStorageAdapter implements KeyValueStorage {
  public getItem(key: string): string | null {
    return sys.localStorage.getItem(key);
  }

  public setItem(key: string, value: string): void {
    sys.localStorage.setItem(key, value);
  }

  public removeItem(key: string): void {
    sys.localStorage.removeItem(key);
  }
}

class CocosSceneDriver implements SceneDriver {
  public async loadScene(sceneName: GameSceneName): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      director.loadScene(sceneName, (error) => {
        if (error !== null) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        resolve();
      });
    });
  }
}

class CocosResourceStore implements RuntimeResourceStore {
  private static readonly staminaKey = "sand-art-match-resource-stamina";
  private static readonly coinsKey = "sand-art-match-resource-coins";
  private readonly storage = new CocosStorageAdapter();

  public getCurrentStamina(): number {
    return this.getNumber(CocosResourceStore.staminaKey, 5);
  }

  public getCurrentCoins(): number {
    return this.getNumber(CocosResourceStore.coinsKey, 100);
  }

  public addStamina(amount: number): void {
    this.setNumber(CocosResourceStore.staminaKey, this.getCurrentStamina() + amount);
  }

  public addCoins(amount: number): void {
    this.setNumber(CocosResourceStore.coinsKey, this.getCurrentCoins() + amount);
  }

  private getNumber(key: string, fallback: number): number {
    const raw = this.storage.getItem(key);
    if (raw === null) {
      this.storage.setItem(key, `${fallback}`);
      return fallback;
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) {
      this.storage.setItem(key, `${fallback}`);
      return fallback;
    }
    return Math.max(0, value);
  }

  private setNumber(key: string, value: number): void {
    this.storage.setItem(key, `${Math.max(0, Math.floor(value))}`);
  }
}

const session: GameSession = { selectedLevelId: null, currentLevelId: null };
let progressStore: ProgressStore | null = null;
let collectionStore: CollectionProgressStore | null = null;
let settingsData: SettingsData | null = null;
let adService: AdService | null = null;
let featureFlags: FeatureFlagsData = createFeatureFlags();
let navigator: GameNavigator | null = null;
let resourceStore: RuntimeResourceStore | null = null;

export function getRuntimeGameSession(): GameSession {
  return session;
}

export function getRuntimeProgressStore(): ProgressStore {
  if (progressStore === null) {
    progressStore = createProgressStore(new CocosStorageAdapter(), BUILT_IN_LEVEL_CATALOG);
  }
  return progressStore;
}

export function getRuntimeCollectionProgressStore(): CollectionProgressStore {
  if (collectionStore === null) {
    collectionStore = createCollectionProgressStore(new CocosStorageAdapter());
  }
  return collectionStore;
}

export function getRuntimeSettingsData(): SettingsData {
  if (settingsData === null) {
    settingsData = new SettingsData(new CocosStorageAdapter());
  }
  return settingsData;
}

export function getRuntimeAdService(): AdService {
  if (adService === null) {
    adService = new MockAdService({ logger: () => {} });
  }
  return adService;
}

export function getRuntimeResourceStore(): RuntimeResourceStore {
  if (resourceStore === null) {
    resourceStore = new CocosResourceStore();
  }
  return resourceStore;
}

export function getRuntimeFeatureFlags(): FeatureFlagsData {
  return featureFlags;
}

export function setRuntimeFeatureFlags(flags: Partial<FeatureFlagsData>): FeatureFlagsData {
  featureFlags = createFeatureFlags(flags);
  return featureFlags;
}

export function getRuntimeGameNavigator(): GameNavigator {
  if (navigator === null) {
    const runtimeProgressStore = getRuntimeProgressStore();
    navigator = new GameNavigator(
      new CocosSceneDriver(),
      runtimeProgressStore,
      session,
      BUILT_IN_LEVEL_CATALOG,
      createProgressionService(runtimeProgressStore, getRuntimeCollectionProgressStore(), BUILT_IN_LEVEL_CATALOG),
    );
  }
  return navigator;
}

if (typeof globalThis !== "undefined") {
  (globalThis as { SandArtMatchRuntime?: unknown }).SandArtMatchRuntime = {
    getSession: getRuntimeGameSession,
    getNavigator: getRuntimeGameNavigator,
    getProgressStore: getRuntimeProgressStore,
    getCollectionProgressStore: getRuntimeCollectionProgressStore,
    getSettingsData: getRuntimeSettingsData,
    getAdService: getRuntimeAdService,
    getResourceStore: getRuntimeResourceStore,
    getFeatureFlags: getRuntimeFeatureFlags,
    setFeatureFlags: setRuntimeFeatureFlags,
  };
}
