import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_LEVEL_CATALOG } from "../../assets/scripts/domain/config/LevelCatalog.ts";
import { GameNavigator, type GameSceneName, type SceneDriver } from "../../assets/scripts/domain/navigation/GameNavigator.ts";
import { completeLevelInProgress, createDefaultGameProgress, selectLevelInProgress } from "../../assets/scripts/domain/progress/GameProgress.ts";
import { createProgressStore, MemoryProgressStorage } from "../../assets/scripts/domain/progress/ProgressStore.ts";
import { ThemeCatalog } from "../../assets/scripts/theme/ThemeCatalog.ts";
import { createThemeRuntime } from "../../assets/scripts/theme/ThemeRuntime.ts";

class RecordingSceneDriver implements SceneDriver {
  public readonly loads: GameSceneName[] = [];
  public gate: Promise<void> | null = null;

  public async loadScene(sceneName: GameSceneName): Promise<void> {
    this.loads.push(sceneName);
    if (this.gate !== null) {
      await this.gate;
    }
  }
}

function createNavigator() {
  const storage = new MemoryProgressStorage();
  const store = createProgressStore(storage);
  const driver = new RecordingSceneDriver();
  const session = { selectedLevelId: null, currentLevelId: null, currentThemeId: null };
  const navigator = new GameNavigator(driver, store, session);
  return { driver, navigator, session, store };
}

describe("GameNavigator", () => {
  it("routes Home to the only formal Battle level", async () => {
    const { driver, navigator, session, store } = createNavigator();

    assert.equal((await navigator.goHome()).accepted, true);
    assert.equal((await navigator.startLevel("level-001")).accepted, true);

    assert.deepEqual(driver.loads, ["Home", "Battle"]);
    assert.equal(session.currentLevelId, "level-001");
    assert.equal(store.load().lastSelectedLevelId, "level-001");
  });

  it("rejects locked levels even if UI is bypassed", async () => {
    const { driver, navigator } = createNavigator();
    const result = await navigator.startLevel("level-002");
    assert.equal(result.accepted, false);
    assert.equal(result.reason, "levelLocked");
    assert.deepEqual(driver.loads, []);
  });

  it("unlocks and starts the next catalog level after victory", async () => {
    const { navigator, session } = createNavigator();
    await navigator.startLevel("level-001");

    const victory = navigator.completeCurrentLevelVictory();
    const next = await navigator.startNextLevel();

    assert.equal(victory.nextLevelId, "level-002");
    assert.equal(victory.canStartNext, true);
    assert.equal(next.accepted, true);
    assert.equal(next.levelId, "level-002");
    assert.equal(session.currentLevelId, "level-002");
    assert.equal(session.currentThemeId, "beach-holiday");
  });

  it("replays without changing progress", async () => {
    const { navigator, store } = createNavigator();
    await navigator.startLevel("level-001");
    const before = store.load();
    const replay = await navigator.replayCurrentLevel();

    assert.equal(replay.accepted, true);
    assert.deepEqual(store.load(), before);
  });

  it("only accepts one rapid navigation while a scene load is in flight", async () => {
    const { driver, navigator } = createNavigator();
    let release!: () => void;
    driver.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = navigator.goHome();
    const second = await navigator.startLevel("level-001");
    release();

    assert.equal((await first).accepted, true);
    assert.equal(second.accepted, false);
    assert.equal(second.reason, "navigationInFlight");
    assert.deepEqual(driver.loads, ["Home"]);
  });

  it("continues from a valid selected level and falls back to level-001", async () => {
    const { navigator, session, store } = createNavigator();
    store.save(selectLevelInProgress(createDefaultGameProgress(), "level-001"));
    await navigator.continueOrStartFirstLevel();
    assert.equal(session.currentLevelId, "level-001");

    store.save({ ...store.load(), lastSelectedLevelId: "missing-level" });
    session.currentLevelId = null;
    session.currentThemeId = null;
    await navigator.continueOrStartFirstLevel();
    assert.equal(session.currentLevelId, "level-001");
  });

  it("saves idempotent victory and returns Home through the navigator", async () => {
    const { driver, navigator, session, store } = createNavigator();
    await navigator.startLevel(BUILT_IN_LEVEL_CATALOG[0].levelId);
    const first = navigator.completeCurrentLevelVictory();
    const repeated = navigator.completeCurrentLevelVictory();
    const home = await navigator.goHome();

    assert.equal(first.progress.completedLevelIds.length, 1);
    assert.deepEqual(repeated.progress.completedLevelIds, ["level-001"]);
    assert.equal(home.accepted, true);
    assert.equal(session.currentLevelId, "level-001");
    assert.deepEqual(store.load().completedLevelIds, ["level-001"]);
    assert.deepEqual(driver.loads, ["Battle", "Home"]);
  });

  it("returns a safe missingNextLevel result on the final level", async () => {
    const { navigator, store } = createNavigator();
    store.unlockLevel("level-004");
    await navigator.startLevel("level-004");

    const victory = navigator.completeCurrentLevelVictory();
    const next = await navigator.startNextLevel();

    assert.equal(victory.nextLevelId, null);
    assert.equal(victory.canStartNext, false);
    assert.equal(next.accepted, false);
    assert.equal(next.reason, "missingNextLevel");
  });

  it("derives the current theme from the selected catalog level", async () => {
    const { navigator, session, store } = createNavigator();
    store.unlockLevel("level-003");
    await navigator.startLevel("level-003");

    assert.equal(session.selectedLevelId, "level-003");
    assert.equal(session.currentLevelId, "level-003");
    assert.equal(session.currentThemeId, "cozy-home");
    assert.equal(navigator.getCurrentTheme()?.id, "cozy-home");
    assert.equal(createThemeRuntime(session).getCurrentTheme().id, "cozy-home");
  });

  it("falls back safely for an invalid theme id and warns", () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown): void => {
      warnings.push(String(message));
    };

    try {
      const theme = ThemeCatalog.get("missing-theme");
      assert.equal(theme.id, "spring-garden");
      assert.equal(warnings.length, 1);
      assert.equal(warnings[0].includes("missing-theme"), true);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("keeps legacy invalid IDs normalized by the catalog", () => {
    const { store } = createNavigator();
    store.save({
      schemaVersion: 1,
      highestUnlockedLevel: "sand-003",
      completedLevelIds: ["sand-001", "level-001"],
      lastSelectedLevelId: "sand-002",
    });

    assert.deepEqual(store.load(), {
      schemaVersion: 1,
      highestUnlockedLevel: "level-001",
      completedLevelIds: ["level-001"],
      lastSelectedLevelId: null,
    });
  });
});
