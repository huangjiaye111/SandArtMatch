export type ThemeId =
  | "spring-garden"
  | "beach-holiday"
  | "cozy-home"
  | "cloud-dream";

export interface ThemeConfig {
  readonly id: ThemeId;
  readonly displayName: string;
  readonly battleBackgroundKey?: string;
  readonly battleFrameKey?: string;
  readonly battleDecorationKey?: string;
  readonly collectionCoverKey?: string;
  readonly certificateFrameKey?: string;
  readonly placeholderBackgroundColor?: string;
  readonly placeholderFrameColor?: string;
}
