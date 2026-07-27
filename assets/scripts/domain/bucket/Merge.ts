import { Bucket, type BucketState, createBucket } from "./Bucket.ts";
import { ConveyorSystem, type ConveyorState } from "./Conveyor.ts";
import type { SandColorId } from "../config/LevelConfig.ts";

export const DEFAULT_MERGE_BUCKET_COUNT = 3;

export interface MergeCandidate {
  readonly colorId: SandColorId;
  readonly bucketIndexes: readonly number[];
  readonly bucketInstanceIds: readonly string[];
}

export interface MergeBucketSummary {
  readonly instanceId: string;
  readonly colorId: SandColorId;
  readonly capacity: number;
  readonly currentAmount: number;
  readonly remainingCapacity: number;
}

export interface MergeResult {
  readonly merged: boolean;
  readonly candidate: MergeCandidate | null;
  readonly participantBuckets: readonly MergeBucketSummary[];
  readonly mergedBucket: MergeBucketSummary | null;
  readonly insertIndex: number | null;
  readonly state: ConveyorState;
}

export class MergeSystem {
  private nextMergeSequence: number;

  public constructor(sequenceStart: number = 1) {
    validateSequenceStart(sequenceStart);
    this.nextMergeSequence = sequenceStart;
  }

  public snapshotSequence(): number {
    return this.nextMergeSequence;
  }

  public restoreSequence(sequence: number): void {
    validateSequenceStart(sequence);
    this.nextMergeSequence = sequence;
  }

  public findMergeCandidate(conveyor: ConveyorSystem): MergeCandidate | null {
    validateConveyor(conveyor);

    const buckets = conveyor.bucketsSnapshot();
    if (buckets.length < DEFAULT_MERGE_BUCKET_COUNT) {
      return null;
    }

    const bucketsByColor: Array<{ readonly colorId: SandColorId; readonly indexes: number[] }> = [];
    for (let index = 0; index < buckets.length; index += 1) {
      const bucket = buckets[index];
      validateMergeBucket(bucket);

      let indexes = findColorIndexes(bucketsByColor, bucket.colorId);
      if (indexes === null) {
        indexes = [];
        bucketsByColor.push({
          colorId: bucket.colorId,
          indexes,
        });
      }
      indexes.push(index);

      if (indexes.length === DEFAULT_MERGE_BUCKET_COUNT) {
        return freezeCandidate(bucket.colorId, indexes.slice(0, DEFAULT_MERGE_BUCKET_COUNT), buckets);
      }
    }

    return null;
  }

  public mergeOnce(conveyor: ConveyorSystem): MergeResult {
    validateConveyor(conveyor);

    const candidate = this.findMergeCandidate(conveyor);
    if (candidate === null) {
      return freezeMergeResult({
        merged: false,
        candidate: null,
        participantBuckets: [],
        mergedBucket: null,
        insertIndex: null,
        state: conveyor.snapshot(),
      });
    }

    const buckets = conveyor.bucketsSnapshot();
    const participants = candidate.bucketIndexes.map((index) => buckets[index]);
    const capacity = sumSafeIntegers(participants.map((bucket) => bucket.capacity), "Merged bucket capacity");
    const currentAmount = sumSafeIntegers(
      participants.map((bucket) => bucket.currentAmount),
      "Merged bucket current amount",
    );

    if (currentAmount > capacity) {
      throw new RangeError("Merged bucket current amount must not exceed capacity.");
    }

    const mergedBucket = createBucket(
      this.createMergedBucketInstanceId(candidate, conveyor),
      {
        colorId: candidate.colorId,
        capacity,
      },
      {
        currentAmount,
      },
    );
    const replaceResult = conveyor.replaceBucketsWith(candidate.bucketInstanceIds, mergedBucket);
    this.nextMergeSequence += 1;

    return freezeMergeResult({
      merged: true,
      candidate,
      participantBuckets: participants.map(toBucketSummary),
      mergedBucket: toBucketSummary(mergedBucket),
      insertIndex: replaceResult.slotIndex,
      state: replaceResult.state,
    });
  }

  private createMergedBucketInstanceId(candidate: MergeCandidate, conveyor: ConveyorSystem): string {
    let instanceId = `merge-${this.nextMergeSequence}-${candidate.colorId}-${candidate.bucketInstanceIds.join("_")}`;
    let suffix = 2;
    while (conveyor.hasBucket(instanceId)) {
      instanceId = `merge-${this.nextMergeSequence}-${candidate.colorId}-${candidate.bucketInstanceIds.join("_")}-${suffix}`;
      suffix += 1;
    }
    return instanceId;
  }
}

export function createMergeSystem(sequenceStart: number = 1): MergeSystem {
  return new MergeSystem(sequenceStart);
}

function freezeCandidate(colorId: SandColorId, bucketIndexes: readonly number[], buckets: readonly Bucket[]): MergeCandidate {
  return Object.freeze({
    colorId,
    bucketIndexes: Object.freeze([...bucketIndexes]),
    bucketInstanceIds: Object.freeze(bucketIndexes.map((index) => buckets[index].instanceId)),
  });
}

function findColorIndexes(
  bucketsByColor: readonly { readonly colorId: SandColorId; readonly indexes: number[] }[],
  colorId: SandColorId,
): number[] | null {
  for (const bucketGroup of bucketsByColor) {
    if (bucketGroup.colorId === colorId) {
      return bucketGroup.indexes;
    }
  }
  return null;
}

function freezeMergeResult(result: MergeResult): MergeResult {
  return Object.freeze({
    merged: result.merged,
    candidate: result.candidate,
    participantBuckets: Object.freeze([...result.participantBuckets]),
    mergedBucket: result.mergedBucket,
    insertIndex: result.insertIndex,
    state: result.state,
  });
}

function toBucketSummary(bucket: Bucket): MergeBucketSummary {
  return Object.freeze({
    instanceId: bucket.instanceId,
    colorId: bucket.colorId,
    capacity: bucket.capacity,
    currentAmount: bucket.currentAmount,
    remainingCapacity: bucket.remainingCapacity,
  });
}

function validateConveyor(conveyor: ConveyorSystem): void {
  if (!(conveyor instanceof ConveyorSystem)) {
    throw new TypeError("MergeSystem requires a ConveyorSystem instance.");
  }
}

function validateMergeBucket(bucket: Bucket): void {
  if (!(bucket instanceof Bucket)) {
    throw new TypeError("Merge candidates must be Bucket instances.");
  }

  if (bucket.status !== "inConveyor") {
    throw new Error(`Merge candidates must be in the conveyor: ${bucket.instanceId}.`);
  }

  validateSafePositiveInteger(bucket.colorId, "Bucket color id");
  validateSafePositiveInteger(bucket.capacity, "Bucket capacity");
  validateSafeNonNegativeInteger(bucket.currentAmount, "Bucket current amount");

  if (bucket.currentAmount > bucket.capacity) {
    throw new RangeError(`Bucket current amount must not exceed capacity: ${bucket.instanceId}.`);
  }
}

function validateSequenceStart(sequenceStart: number): void {
  validateSafePositiveInteger(sequenceStart, "Merge sequence start");
}

function validateSafePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
}

function validateSafeNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

function sumSafeIntegers(values: readonly number[], label: string): number {
  let total = 0;
  for (const value of values) {
    validateSafeNonNegativeInteger(value, label);
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new RangeError(`${label} must remain a safe integer.`);
    }
  }
  return total;
}
