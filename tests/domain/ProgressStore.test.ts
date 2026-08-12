import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_LEVEL_CATALOG, LevelCatalog, type LevelCatalog as LevelCatalogData } from "../../assets/scripts/domain/config/LevelCatalog.ts";
import {
  completeLevelInProgress,
  createDefaultGameProgress,
  getLevelUnlockStates,
  getHomeSelectionState,
  getContinueLevelId,
  getRecommendedLevelId,
  isLevelUnlocked,
  selectLevelInProgress,
} from "../../assets/scripts/domain/progress/GameProgress.ts";
import { createProgressStore, DEFAULT_PROGRESS_STORAGE_KEY, MemoryProgressStorage } from "../../assets/scripts/domain/progress/ProgressStore.ts";

describe("ProgressStore", () => {
  const multiLevelCatalog: LevelCatalogData = BUILT_IN_LEVEL_CATALOG;

  it("exposes the four development levels with only level-001 unlocked by default", () => {
    const progress = createDefaultGameProgress();
    const states = getLevelUnlockStates(progress);

    assert.deepEqual(BUILT_IN_LEVEL_CATALOG.map((entry) => entry.levelId), ["level-001", "level-002", "level-003", "level-004"]);
    assert.deepEqual(BUILT_IN_LEVEL_CATALOG.map((entry) => entry.themeId), ["spring-garden", "beach-holiday", "cozy-home", "cloud-dream"]);
    assert.equal(progress.highestUnlockedLevel, "level-001");
    assert.deepEqual(states.map((state) => state.unlocked), [true, false, false, false]);
    assert.deepEqual(progress.completedLevelIds, []);
  });

  it("normalizes legacy IDs without throwing", () => {
    const storage = new MemoryProgressStorage();
    const store = createProgressStore(storage);
    storage.setItem(DEFAULT_PROGRESS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      highestUnlockedLevel: "sand-003",
      completedLevelIds: ["sand-001", "sand-002"],
      lastSelectedLevelId: "sand-003",
    }));

    assert.deepEqual(store.load(), createDefaultGameProgress());
  });

  it("saves and reloads selected and completed level-001", () => {
    const storage = new MemoryProgressStorage();
    const store = createProgressStore(storage);
    const selected = selectLevelInProgress(createDefaultGameProgress(), "level-001");
    store.save(selected);
    assert.deepEqual(store.load(), selected);

    const completed = completeLevelInProgress(store.load(), "level-001");
    store.save(completed);
    assert.deepEqual(store.load().completedLevelIds, ["level-001"]);
    assert.equal(store.load().highestUnlockedLevel, "level-002");
    assert.equal(store.isLevelUnlocked("level-002"), true);
    assert.equal(store.isLevelCompleted("level-001"), true);
    assert.equal(store.getHighestUnlockedLevel(), "level-002");
  });

  it("resolves Home selection from the valid saved selection", () => {
    const selected = selectLevelInProgress(createDefaultGameProgress(), "level-001");
    assert.deepEqual(getHomeSelectionState(selected), { selectedLevelId: "level-001" });
  });

  it("falls back to the highest unlocked level before the first catalog entry", () => {
    const staleSelection = {
      schemaVersion: 1,
      highestUnlockedLevel: "level-003",
      completedLevelIds: [],
      lastSelectedLevelId: "missing-level",
    };

    assert.equal(getRecommendedLevelId(staleSelection, multiLevelCatalog), "level-001");
    assert.equal(getContinueLevelId(staleSelection, multiLevelCatalog), "level-003");
  });

  it("keeps completion idempotent and unlocks the catalog next level", () => {
    const first = completeLevelInProgress(createDefaultGameProgress(), "level-001");
    const repeated = completeLevelInProgress(first, "level-001");

    assert.deepEqual(first.completedLevelIds, ["level-001"]);
    assert.equal(first.highestUnlockedLevel, "level-002");
    assert.equal(isLevelUnlocked(first, "level-001"), true);
    assert.equal(isLevelUnlocked(first, "level-002"), true);
    assert.deepEqual(repeated, first);
    assert.equal(getRecommendedLevelId(first), "level-002");
  });

  it("supports ordered catalog navigation without hard-coded level id math", () => {
    assert.equal(LevelCatalog.getByOrder(2)?.levelId, "level-002");
    assert.equal(LevelCatalog.getNextLevel("level-003")?.levelId, "level-004");
    assert.equal(LevelCatalog.getPreviousLevel("level-003")?.levelId, "level-002");
    assert.equal(LevelCatalog.getNextLevel("level-004"), null);
    assert.equal(LevelCatalog.getCount(), 4);
  });

  it("recovers defaults from corrupted JSON", () => {
    const storage = new MemoryProgressStorage();
    const store = createProgressStore(storage);
    storage.corrupt();
    assert.deepEqual(store.load(), createDefaultGameProgress());
  });
});
