import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ArtworkDefinition } from "../../assets/scripts/artwork/ArtworkTypes.ts";
import { CollectionArtworkListData } from "../../assets/scripts/collection/CollectionArtworkListData.ts";
import { createCollectionProgressStore, MemoryCollectionStorage } from "../../assets/scripts/collection/CollectionProgressStore.ts";
import type { ThemeConfig } from "../../assets/scripts/theme/ThemeTypes.ts";

const THEMES: readonly ThemeConfig[] = Object.freeze([
  Object.freeze({ id: "spring-garden", displayName: "Spring Garden" }),
  Object.freeze({ id: "beach-holiday", displayName: "Beach Holiday" }),
]);

const ARTWORKS: readonly ArtworkDefinition[] = Object.freeze([
  Object.freeze({ id: "spring-003", themeId: "spring-garden", displayName: "Spring Three", order: 3 }),
  Object.freeze({ id: "spring-001", themeId: "spring-garden", displayName: "Spring One", order: 1, thumbnailKey: "thumb.spring.one" }),
  Object.freeze({ id: "spring-002", themeId: "spring-garden", displayName: "Spring Two", order: 2 }),
  Object.freeze({ id: "beach-001", themeId: "beach-holiday", displayName: "Beach One", order: 1 }),
]);

describe("CollectionArtworkListData", () => {
  it("returns the artwork list for the given theme", () => {
    const data = createData();
    const result = data.getViewData("spring-garden");

    assert.equal(result.artworks.length, 3);
    assert.deepEqual(result.artworks.map((artwork) => artwork.artworkId), ["spring-001", "spring-002", "spring-003"]);
  });

  it("sorts artworks by order ascending", () => {
    const result = createData().getViewData("spring-garden");

    assert.deepEqual(result.artworks.map((artwork) => artwork.order), [1, 2, 3]);
  });

  it("maps locked, unlocked, and collected artwork statuses", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.unlockArtwork("spring-002");
    store.collectArtwork("spring-003");

    const result = createData(store).getViewData("spring-garden");

    assert.deepEqual(result.artworks.map((artwork) => artwork.status), ["locked", "unlocked", "collected"]);
    assert.equal(result.artworks[0].displayName, "???");
    assert.equal(result.artworks[0].thumbnailKey, undefined);
    assert.equal(result.artworks[1].displayName, "Spring Two");
    assert.equal(result.artworks[2].displayName, "Spring Three");
  });

  it("calculates collection progress as 0/3", () => {
    assert.deepEqual(createData().getViewData("spring-garden").progress, { collectedCount: 0, totalArtworks: 3 });
  });

  it("calculates collection progress as 1/3", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.collectArtwork("spring-001");

    assert.deepEqual(createData(store).getViewData("spring-garden").progress, { collectedCount: 1, totalArtworks: 3 });
  });

  it("calculates collection progress as 3/3", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.collectArtwork("spring-001");
    store.collectArtwork("spring-002");
    store.collectArtwork("spring-003");

    assert.deepEqual(createData(store).getViewData("spring-garden").progress, { collectedCount: 3, totalArtworks: 3 });
  });

  it("returns an empty list for an unknown theme without throwing", () => {
    const result = createData().getViewData("missing-theme");

    assert.deepEqual(result.artworks, []);
    assert.deepEqual(result.progress, { collectedCount: 0, totalArtworks: 0 });
    assert.equal(result.themeDisplayName, "");
  });

  it("returns the theme display name", () => {
    assert.equal(createData().getViewData("beach-holiday").themeDisplayName, "Beach Holiday");
  });
});

function createData(store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS)): CollectionArtworkListData {
  return new CollectionArtworkListData(store, createArtworkCatalog(), createThemeCatalog());
}

function createArtworkCatalog() {
  return Object.freeze({
    getByTheme(themeId: string): readonly ArtworkDefinition[] {
      return Object.freeze(ARTWORKS.filter((artwork) => artwork.themeId === themeId));
    },
  });
}

function createThemeCatalog() {
  return Object.freeze({
    get(themeId: string): ThemeConfig {
      const theme = THEMES.find((candidate) => candidate.id === themeId);
      if (theme === undefined) {
        throw new Error(`Unknown theme: ${themeId}`);
      }
      return theme;
    },
    has(themeId: string): boolean {
      return THEMES.some((theme) => theme.id === themeId);
    },
  });
}
