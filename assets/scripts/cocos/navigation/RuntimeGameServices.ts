import { director, sys } from "cc";
import { BUILT_IN_LEVEL_CATALOG } from "../../domain/config/LevelCatalog";
import { GameNavigator, type GameSceneName, type GameSession, type SceneDriver } from "../../domain/navigation/GameNavigator";
import { createProgressStore, type KeyValueStorage, type ProgressStore } from "../../domain/progress/ProgressStore";

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

const session: GameSession = { currentLevelId: null };
let progressStore: ProgressStore | null = null;
let navigator: GameNavigator | null = null;

export function getRuntimeGameSession(): GameSession {
  return session;
}

export function getRuntimeProgressStore(): ProgressStore {
  if (progressStore === null) {
    progressStore = createProgressStore(new CocosStorageAdapter(), BUILT_IN_LEVEL_CATALOG);
  }
  return progressStore;
}

export function getRuntimeGameNavigator(): GameNavigator {
  if (navigator === null) {
    navigator = new GameNavigator(new CocosSceneDriver(), getRuntimeProgressStore(), session, BUILT_IN_LEVEL_CATALOG);
  }
  return navigator;
}

if (typeof globalThis !== "undefined") {
  (globalThis as { SandArtMatchRuntime?: unknown }).SandArtMatchRuntime = {
    getSession: getRuntimeGameSession,
    getNavigator: getRuntimeGameNavigator,
    getProgressStore: getRuntimeProgressStore,
  };
}
