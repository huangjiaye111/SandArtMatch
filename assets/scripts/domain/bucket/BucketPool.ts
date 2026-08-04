import type { BucketState } from "./Bucket";

export const BUCKET_POOL_COLUMN_COUNT = 4;

export interface BucketPoolColumnState {
  readonly columnIndex: number;
  readonly bucketIds: readonly string[];
  readonly frontIndex: number;
  readonly frontBucketId: string | null;
}

export interface BucketPoolBucketState {
  readonly bucketId: string;
  readonly columnIndex: number;
  readonly depthIndex: number;
  readonly visibleDepthIndex: number;
  readonly isFront: boolean;
  readonly isSelectable: boolean;
}

export interface BucketPoolState {
  readonly columns: readonly BucketPoolColumnState[];
  readonly buckets: readonly BucketPoolBucketState[];
  readonly selectableBucketIds: readonly string[];
}

export function createBucketPoolState(
  buckets: readonly BucketState[],
  columnCount = BUCKET_POOL_COLUMN_COUNT,
): BucketPoolState {
  validateColumnCount(columnCount);

  const columns: BucketPoolColumnState[] = [];
  const selectableBucketIds: string[] = [];
  const availableDepthByColumn = new Array<number>(columnCount).fill(0);
  const frontBucketIdByColumn = new Array<string | null>(columnCount).fill(null);
  const bucketIdsByColumn: string[][] = Array.from({ length: columnCount }, () => []);

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    for (let index = columnIndex; index < buckets.length; index += columnCount) {
      const bucket = buckets[index];
      if (bucket === undefined) {
        continue;
      }
      if (bucket.status !== "available") {
        continue;
      }
      bucketIdsByColumn[columnIndex].push(bucket.instanceId);
      if (frontBucketIdByColumn[columnIndex] === null) {
        frontBucketIdByColumn[columnIndex] = bucket.instanceId;
        selectableBucketIds.push(bucket.instanceId);
      }
    }

    columns.push(Object.freeze({
      columnIndex,
      bucketIds: Object.freeze(bucketIdsByColumn[columnIndex]),
      frontIndex: frontBucketIdByColumn[columnIndex] === null ? -1 : 0,
      frontBucketId: frontBucketIdByColumn[columnIndex],
    }));
  }

  const bucketStates: BucketPoolBucketState[] = [];
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    if (bucket.status !== "available") {
      continue;
    }
    const columnIndex = index % columnCount;
    const depthIndex = availableDepthByColumn[columnIndex];
    const visibleDepthIndex = depthIndex;
    const isSelectable = visibleDepthIndex === 0;
    bucketStates.push(Object.freeze({
      bucketId: bucket.instanceId,
      columnIndex,
      depthIndex,
      visibleDepthIndex,
      isFront: isSelectable,
      isSelectable,
    }));
    availableDepthByColumn[columnIndex] += 1;
  }

  return Object.freeze({
    columns: Object.freeze(columns),
    buckets: Object.freeze(bucketStates),
    selectableBucketIds: Object.freeze(selectableBucketIds),
  });
}

export function getSelectableBucketIds(
  buckets: readonly BucketState[],
  columnCount = BUCKET_POOL_COLUMN_COUNT,
): readonly string[] {
  return createBucketPoolState(buckets, columnCount).selectableBucketIds;
}

export function isBucketSelectable(
  buckets: readonly BucketState[],
  bucketId: string,
  columnCount = BUCKET_POOL_COLUMN_COUNT,
): boolean {
  return getSelectableBucketIds(buckets, columnCount).includes(bucketId);
}

export function getBucketPoolSelectionReason(
  buckets: readonly BucketState[],
  bucketId: string,
  columnCount = BUCKET_POOL_COLUMN_COUNT,
): "bucketNotFound" | "bucketNotSelectable" | "bucketNotColumnFront" | null {
  const bucket = buckets.find((candidate) => candidate.instanceId === bucketId) ?? null;
  if (bucket === null) {
    return "bucketNotFound";
  }
  if (bucket.status !== "available") {
    return "bucketNotSelectable";
  }
  return isBucketSelectable(buckets, bucketId, columnCount) ? null : "bucketNotColumnFront";
}

function validateColumnCount(columnCount: number): void {
  if (!Number.isSafeInteger(columnCount) || columnCount <= 0) {
    throw new RangeError("Bucket pool column count must be a positive safe integer.");
  }
}
