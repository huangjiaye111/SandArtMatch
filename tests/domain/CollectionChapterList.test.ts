import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ArtworkCatalog } from "../../assets/scripts/artwork/ArtworkCatalog.ts";
import { CollectionChapterListData } from "../../assets/scripts/collection/CollectionChapterListData.ts";
import { createCollectionProgressStore, MemoryCollectionStorage } from "../../assets/scripts/collection/CollectionProgressStore.ts";
import { ThemeCatalog } from "../../assets/scripts/theme/ThemeCatalog.ts";

function createData() {
  return new CollectionChapterListData(createCollectionProgressStore(new MemoryCollectionStorage()));
}

describe("CollectionChapterListData", () => {
  it("aggregates four themes with three artworks each", () => {
    const result = createData().getViewData();
    assert.equal(result.chapters.length, 4);
    assert.deepEqual(result.chapters.map((chapter) => chapter.totalArtworks), [3, 3, 3, 3]);
    assert.deepEqual(result.totalProgress, { totalCollected: 0, totalArtworks: 12 });
  });

  it("marks all chapters locked when no artwork is unlocked", () => {
    assert.deepEqual(createData().getViewData().chapters.map((chapter) => chapter.status), ["locked", "locked", "locked", "locked"]);
  });

  it("maps available and in-progress chapters from artwork progress", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage());
    store.unlockArtwork(ArtworkCatalog.getByTheme("spring-garden")[0].id);
    store.collectArtwork(ArtworkCatalog.getByTheme("beach-holiday")[0].id);
    const chapters = new CollectionChapterListData(store).getViewData().chapters;
    assert.equal(chapters.find((chapter) => chapter.themeId === "spring-garden")?.status, "available");
    assert.equal(chapters.find((chapter) => chapter.themeId === "beach-holiday")?.status, "in-progress");
    assert.equal(chapters.find((chapter) => chapter.themeId === "cozy-home")?.status, "locked");
  });

  it("marks a chapter completed after all of its artworks are collected", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage());
    for (const artwork of ArtworkCatalog.getByTheme("spring-garden")) store.collectArtwork(artwork.id);
    assert.equal(new CollectionChapterListData(store).getViewData().chapters[0].status, "completed");
  });

  it("sorts unlocked chapters before locked chapters while preserving theme order", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage());
    store.unlockArtwork(ArtworkCatalog.getByTheme("cloud-dream")[0].id);
    store.unlockArtwork(ArtworkCatalog.getByTheme("spring-garden")[0].id);
    assert.deepEqual(new CollectionChapterListData(store).getViewData().chapters.map((chapter) => chapter.themeId), ["spring-garden", "cloud-dream", "beach-holiday", "cozy-home"]);
  });

  it("handles an empty artwork catalog without throwing", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), []);
    const result = new CollectionChapterListData(store, { artworks: [] }).getViewData();
    assert.equal(result.chapters.length, ThemeCatalog.getAll().length);
    assert.deepEqual(result.totalProgress, { totalCollected: 0, totalArtworks: 0 });
  });
});
