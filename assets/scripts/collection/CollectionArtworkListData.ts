import type { ArtworkDefinition, ArtworkId } from "../artwork/ArtworkTypes";
import type { ThemeConfig } from "../theme/ThemeTypes";
import type { CollectionProgressStore } from "./CollectionProgressStore";

export type CollectionArtworkStatus = "locked" | "unlocked" | "collected";

export interface CollectionArtworkListItemData {
  readonly artworkId: ArtworkId;
  readonly displayName: string;
  readonly order: number;
  readonly thumbnailKey?: string;
  readonly status: CollectionArtworkStatus;
}

export interface CollectionArtworkListProgressData {
  readonly collectedCount: number;
  readonly totalArtworks: number;
}

export interface CollectionArtworkListViewData {
  readonly themeId: string;
  readonly themeDisplayName: string;
  readonly artworks: readonly CollectionArtworkListItemData[];
  readonly progress: CollectionArtworkListProgressData;
}

export interface CollectionArtworkCatalogRef {
  getByTheme(themeId: string): readonly ArtworkDefinition[];
}

export interface CollectionThemeCatalogRef {
  get(themeId: string): ThemeConfig;
  has(themeId: string): boolean;
}

export class CollectionArtworkListData {
  private readonly collectionStore: CollectionProgressStore;
  private readonly artworkCatalog: CollectionArtworkCatalogRef;
  private readonly themeCatalog: CollectionThemeCatalogRef;

  public constructor(
    collectionStore: CollectionProgressStore,
    artworkCatalog: CollectionArtworkCatalogRef,
    themeCatalog: CollectionThemeCatalogRef,
  ) {
    this.collectionStore = collectionStore;
    this.artworkCatalog = artworkCatalog;
    this.themeCatalog = themeCatalog;
  }

  public getViewData(themeId: string): CollectionArtworkListViewData {
    const artworks = this.getArtworks(themeId).map((artwork) => this.createItem(artwork));
    const collectedCount = artworks.filter((artwork) => artwork.status === "collected").length;

    return Object.freeze({
      themeId,
      themeDisplayName: this.getThemeDisplayName(themeId),
      artworks: Object.freeze(artworks),
      progress: Object.freeze({
        collectedCount,
        totalArtworks: artworks.length,
      }),
    });
  }

  private getArtworks(themeId: string): readonly ArtworkDefinition[] {
    if (!this.themeCatalog.has(themeId)) {
      return Object.freeze([]);
    }
    return Object.freeze([...this.artworkCatalog.getByTheme(themeId)].sort(compareArtworkOrder));
  }

  private createItem(artwork: ArtworkDefinition): CollectionArtworkListItemData {
    const status = this.getArtworkStatus(artwork.id);
    return Object.freeze({
      artworkId: artwork.id,
      displayName: status === "locked" ? "???" : artwork.displayName,
      order: artwork.order,
      thumbnailKey: status === "locked" ? undefined : artwork.thumbnailKey,
      status,
    });
  }

  private getArtworkStatus(artworkId: ArtworkId): CollectionArtworkStatus {
    if (this.collectionStore.isArtworkCollected(artworkId)) {
      return "collected";
    }
    if (this.collectionStore.isArtworkUnlocked(artworkId)) {
      return "unlocked";
    }
    return "locked";
  }

  private getThemeDisplayName(themeId: string): string {
    if (!this.themeCatalog.has(themeId)) {
      return "";
    }
    return this.themeCatalog.get(themeId).displayName;
  }
}

function compareArtworkOrder(left: ArtworkDefinition, right: ArtworkDefinition): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return left.id.localeCompare(right.id);
}
