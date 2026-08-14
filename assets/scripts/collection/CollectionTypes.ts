export const COLLECTION_PROGRESS_SCHEMA_VERSION = 1;

export type ArtworkCollectionStatus = "locked" | "unlocked" | "collected";

export interface ArtworkCollectionRecord {
  readonly artworkId: string;
  readonly status: ArtworkCollectionStatus;
}

export interface CollectionProgressState {
  readonly schemaVersion: number;
  readonly unlockedArtworkIds: readonly string[];
  readonly collectedArtworkIds: readonly string[];
}

export interface CollectionThemeProgress {
  readonly themeId: string;
  readonly collected: number;
  readonly total: number;
  readonly percent: number;
}

export interface CollectionTotalProgress {
  readonly collected: number;
  readonly total: number;
  readonly percent: number;
}
