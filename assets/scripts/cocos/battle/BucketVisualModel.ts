import type { BucketState } from "../../domain/bucket/Bucket";
import { getSandCanvasPaletteEntry } from "./SandCanvasModel";

export interface BucketVisualModel {
  readonly hasBucket: boolean;
  readonly colorBadgeVisible: boolean;
  readonly colorBadgeFill: string;
  readonly bodyFill: string;
  readonly mouthFill: string;
  readonly fillSurfaceVisible: boolean;
  readonly fillRatio: number;
  readonly fullBadgeVisible: boolean;
  readonly remainingAmount: number;
  readonly remainingText: string;
}

const EMPTY_COLOR = "#E6E6E6";

export function createBucketVisualModel(bucket: BucketState | undefined): BucketVisualModel {
  if (bucket === undefined) {
    return Object.freeze({
      hasBucket: false,
      colorBadgeVisible: false,
      colorBadgeFill: EMPTY_COLOR,
      bodyFill: EMPTY_COLOR,
      mouthFill: EMPTY_COLOR,
      fillSurfaceVisible: false,
      fillRatio: 0,
      fullBadgeVisible: false,
      remainingAmount: 0,
      remainingText: "",
    });
  }

  const fillRatio = Math.max(0, Math.min(1, bucket.amount / bucket.capacity));
  const palette = getSandCanvasPaletteEntry(bucket.colorId);
  const remainingAmount = Math.max(0, bucket.capacity - bucket.amount);
  return Object.freeze({
    hasBucket: true,
    colorBadgeVisible: true,
    colorBadgeFill: palette.fill,
    bodyFill: palette.fill,
    mouthFill: palette.shadow,
    fillSurfaceVisible: bucket.amount > 0,
    fillRatio,
    fullBadgeVisible: fillRatio >= 1,
    remainingAmount,
    remainingText: String(remainingAmount),
  });
}
