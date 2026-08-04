export interface BucketFlyPoint {
  readonly x: number;
  readonly y: number;
}

export interface BucketFlyMotionConfig {
  readonly durationSeconds: number;
  readonly reboundSeconds: number;
  readonly arcHeight: number;
  readonly baseScale: number;
}

export interface BucketFlyMotionSample {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

const MIN_ARC_HEIGHT = 30;
const MAX_ARC_HEIGHT = 60;

export function createBucketFlyMotionConfig(
  source: BucketFlyPoint,
  target: BucketFlyPoint,
  baseScale: number,
): BucketFlyMotionConfig {
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  return Object.freeze({
    durationSeconds: BATTLE_PRESENTATION_CONFIG.bucketFlyDurationSeconds,
    reboundSeconds: BATTLE_PRESENTATION_CONFIG.bucketFlyReboundSeconds,
    arcHeight: clamp(distance * BATTLE_PRESENTATION_CONFIG.bucketFlyArcDistanceRatio, MIN_ARC_HEIGHT, MAX_ARC_HEIGHT),
    baseScale,
  });
}

export function sampleBucketFlyMotion(
  source: BucketFlyPoint,
  target: BucketFlyPoint,
  progress: number,
  config: BucketFlyMotionConfig,
): BucketFlyMotionSample {
  const timeProgress = clamp01(progress);
  const p = cubicOut(timeProgress);
  const x = lerp(source.x, target.x, p);
  const y = lerp(source.y, target.y, p) + config.arcHeight * 4 * p * (1 - p);
  return Object.freeze({
    x,
    y,
    scale: config.baseScale * sampleFlyScaleFactor(timeProgress),
  });
}

export function sampleBucketFlyReboundScale(progress: number, config: BucketFlyMotionConfig): number {
  return config.baseScale * lerp(BATTLE_PRESENTATION_CONFIG.bucketFlyArrivalScaleFactor, 1, cubicOut(clamp01(progress)));
}

export class BucketFlightRegistry {
  private readonly activeBucketIds = new Set<string>();

  public start(bucketInstanceId: string): boolean {
    if (this.activeBucketIds.has(bucketInstanceId)) {
      return false;
    }
    this.activeBucketIds.add(bucketInstanceId);
    return true;
  }

  public finish(bucketInstanceId: string): void {
    this.activeBucketIds.delete(bucketInstanceId);
  }

  public cancelAll(): void {
    this.activeBucketIds.clear();
  }

  public has(bucketInstanceId: string): boolean {
    return this.activeBucketIds.has(bucketInstanceId);
  }

  public get size(): number {
    return this.activeBucketIds.size;
  }
}

function sampleFlyScaleFactor(progress: number): number {
  return -0.24 * progress * progress + 0.2 * progress + 1;
}

function cubicOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
import { BATTLE_PRESENTATION_CONFIG } from "./BattlePresentationConfig";
