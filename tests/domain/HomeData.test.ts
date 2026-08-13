import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LevelCatalogEntry } from "../../assets/scripts/domain/config/LevelCatalog.ts";
import { createProgressStore, MemoryProgressStorage } from "../../assets/scripts/domain/progress/ProgressStore.ts";
import { HomeData, type HomeResourceStoreRef } from "../../assets/scripts/home/HomeData.ts";

const LEVELS: readonly LevelCatalogEntry[] = Object.freeze([
  createLevel("level-001", 1, true),
  createLevel("level-002", 2, false),
  createLevel("level-003", 3, false),
]);

describe("HomeData", () => {
  it("aggregates levels and maps locked, unlocked, and completed status", () => {
    const store = createProgressStore(new MemoryProgressStorage(), LEVELS);
    store.completeLevel("level-001");

    const result = createData(store).getViewData();

    assert.deepEqual(result.levels.map((level) => level.levelId), ["level-001", "level-002", "level-003"]);
    assert.deepEqual(result.levels.map((level) => level.status), ["completed", "unlocked", "locked"]);
    assert.deepEqual(result.levels.map((level) => level.displayName), ["Level 1", "Level 2", "Level 3"]);
  });

  it("selects the first unlocked level by default", () => {
    const result = createData().getViewData();

    assert.equal(result.selectedLevelId, "level-001");
    assert.equal(result.levels[0].isCurrent, true);
  });

  it("updates selected state when selectLevel is called", () => {
    const store = createProgressStore(new MemoryProgressStorage(), LEVELS);
    store.unlockLevel("level-002");
    const data = createData(store);

    const result = data.selectLevel("level-002");

    assert.equal(result.selectedLevelId, "level-002");
    assert.equal(data.getSelectedLevel()?.levelId, "level-002");
    assert.deepEqual(result.levels.map((level) => level.isCurrent), [false, true, false]);
  });

  it("keeps locked levels from being selected", () => {
    const data = createData();

    const result = data.selectLevel("level-003");

    assert.equal(result.selectedLevelId, "level-001");
    assert.equal(result.canPlay, true);
  });

  it("sets canPlay true for unlocked and completed levels", () => {
    const store = createProgressStore(new MemoryProgressStorage(), LEVELS);
    store.completeLevel("level-001");
    const data = createData(store);

    assert.equal(data.getViewData().canPlay, true);
    assert.equal(data.selectLevel("level-002").canPlay, true);
  });

  it("reads stamina and coins from the resource store", () => {
    const result = createData(undefined, { stamina: 7, coins: 123 }).getViewData();

    assert.equal(result.currentStamina, 7);
    assert.equal(result.currentCoins, 123);
  });

  it("sets canPlay false when every level is locked", () => {
    const lockedLevels: readonly LevelCatalogEntry[] = Object.freeze([
      createLevel("level-010", 10, false),
      createLevel("level-011", 11, false),
    ]);
    const result = createData(createProgressStub(), undefined, lockedLevels).getViewData();

    assert.equal(result.selectedLevelId, "level-010");
    assert.equal(result.canPlay, false);
    assert.deepEqual(result.levels.map((level) => level.status), ["locked", "locked"]);
  });

  it("handles an empty level list without throwing", () => {
    const data = new HomeData(createCatalog([]), createProgressStub(), createResourceStore());
    const result = data.getViewData();

    assert.deepEqual(result.levels, []);
    assert.equal(result.selectedLevelId, null);
    assert.equal(result.canPlay, false);
  });
});

function createData(
  store = createProgressStore(new MemoryProgressStorage(), LEVELS),
  resources?: { readonly stamina: number; readonly coins: number },
  levels: readonly LevelCatalogEntry[] = LEVELS,
): HomeData {
  return new HomeData(createCatalog(levels), store, createResourceStore(resources));
}

function createCatalog(levels: readonly LevelCatalogEntry[]) {
  return Object.freeze({
    getAll(): readonly LevelCatalogEntry[] {
      return Object.freeze([...levels]);
    },
  });
}

function createResourceStore(resources: { readonly stamina: number; readonly coins: number } = { stamina: 5, coins: 88 }): HomeResourceStoreRef {
  return Object.freeze({
    getCurrentStamina(): number {
      return resources.stamina;
    },
    getCurrentCoins(): number {
      return resources.coins;
    },
  });
}

function createProgressStub() {
  return Object.freeze({
    load(): never {
      throw new Error("Not used.");
    },
    save(): void {},
    reset(): void {},
    isLevelUnlocked(): boolean {
      return false;
    },
    isLevelCompleted(): boolean {
      return false;
    },
    completeLevel(): never {
      throw new Error("Not used.");
    },
    unlockLevel(): never {
      throw new Error("Not used.");
    },
    getHighestUnlockedLevel(): string {
      return "";
    },
  });
}

function createLevel(levelId: string, order: number, initialUnlocked: boolean): LevelCatalogEntry {
  return Object.freeze({
    levelId,
    id: levelId,
    displayNumber: order,
    order,
    configLevelId: 1,
    themeId: "spring-garden",
    artworkId: "spring-cat-001",
    initialUnlocked,
    nextLevelId: null,
  });
}
