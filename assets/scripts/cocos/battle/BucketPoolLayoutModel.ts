import type { BucketState } from "../../domain/bucket/Bucket";
import type { BucketPoolBucketState } from "../../domain/bucket/BucketPool";

export interface BucketPoolCellLayout {
  readonly index: number;
  readonly row: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
}

export interface BucketPoolLayoutModel {
  readonly columns: number;
  readonly rows: number;
  readonly panelWidth: number;
  readonly viewportHeight: number;
  readonly contentHeight: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly visibleRows: number;
  readonly scrollableOverflow: number;
  readonly cells: readonly BucketPoolCellLayout[];
}

export interface BucketPoolScrollModel {
  readonly viewportHeight: number;
  readonly contentHeight: number;
  readonly scrollRange: number;
}

export interface BucketPoolVisualCellLayout {
  readonly index: number;
  readonly bucketId: string;
  readonly row: number;
  readonly column: number;
  readonly visibleDepthIndex: number;
  readonly x: number;
  readonly y: number;
  readonly selectable: boolean;
}

export interface BucketPoolVisualLayoutModel {
  readonly columns: number;
  readonly rows: number;
  readonly panelWidth: number;
  readonly viewportHeight: number;
  readonly contentHeight: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly visibleRows: number;
  readonly scrollableOverflow: number;
  readonly cells: readonly BucketPoolVisualCellLayout[];
}

export const BUCKET_POOL_COLUMNS = 4;
const DEFAULT_PANEL_WIDTH = 670;
const DEFAULT_VIEWPORT_HEIGHT = 438;
const CELL_WIDTH = 150;
const CELL_HEIGHT = 138;
const TOP_PADDING = 78;
const BOTTOM_PADDING = 54;

export function createBucketPoolLayoutModel(
  bucketCount: number,
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
): BucketPoolLayoutModel {
  if (!Number.isSafeInteger(bucketCount) || bucketCount < 0) {
    throw new RangeError("Bucket count must be a non-negative safe integer.");
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new RangeError("Bucket pool viewport height must be positive.");
  }

  const rows = Math.max(3, Math.ceil(bucketCount / BUCKET_POOL_COLUMNS));
  const contentHeight = TOP_PADDING + BOTTOM_PADDING + rows * CELL_HEIGHT;
  const cells: BucketPoolCellLayout[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const row = Math.floor(index / BUCKET_POOL_COLUMNS);
    const column = index % BUCKET_POOL_COLUMNS;
    cells.push(Object.freeze({
      index,
      row,
      column,
      x: (column - (BUCKET_POOL_COLUMNS - 1) / 2) * CELL_WIDTH,
      y: contentHeight / 2 - TOP_PADDING - CELL_HEIGHT / 2 - row * CELL_HEIGHT,
    }));
  }

  return Object.freeze({
    columns: BUCKET_POOL_COLUMNS,
    rows,
    panelWidth: DEFAULT_PANEL_WIDTH,
    viewportHeight,
    contentHeight,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    visibleRows: Math.min(rows, Math.floor(viewportHeight / CELL_HEIGHT)),
    scrollableOverflow: Math.max(0, contentHeight - viewportHeight),
    cells: Object.freeze(cells),
  });
}

export function createBucketPoolVisualLayoutModel(
  buckets: readonly BucketPoolBucketState[],
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
): BucketPoolVisualLayoutModel {
  if (!Array.isArray(buckets)) {
    throw new TypeError("Bucket pool buckets must be an array.");
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new RangeError("Bucket pool viewport height must be positive.");
  }

  const rows = Math.max(3, buckets.reduce((maxRows, bucket) => Math.max(maxRows, bucket.visibleDepthIndex + 1), 0));
  const contentHeight = TOP_PADDING + BOTTOM_PADDING + rows * CELL_HEIGHT;
  const cells: BucketPoolVisualCellLayout[] = [];
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    cells.push(Object.freeze({
      index,
      bucketId: bucket.bucketId,
      row: bucket.visibleDepthIndex,
      column: bucket.columnIndex,
      visibleDepthIndex: bucket.visibleDepthIndex,
      x: (bucket.columnIndex - (BUCKET_POOL_COLUMNS - 1) / 2) * CELL_WIDTH,
      y: contentHeight / 2 - TOP_PADDING - CELL_HEIGHT / 2 - bucket.visibleDepthIndex * CELL_HEIGHT,
      selectable: bucket.isSelectable,
    }));
  }

  return Object.freeze({
    columns: BUCKET_POOL_COLUMNS,
    rows,
    panelWidth: DEFAULT_PANEL_WIDTH,
    viewportHeight,
    contentHeight,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    visibleRows: Math.min(rows, Math.floor(viewportHeight / CELL_HEIGHT)),
    scrollableOverflow: Math.max(0, contentHeight - viewportHeight),
    cells: Object.freeze(cells),
  });
}

export function selectCandidateBuckets(buckets: readonly BucketState[]): readonly BucketState[] {
  return Object.freeze(buckets.filter((bucket) => bucket.status === "available"));
}

export function createBucketPoolScrollModel(contentHeight: number, viewportHeight: number): BucketPoolScrollModel {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    throw new RangeError("Bucket pool content height must be positive.");
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new RangeError("Bucket pool viewport height must be positive.");
  }

  return Object.freeze({
    viewportHeight,
    contentHeight,
    scrollRange: Math.max(0, contentHeight - viewportHeight),
  });
}
