import type { MergeResult } from "../../domain/bucket/Merge";

export interface BucketMergePresentationTask {
  readonly revision: number;
  readonly tick: number;
  readonly participantBucketIds: readonly string[];
  readonly participantSlotIndexes: readonly number[];
  readonly resultBucketId: string | null;
  readonly resultSlotIndex: number | null;
}

export interface BucketExitPresentationTask {
  readonly revision: number;
  readonly tick: number;
  readonly bucketId: string;
  readonly slotIndex: number;
}

export function createBucketMergePresentationTasks(input: {
  readonly revision: number;
  readonly tick: number;
  readonly mergeResults: readonly MergeResult[];
}): readonly BucketMergePresentationTask[] {
  const tasks: BucketMergePresentationTask[] = [];
  for (const result of input.mergeResults) {
    if (!result.merged) {
      continue;
    }
    tasks.push(Object.freeze({
      revision: input.revision,
      tick: input.tick,
      participantBucketIds: Object.freeze(result.participantBuckets.map((bucket) => bucket.instanceId)),
      participantSlotIndexes: Object.freeze(result.candidate?.bucketIndexes ?? []),
      resultBucketId: result.mergedBucket?.instanceId ?? null,
      resultSlotIndex: result.insertIndex,
    }));
  }
  return Object.freeze(tasks);
}

export function createBucketExitPresentationTasks(input: {
  readonly revision: number;
  readonly tick: number;
  readonly completedBucketIds: readonly string[];
  readonly completedSlotIndexes: readonly number[];
  readonly exitResults: readonly string[];
}): readonly BucketExitPresentationTask[] {
  const tasks: BucketExitPresentationTask[] = [];
  for (const bucketId of input.exitResults) {
    const completedIndex = input.completedBucketIds.indexOf(bucketId);
    if (completedIndex < 0) {
      continue;
    }
    const slotIndex = input.completedSlotIndexes[completedIndex];
    if (slotIndex === undefined) {
      continue;
    }
    tasks.push(Object.freeze({
      revision: input.revision,
      tick: input.tick,
      bucketId,
      slotIndex,
    }));
  }
  return Object.freeze(tasks);
}
