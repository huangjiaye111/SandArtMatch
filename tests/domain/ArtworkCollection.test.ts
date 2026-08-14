import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ArtworkCatalog } from "../../assets/scripts/artwork/ArtworkCatalog.ts";
import { createCollectionProgressStore, MemoryCollectionStorage } from "../../assets/scripts/collection/CollectionProgressStore.ts";
import { assertCatalogIntegrity, BUILT_IN_LEVEL_CATALOG, LevelCatalog } from "../../assets/scripts/domain/config/LevelCatalog.ts";
import { createProgressStore, MemoryProgressStorage } from "../../assets/scripts/domain/progress/ProgressStore.ts";
import { createProgressionService } from "../../assets/scripts/domain/progression/ProgressionService.ts";
import { ThemeCatalog } from "../../assets/scripts/theme/ThemeCatalog.ts";

describe("Artwork and collection progression", () => {
  it("returns spring-garden artwork in stable order", () => {
    assert.deepEqual(ArtworkCatalog.getByTheme("spring-garden").map((artwork) => artwork.id), [
      "spring-cat-001",
      "spring-rabbit-001",
      "spring-dog-001",
    ]);
    assert.equal(ArtworkCatalog.getByOrder("spring-garden", 1)?.id, "spring-cat-001");
  });

  it("defines artwork for all four themes", () => {
    for (const theme of ThemeCatalog.getAll()) {
      assert.equal(ArtworkCatalog.getCountByTheme(theme.id), 3);
    }
  });

  it("handles invalid artwork ids safely and warns", () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown): void => {
      warnings.push(String(message));
    };

    try {
      assert.equal(ArtworkCatalog.getById("missing-artwork"), null);
      assert.equal(ArtworkCatalog.has("missing-artwork"), false);
      assert.equal(warnings.length, 1);
      assert.equal(warnings[0].includes("missing-artwork"), true);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("validates level artwork ids and matching theme ids", () => {
    assertCatalogIntegrity();
    for (const level of LevelCatalog.getAll()) {
      const artwork = ArtworkCatalog.getById(level.artworkId);
      assert.equal(artwork === null, false);
      assert.equal(artwork?.themeId, level.themeId);
    }
  });

  it("maps the four development levels to the first artwork in each theme", () => {
    assert.deepEqual(BUILT_IN_LEVEL_CATALOG.map((level) => [level.levelId, level.themeId, level.artworkId]), [
      ["level-001", "spring-garden", "spring-cat-001"],
      ["level-002", "beach-holiday", "beach-cat-001"],
      ["level-003", "cozy-home", "cozy-cat-001"],
      ["level-004", "cloud-dream", "cloud-cat-001"],
    ]);
  });

  it("completes level-001, collects its artwork, and unlocks level-002 artwork", () => {
    const progressStore = createProgressStore(new MemoryProgressStorage());
    const collectionStore = createCollectionProgressStore(new MemoryCollectionStorage());
    const service = createProgressionService(progressStore, collectionStore);

    const result = service.completeLevel("level-001");

    assert.deepEqual(result.progress.completedLevelIds, ["level-001"]);
    assert.equal(progressStore.isLevelCompleted("level-001"), true);
    assert.equal(progressStore.isLevelUnlocked("level-002"), true);
    assert.equal(collectionStore.isArtworkCollected("spring-cat-001"), true);
    assert.equal(collectionStore.isArtworkUnlocked("beach-cat-001"), true);
  });

  it("reports theme progress correctly", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage());
    store.collectArtwork("spring-cat-001");

    assert.deepEqual(store.getThemeProgress("spring-garden"), {
      themeId: "spring-garden",
      collected: 1,
      total: 3,
      percent: 1 / 3,
    });
  });

  it("keeps repeated collection idempotent", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage());
    store.collectArtwork("spring-cat-001");
    store.collectArtwork("spring-cat-001");

    assert.equal(store.getCollectedCount(), 1);
    assert.deepEqual(store.load().collectedArtworkIds, ["spring-cat-001"]);
  });

  it("distinguishes locked, unlocked, and collected artwork states", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage());

    assert.equal(store.isArtworkUnlocked("spring-rabbit-001"), false);
    assert.equal(store.isArtworkCollected("spring-rabbit-001"), false);

    store.unlockArtwork("spring-rabbit-001");
    assert.equal(store.isArtworkUnlocked("spring-rabbit-001"), true);
    assert.equal(store.isArtworkCollected("spring-rabbit-001"), false);

    store.collectArtwork("spring-rabbit-001");
    assert.equal(store.isArtworkUnlocked("spring-rabbit-001"), true);
    assert.equal(store.isArtworkCollected("spring-rabbit-001"), true);
  });

  it("calculates total collection progress", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage());
    store.collectArtwork("spring-cat-001");
    store.collectArtwork("beach-cat-001");

    assert.deepEqual(store.getTotalProgress(), {
      collected: 2,
      total: 12,
      percent: 2 / 12,
    });
  });
});
