import type { BucketState } from "../bucket/Bucket.ts";
import { Bucket } from "../bucket/Bucket.ts";
import { ConveyorSystem, type ConveyorState } from "../bucket/Conveyor.ts";
import { detectExposedSand, type ExposedSandCell } from "../core/Exposure.ts";
import { SandGrid, type SandGridSnapshot } from "../core/SandGrid.ts";
import type { SandColorId } from "../config/LevelConfig.ts";

export interface AbsorbScheduleOptions {
  readonly maxAbsorbCount?: number;
}

export interface AbsorbScheduleInput extends AbsorbScheduleOptions {
  readonly exposedSand: readonly ExposedSandCell[];
  readonly buckets: readonly Bucket[];
}

export interface AbsorbedSandCell {
  readonly x: number;
  readonly y: number;
  readonly index: number;
  readonly colorId: SandColorId;
}

export interface AbsorbAllocation {
  readonly bucketInstanceId: string;
  readonly bucketIndex: number;
  readonly colorId: SandColorId;
  readonly sand: readonly AbsorbedSandCell[];
  readonly absorbedCount: number;
  readonly bucketAmountBefore: number;
  readonly bucketAmountAfter: number;
  readonly bucketRemainingCapacityBefore: number;
  readonly bucketRemainingCapacityAfter: number;
}

export interface AbsorbScheduleResult {
  readonly allocations: readonly AbsorbAllocation[];
  readonly unassignedSand: readonly AbsorbedSandCell[];
  readonly totalExposedCount: number;
  readonly assignedCount: number;
  readonly unassignedCount: number;
}

export interface AbsorbSettlementInput extends AbsorbScheduleOptions {
  readonly grid: SandGrid;
  readonly conveyor: ConveyorSystem;
  readonly exposedSand?: readonly ExposedSandCell[];
}

export interface AbsorbSettlementResult {
  readonly schedule: AbsorbScheduleResult;
  readonly completedBucketInstanceIds: readonly string[];
  readonly grid: SandGridSnapshot;
  readonly conveyor: ConveyorState;
  readonly bucketStates: readonly BucketState[];
}

export function scheduleAbsorption(input: AbsorbScheduleInput): AbsorbScheduleResult {
  validateScheduleInput(input);

  const exposedSand = cloneAndValidateExposedSand(input.exposedSand);
  validateBuckets(input.buckets);
  const maxAbsorbCount = normalizeMaxAbsorbCount(input.maxAbsorbCount, exposedSand.length);
  const sandByColor = groupSandByColor(exposedSand);
  const readIndexesByColor: Record<number, number> = Object.create(null);
  const allocations: AbsorbAllocation[] = [];
  let remainingGlobalAbsorbCount = maxAbsorbCount;

  for (let bucketIndex = 0; bucketIndex < input.buckets.length; bucketIndex += 1) {
    if (remainingGlobalAbsorbCount === 0) {
      break;
    }

    const bucket = input.buckets[bucketIndex];
    if (!canBucketAbsorb(bucket)) {
      continue;
    }

    const sameColorSand = sandByColor[bucket.colorId];
    if (sameColorSand === undefined) {
      continue;
    }

    const readIndex = readIndexesByColor[bucket.colorId] ?? 0;
    const availableCount = sameColorSand.length - readIndex;
    if (availableCount <= 0) {
      continue;
    }

    const bucketAmountBefore = bucket.currentAmount;
    const bucketRemainingCapacityBefore = bucket.remainingCapacity;
    const absorbedCount = Math.min(availableCount, bucketRemainingCapacityBefore, remainingGlobalAbsorbCount);
    if (absorbedCount <= 0) {
      continue;
    }

    const sand = sameColorSand.slice(readIndex, readIndex + absorbedCount);
    readIndexesByColor[bucket.colorId] = readIndex + absorbedCount;
    remainingGlobalAbsorbCount -= absorbedCount;

    allocations.push(
      freezeAllocation({
        bucketInstanceId: bucket.instanceId,
        bucketIndex,
        colorId: bucket.colorId,
        sand,
        absorbedCount,
        bucketAmountBefore,
        bucketAmountAfter: bucketAmountBefore + absorbedCount,
        bucketRemainingCapacityBefore,
        bucketRemainingCapacityAfter: bucketRemainingCapacityBefore - absorbedCount,
      }),
    );
  }

  const assignedIndexes = collectAssignedIndexes(allocations);
  const unassignedSand = exposedSand.filter((cell) => !assignedIndexes.has(cell.index));
  return freezeScheduleResult({
    allocations,
    unassignedSand,
    totalExposedCount: exposedSand.length,
    assignedCount: allocations.reduce((total, allocation) => total + allocation.absorbedCount, 0),
    unassignedCount: unassignedSand.length,
  });
}

export function runAbsorbSettlement(input: AbsorbSettlementInput): AbsorbSettlementResult {
  validateSettlementInput(input);

  const exposedSand = input.exposedSand ?? detectExposedSand(input.grid).exposedSand;
  const buckets = input.conveyor.bucketsSnapshot();
  const schedule = scheduleAbsorption({
    exposedSand,
    buckets,
    maxAbsorbCount: input.maxAbsorbCount,
  });

  validateScheduleAppliesToCurrentState(input.grid, input.conveyor, schedule);

  const completedBucketInstanceIds: string[] = [];
  for (const allocation of schedule.allocations) {
    for (const sand of allocation.sand) {
      input.grid.clear(sand.x, sand.y);
    }

    const bucket = input.conveyor.findBucket(allocation.bucketInstanceId);
    if (bucket === null) {
      throw new Error(`Bucket is not in the conveyor: ${allocation.bucketInstanceId}.`);
    }

    bucket.fill(allocation.absorbedCount);
    if (bucket.isFull()) {
      bucket.completeAndLeave();
      input.conveyor.removeBucketByInstanceId(bucket.instanceId);
      completedBucketInstanceIds.push(bucket.instanceId);
    }
  }

  return Object.freeze({
    schedule,
    completedBucketInstanceIds: Object.freeze([...completedBucketInstanceIds]),
    grid: input.grid.snapshot(),
    conveyor: input.conveyor.snapshot(),
    bucketStates: Object.freeze(input.conveyor.bucketsSnapshot().map((bucket) => bucket.snapshot())),
  });
}

function canBucketAbsorb(bucket: Bucket): boolean {
  return bucket.status === "inConveyor" && bucket.remainingCapacity > 0;
}

function groupSandByColor(exposedSand: readonly AbsorbedSandCell[]): Record<number, readonly AbsorbedSandCell[]> {
  const mutableGroups: Record<number, AbsorbedSandCell[]> = Object.create(null);
  const frozenGroups: Record<number, readonly AbsorbedSandCell[]> = Object.create(null);

  for (const cell of exposedSand) {
    const group = mutableGroups[cell.colorId] ?? [];
    group.push(cell);
    mutableGroups[cell.colorId] = group;
  }

  for (const cell of exposedSand) {
    if (frozenGroups[cell.colorId] === undefined) {
      frozenGroups[cell.colorId] = Object.freeze([...mutableGroups[cell.colorId]]);
    }
  }

  return frozenGroups;
}

function collectAssignedIndexes(allocations: readonly AbsorbAllocation[]): Set<number> {
  const assignedIndexes = new Set<number>();
  for (const allocation of allocations) {
    for (const sand of allocation.sand) {
      assignedIndexes.add(sand.index);
    }
  }
  return assignedIndexes;
}

function cloneAndValidateExposedSand(exposedSand: readonly ExposedSandCell[]): readonly AbsorbedSandCell[] {
  const cloned: AbsorbedSandCell[] = [];
  const seenIndexes = new Set<number>();

  for (const cell of exposedSand) {
    validateExposedSandCell(cell);
    if (seenIndexes.has(cell.index)) {
      throw new Error(`Duplicate exposed sand index: ${cell.index}.`);
    }
    seenIndexes.add(cell.index);
    cloned.push(freezeSandCell(cell));
  }

  return Object.freeze(cloned);
}

function validateScheduleAppliesToCurrentState(
  grid: SandGrid,
  conveyor: ConveyorSystem,
  schedule: AbsorbScheduleResult,
): void {
  for (const allocation of schedule.allocations) {
    const bucket = conveyor.findBucket(allocation.bucketInstanceId);
    if (bucket === null) {
      throw new Error(`Bucket is not in the conveyor: ${allocation.bucketInstanceId}.`);
    }

    if (bucket.currentAmount !== allocation.bucketAmountBefore) {
      throw new Error(`Bucket amount changed before absorption could be applied: ${bucket.instanceId}.`);
    }

    if (bucket.remainingCapacity < allocation.absorbedCount) {
      throw new RangeError(`Bucket remaining capacity is insufficient: ${bucket.instanceId}.`);
    }

    for (const sand of allocation.sand) {
      if (grid.get(sand.x, sand.y) !== sand.colorId) {
        throw new Error(`Grid sand does not match absorption plan at (${sand.x}, ${sand.y}).`);
      }
    }
  }
}

function freezeScheduleResult(result: AbsorbScheduleResult): AbsorbScheduleResult {
  return Object.freeze({
    allocations: Object.freeze([...result.allocations]),
    unassignedSand: Object.freeze(result.unassignedSand.map(freezeSandCell)),
    totalExposedCount: result.totalExposedCount,
    assignedCount: result.assignedCount,
    unassignedCount: result.unassignedCount,
  });
}

function freezeAllocation(allocation: AbsorbAllocation): AbsorbAllocation {
  return Object.freeze({
    bucketInstanceId: allocation.bucketInstanceId,
    bucketIndex: allocation.bucketIndex,
    colorId: allocation.colorId,
    sand: Object.freeze(allocation.sand.map(freezeSandCell)),
    absorbedCount: allocation.absorbedCount,
    bucketAmountBefore: allocation.bucketAmountBefore,
    bucketAmountAfter: allocation.bucketAmountAfter,
    bucketRemainingCapacityBefore: allocation.bucketRemainingCapacityBefore,
    bucketRemainingCapacityAfter: allocation.bucketRemainingCapacityAfter,
  });
}

function freezeSandCell(cell: ExposedSandCell): AbsorbedSandCell {
  return Object.freeze({
    x: cell.x,
    y: cell.y,
    index: cell.index,
    colorId: cell.colorId,
  });
}

function validateScheduleInput(input: AbsorbScheduleInput): void {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Absorb schedule input is required.");
  }

  if (!Array.isArray(input.exposedSand)) {
    throw new TypeError("Absorb schedule exposed sand must be an array.");
  }

  if (!Array.isArray(input.buckets)) {
    throw new TypeError("Absorb schedule buckets must be an array.");
  }

  normalizeMaxAbsorbCount(input.maxAbsorbCount, input.exposedSand.length);
}

function validateBuckets(buckets: readonly Bucket[]): void {
  for (const bucket of buckets) {
    validateBucket(bucket);
  }
}

function validateSettlementInput(input: AbsorbSettlementInput): void {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Absorb settlement input is required.");
  }

  if (!(input.grid instanceof SandGrid)) {
    throw new TypeError("Absorb settlement requires a SandGrid.");
  }

  if (!(input.conveyor instanceof ConveyorSystem)) {
    throw new TypeError("Absorb settlement requires a ConveyorSystem.");
  }

  if (input.exposedSand !== undefined && !Array.isArray(input.exposedSand)) {
    throw new TypeError("Absorb settlement exposed sand must be an array.");
  }

  normalizeMaxAbsorbCount(input.maxAbsorbCount, input.exposedSand?.length ?? input.grid.width * input.grid.height);
}

function validateBucket(bucket: Bucket): void {
  if (!(bucket instanceof Bucket)) {
    throw new TypeError("Absorb schedule buckets must be Bucket instances.");
  }
}

function validateExposedSandCell(cell: ExposedSandCell): void {
  if (typeof cell !== "object" || cell === null) {
    throw new TypeError("Exposed sand cell must be an object.");
  }

  validateSafeNonNegativeInteger(cell.x, "Exposed sand x");
  validateSafeNonNegativeInteger(cell.y, "Exposed sand y");
  validateSafeNonNegativeInteger(cell.index, "Exposed sand index");
  validateSafePositiveInteger(cell.colorId, "Exposed sand color id");
}

function normalizeMaxAbsorbCount(maxAbsorbCount: number | undefined, fallback: number): number {
  if (maxAbsorbCount === undefined) {
    return fallback;
  }

  validateSafeNonNegativeInteger(maxAbsorbCount, "Max absorb count");
  return maxAbsorbCount;
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
