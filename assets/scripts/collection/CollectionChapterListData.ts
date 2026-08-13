import { ArtworkCatalog, BUILT_IN_ARTWORK_CATALOG } from "../artwork/ArtworkCatalog";
import type { ArtworkDefinition } from "../artwork/ArtworkTypes";
import { ThemeCatalog } from "../theme/ThemeCatalog";
import type { ThemeConfig, ThemeId } from "../theme/ThemeTypes";
import type { CollectionProgressStore } from "./CollectionProgressStore";

export type CollectionChapterStatus = "available" | "in-progress" | "completed" | "locked";

export interface CollectionChapterListItemData {
  readonly themeId: ThemeId;
  readonly themeDisplayName: string;
  readonly totalArtworks: number;
  readonly collectedCount: number;
  readonly unlockedCount: number;
  readonly status: CollectionChapterStatus;
}

export interface CollectionChapterTotalProgressData {
  readonly totalCollected: number;
  readonly totalArtworks: number;
}

export interface CollectionChapterListViewData {
  readonly chapters: readonly CollectionChapterListItemData[];
  readonly totalProgress: CollectionChapterTotalProgressData;
}

export interface CollectionChapterCatalogs {
  readonly themes?: readonly ThemeConfig[];
  readonly artworks?: readonly ArtworkDefinition[];
}

export class CollectionChapterListData {
  private readonly themes: readonly ThemeConfig[];
  private readonly artworks: readonly ArtworkDefinition[];
  private readonly collectionStore: CollectionProgressStore;

  public constructor(collectionStore: CollectionProgressStore, catalogs: CollectionChapterCatalogs = {}) {
    this.collectionStore = collectionStore;
    this.themes = catalogs.themes ?? ThemeCatalog.getAll();
    this.artworks = catalogs.artworks ?? BUILT_IN_ARTWORK_CATALOG;
  }

  public getViewData(): CollectionChapterListViewData {
    const chapters = this.themes.map((theme) => this.createChapter(theme));
    const unlocked = chapters.filter((chapter) => chapter.status !== "locked");
    const locked = chapters.filter((chapter) => chapter.status === "locked");
    const totalCollected = chapters.reduce((sum, chapter) => sum + chapter.collectedCount, 0);
    const totalArtworks = chapters.reduce((sum, chapter) => sum + chapter.totalArtworks, 0);

    return Object.freeze({
      chapters: Object.freeze([...unlocked, ...locked]),
      totalProgress: Object.freeze({ totalCollected, totalArtworks }),
    });
  }

  private createChapter(theme: ThemeConfig): CollectionChapterListItemData {
    const artworks = this.getArtworksByTheme(theme.id);
    const totalArtworks = artworks.length;
    const collectedCount = artworks.filter((artwork) => this.collectionStore.isArtworkCollected(artwork.id)).length;
    const unlockedCount = artworks.filter((artwork) => this.collectionStore.isArtworkUnlocked(artwork.id)).length;

    return Object.freeze({
      themeId: theme.id,
      themeDisplayName: theme.displayName,
      totalArtworks,
      collectedCount,
      unlockedCount,
      status: getChapterStatus(totalArtworks, unlockedCount, collectedCount),
    });
  }

  private getArtworksByTheme(themeId: ThemeId): readonly ArtworkDefinition[] {
    if (this.artworks === BUILT_IN_ARTWORK_CATALOG) {
      return ArtworkCatalog.getByTheme(themeId);
    }
    return Object.freeze(this.artworks.filter((artwork) => artwork.themeId === themeId).sort(compareArtworkOrder));
  }
}

function getChapterStatus(totalArtworks: number, unlockedCount: number, collectedCount: number): CollectionChapterStatus {
  if (totalArtworks > 0 && collectedCount >= totalArtworks) {
    return "completed";
  }
  if (collectedCount > 0) {
    return "in-progress";
  }
  if (unlockedCount > 0) {
    return "available";
  }
  return "locked";
}

function compareArtworkOrder(left: ArtworkDefinition, right: ArtworkDefinition): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return left.id.localeCompare(right.id);
}
