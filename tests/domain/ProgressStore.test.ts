import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_LEVEL_CATALOG } from "../../assets/scripts/domain/config/LevelCatalog.ts";
import {
  completeLevelInProgress,
  createDefaultGameProgress,
  getLevelUnlockStates,
  getHomeSelectionState,
  getRecommendedLevelId,
  isLevelUnlocked,
  selectLevelInProgress,
} from "../../assets/scripts/domain/progress/GameProgress.ts";
import { createProgressStore, DEFAULT_PROGRESS_STORAGE_KEY, MemoryProgressStorage } from "../../assets/scripts/domain/progress/ProgressStore.ts";

describe("ProgressStore", () => {
  it("exposes one unlocked formal level", () => {
    const progress = createDefaultGameProgress();
    const states = getLevelUnlockStates(progress);

    assert.deepEqual(BUILT_IN_LEVEL_CATALOG.map((entry) => entry.levelId), ["level-001"]);
    assert.equal(progress.highestUnlockedLevel, "level-001");
    assert.deepEqual(states.map((state) => state.unlocked), [true]);
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
    assert.equal(store.load().highestUnlockedLevel, "level-001");
  });

  it("resolves Home selection from the valid saved selection", () => {
    const selected = selectLevelInProgress(createDefaultGameProgress(), "level-001");
    assert.deepEqual(getHomeSelectionState(selected), { selectedLevelId: "level-001" });
  });

  it("keeps completion idempotent and does not create a missing next level", () => {
    const first = completeLevelInProgress(createDefaultGameProgress(), "level-001");
    const repeated = completeLevelInProgress(first, "level-001");

    assert.deepEqual(first.completedLevelIds, ["level-001"]);
    assert.equal(first.highestUnlockedLevel, "level-001");
    assert.equal(isLevelUnlocked(first, "level-001"), true);
    assert.deepEqual(repeated, first);
    assert.equal(getRecommendedLevelId(first), "level-001");
  });

  it("recovers defaults from corrupted JSON", () => {
    const storage = new MemoryProgressStorage();
    const store = createProgressStore(storage);
    storage.corrupt();
    assert.deepEqual(store.load(), createDefaultGameProgress());
  });
});
