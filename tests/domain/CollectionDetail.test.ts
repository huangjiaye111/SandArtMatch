import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ArtworkDefinition } from "../../assets/scripts/artwork/ArtworkTypes.ts";
import { CollectionDetailData, formatArtworkOrder } from "../../assets/scripts/collection/CollectionDetailData.ts";
import { createCollectionProgressStore, MemoryCollectionStorage } from "../../assets/scripts/collection/CollectionProgressStore.ts";
import type { ThemeConfig } from "../../assets/scripts/theme/ThemeTypes.ts";

const THEMES: readonly ThemeConfig[] = Object.freeze([
  Object.freeze({ id: "spring-garden", displayName: "Spring Garden", placeholderBackgroundColor: "#ABCDEF" }),
  Object.freeze({ id: "beach-holiday", displayName: "Beach Holiday" }),
]);

const ARTWORKS: readonly ArtworkDefinition[] = Object.freeze([
  Object.freeze({
    id: "spring-001",
    themeId: "spring-garden",
    displayName: "Spring One",
    order: 1,
    fullImageKey: "full.spring.one",
    certificateImageKey: "certificate.spring.one",
  }),
  Object.freeze({ id: "spring-012", themeId: "spring-garden", displayName: "Spring Twelve", order: 12 }),
  Object.freeze({ id: "beach-002", themeId: "beach-holiday", displayName: "Beach Two", order: 2 }),
]);

describe("CollectionDetailData", () => {
  it("returns detail data for a valid artwork id", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.collectArtwork("spring-001");

    const result = createData(store).getViewData("spring-001");

    assert.deepEqual(result, {
      artworkId: "spring-001",
      displayName: "Spring One",
      order: 1,
      formattedOrder: "No.001",
      themeId: "spring-garden",
      themeDisplayName: "Spring Garden",
      fullImageKey: "full.spring.one",
      certificateImageKey: "certificate.spring.one",
      certificatePlaceholderColor: "#ABCDEF",
      isCollected: true,
      canView: true,
      rewardHint: "Added to collection book",
    });
  });

  it("gets the theme display name", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.unlockArtwork("beach-002");

    assert.equal(createData(store).getViewData("beach-002")?.themeDisplayName, "Beach Holiday");
  });

  it("formats artwork order as a three-digit certificate number", () => {
    assert.equal(formatArtworkOrder(1), "No.001");
    assert.equal(formatArtworkOrder(12), "No.012");
  });

  it("sets canView true for collected artwork", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.collectArtwork("spring-001");

    const result = createData(store).getViewData("spring-001");

    assert.equal(result?.canView, true);
    assert.equal(result?.isCollected, true);
  });

  it("sets canView true for unlocked artwork", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.unlockArtwork("spring-012");

    const result = createData(store).getViewData("spring-012");

    assert.equal(result?.canView, true);
    assert.equal(result?.isCollected, false);
  });

  it("sets canView false for locked artwork", () => {
    const result = createData().getViewData("spring-001");

    assert.equal(result?.canView, false);
    assert.equal(result?.displayName, "???");
    assert.equal(result?.fullImageKey, undefined);
    assert.equal(result?.certificateImageKey, undefined);
  });

  it("returns null for a missing artwork id", () => {
    assert.equal(createData().getViewData("missing-artwork"), null);
  });

  it("returns a non-empty reward hint", () => {
    const store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS);
    store.unlockArtwork("spring-001");

    const result = createData(store).getViewData("spring-001");

    assert.equal(typeof result?.rewardHint, "string");
    assert.equal((result?.rewardHint.length ?? 0) > 0, true);
  });

  it("keeps the certificate placeholder color tied to the artwork theme", () => {
    const result = createData().getViewData("spring-001");

    assert.equal(result?.themeId, "spring-garden");
    assert.equal(result?.certificatePlaceholderColor, "#ABCDEF");
  });
});

function createData(store = createCollectionProgressStore(new MemoryCollectionStorage(), ARTWORKS)): CollectionDetailData {
  return new CollectionDetailData(store, createArtworkCatalog(), createThemeCatalog());
}

function createArtworkCatalog() {
  return Object.freeze({
    getById(artworkId: string): ArtworkDefinition | null {
      return ARTWORKS.find((artwork) => artwork.id === artworkId) ?? null;
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
