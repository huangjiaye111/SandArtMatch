export type BattlePresentationQuality = "low" | "standard" | "high";

export interface BattlePresentationConfig {
  readonly quality: BattlePresentationQuality;
  readonly bucketFlyDurationSeconds: number;
  readonly bucketFlyReboundSeconds: number;
  readonly bucketFlyArcDistanceRatio: number;
  readonly bucketFlyArrivalScaleFactor: number;
  readonly absorptionMinDurationSeconds: number;
  readonly absorptionMaxDurationSeconds: number;
  readonly absorptionBatchIntervalSeconds: number;
  readonly absorptionMaxBatchCount: number;
  readonly absorptionParticlePoolCapacity: number;
  readonly absorptionParticleTweenSeconds: number;
  readonly gravityTextureUpdateRate: number;
  readonly gravityDebugTimeScale: number;
  readonly gravityIterationsPerTextureFrame: number;
  readonly gravityStartAfterLastAbsorbBatchSeconds: number;
  readonly presentationDebugLogging: boolean;
  readonly presentationDebugTimeScale: number;
  readonly presentationTextureUploadRate: number;
  readonly mergeDurationSeconds: number;
  readonly mergePulseDuration: number;
  readonly mergeMoveDuration: number;
  readonly mergeResultBounceDuration: number;
  readonly fullBucketExitDurationSeconds: number;
  readonly bucketCompleteHoldDuration: number;
  readonly bucketExitDuration: number;
  readonly bucketExitOffset: Readonly<{ readonly x: number; readonly y: number }>;
  readonly maxConcurrentBucketPresentationTasks: number;
  readonly carrierCellsPerSecond: number;
  readonly carrierEnterDuration: number;
  readonly carrierDebugLogging: boolean;
  readonly sandCanvasInnerWidth: number;
  readonly sandCanvasInnerHeight: number;
  readonly sandCanvasTextureMaxWidth: number;
  readonly sandCanvasTextureMaxHeight: number;
}

export const BATTLE_PRESENTATION_CONFIG: BattlePresentationConfig = Object.freeze({
  quality: "standard",
  bucketFlyDurationSeconds: 0.22,
  bucketFlyReboundSeconds: 0.1,
  bucketFlyArcDistanceRatio: 0.18,
  bucketFlyArrivalScaleFactor: 0.96,
  absorptionMinDurationSeconds: 0.45,
  absorptionMaxDurationSeconds: 1.2,
  absorptionBatchIntervalSeconds: 0.045,
  absorptionMaxBatchCount: 24,
  absorptionParticlePoolCapacity: 128,
  absorptionParticleTweenSeconds: 0.28,
  gravityTextureUpdateRate: 30,
  gravityDebugTimeScale: 1,
  gravityIterationsPerTextureFrame: 2,
  gravityStartAfterLastAbsorbBatchSeconds: 0.03,
  presentationDebugLogging: false,
  presentationDebugTimeScale: 1,
  presentationTextureUploadRate: 30,
  mergeDurationSeconds: 0.28,
  mergePulseDuration: 0.12,
  mergeMoveDuration: 0.24,
  mergeResultBounceDuration: 0.16,
  fullBucketExitDurationSeconds: 0.28,
  bucketCompleteHoldDuration: 0.14,
  bucketExitDuration: 0.26,
  bucketExitOffset: Object.freeze({ x: 44, y: 54 }),
  maxConcurrentBucketPresentationTasks: 8,
  carrierCellsPerSecond: 1,
  carrierEnterDuration: 0.28,
  carrierDebugLogging: false,
  sandCanvasInnerWidth: 600,
  sandCanvasInnerHeight: 600,
  sandCanvasTextureMaxWidth: 600,
  sandCanvasTextureMaxHeight: 600,
});
