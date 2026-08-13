import type { ArtworkDefinition, ArtworkId } from "../artwork/ArtworkTypes";
import type { ThemeConfig } from "../theme/ThemeTypes";
import type { CollectionProgressStore } from "./CollectionProgressStore";

export interface CollectionDetailViewData {
  readonly artworkId: ArtworkId;
  readonly displayName: string;
  readonly order: number;
  readonly formattedOrder: string;
  readonly themeId: string;
  readonly themeDisplayName: string;
  readonly fullImageKey?: string;
  readonly certificateImageKey?: string;
  readonly certificatePlaceholderColor: string;
  readonly isCollected: boolean;
  readonly canView: boolean;
  readonly rewardHint: string;
}

export interface CollectionDetailArtworkCatalogRef {
  getById(artworkId: string): ArtworkDefinition | null;
}

export interface CollectionDetailThemeCatalogRef {
  get(themeId: string): ThemeConfig;
  has(themeId: string): boolean;
}

const DEFAULT_REWARD_HINT = "Added to collection book";
const DEFAULT_CERTIFICATE_COLOR = "#EEF0F4";

export class CollectionDetailData {
  private readonly collectionStore: CollectionProgressStore;
  private readonly artworkCatalog: CollectionDetailArtworkCatalogRef;
  private readonly themeCatalog: CollectionDetailThemeCatalogRef;

  public constructor(
    collectionStore: CollectionProgressStore,
    artworkCatalog: CollectionDetailArtworkCatalogRef,
    themeCatalog: CollectionDetailThemeCatalogRef,
  ) {
    this.collectionStore = collectionStore;
    this.artworkCatalog = artworkCatalog;
    this.themeCatalog = themeCatalog;
  }

  public getViewData(artworkId: string): CollectionDetailViewData | null {
    const artwork = this.artworkCatalog.getById(artworkId);
    if (artwork === null) {
      return null;
    }

    const isCollected = this.collectionStore.isArtworkCollected(artwork.id);
    const canView = isCollected || this.collectionStore.isArtworkUnlocked(artwork.id);
    if (!canView) {
      return this.createLockedViewData(artwork);
    }

    const theme = this.getTheme(artwork.themeId);
    return Object.freeze({
      artworkId: artwork.id,
      displayName: artwork.displayName,
      order: artwork.order,
      formattedOrder: formatArtworkOrder(artwork.order),
      themeId: artwork.themeId,
      themeDisplayName: theme?.displayName ?? "",
      fullImageKey: artwork.fullImageKey,
      certificateImageKey: artwork.certificateImageKey,
      certificatePlaceholderColor: theme?.placeholderBackgroundColor ?? DEFAULT_CERTIFICATE_COLOR,
      isCollected,
      canView,
      rewardHint: DEFAULT_REWARD_HINT,
    });
  }

  private createLockedViewData(artwork: ArtworkDefinition): CollectionDetailViewData {
    const theme = this.getTheme(artwork.themeId);
    return Object.freeze({
      artworkId: artwork.id,
      displayName: "???",
      order: artwork.order,
      formattedOrder: formatArtworkOrder(artwork.order),
      themeId: artwork.themeId,
      themeDisplayName: theme?.displayName ?? "",
      fullImageKey: undefined,
      certificateImageKey: undefined,
      certificatePlaceholderColor: theme?.placeholderBackgroundColor ?? DEFAULT_CERTIFICATE_COLOR,
      isCollected: false,
      canView: false,
      rewardHint: DEFAULT_REWARD_HINT,
    });
  }

  private getTheme(themeId: string): ThemeConfig | null {
    if (!this.themeCatalog.has(themeId)) {
      return null;
    }
    return this.themeCatalog.get(themeId);
  }
}

export function formatArtworkOrder(order: number): string {
  if (!Number.isSafeInteger(order) || order <= 0) {
    return "No.???";
  }
  return `No.${order.toString().padStart(3, "0")}`;
}
