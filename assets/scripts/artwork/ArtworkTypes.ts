import type { ThemeId } from "../theme/ThemeTypes";

export type ArtworkId = string;

export interface ArtworkUnlockRequirement {
  readonly type: "level";
  readonly levelId: string;
}

export interface ArtworkDefinition {
  readonly id: ArtworkId;
  readonly themeId: ThemeId;
  readonly displayName: string;
  readonly order: number;
  readonly thumbnailKey?: string;
  readonly fullImageKey?: string;
  readonly certificateImageKey?: string;
  readonly unlockRequirement?: ArtworkUnlockRequirement;
}

export interface ArtworkCollectionProgress {
  readonly themeId: ThemeId;
  readonly collected: number;
  readonly total: number;
  readonly percent: number;
}
