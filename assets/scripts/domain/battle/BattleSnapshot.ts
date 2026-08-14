import { BattlePhase } from "./BattleState";
import type { BucketState } from "../bucket/Bucket";
import { Bucket, createBucket } from "../bucket/Bucket";
import type { ConveyorState } from "../bucket/Conveyor";
import { createConveyor } from "../bucket/Conveyor";
import type { RandomSnapshot } from "../core/Random";
import { SeededRandom } from "../core/Random";
import type { SandGridSnapshot } from "../core/SandGrid";
import { SandGrid } from "../core/SandGrid";

export interface BattleSnapshot {
  readonly phase: BattlePhase;
  readonly grid: SandGridSnapshot;
  readonly conveyor: ConveyorState;
  readonly buckets: readonly BucketState[];
  readonly random: RandomSnapshot;
  readonly mergeSequence: number;
  readonly actionIndex: number;
}

export function cloneAndValidateBattleSnapshot(snapshot: BattleSnapshot): BattleSnapshot {
  validateBattleSnapshotShape(snapshot);

  const grid = SandGrid.fromSnapshot(snapshot.grid).snapshot();
  const random = SeededRandom.fromSnapshot(snapshot.random).snapshot();
  validateSequence(snapshot.mergeSequence, "Merge sequence");
  validateActionIndex(snapshot.actionIndex);

  const bucketStates = snapshot.buckets.map(cloneBucketState);
  validateBucketIds(bucketStates);
  const conveyor = cloneAndValidateConveyor(snapshot.conveyor, bucketStates);

  return Object.freeze({
    phase: snapshot.phase,
    grid,
    conveyor,
    buckets: Object.freeze(bucketStates),
    random,
    mergeSequence: snapshot.mergeSequence,
    actionIndex: snapshot.actionIndex,
  });
}

function cloneBucketState(bucketState: BucketState): BucketState {
  const cloned = Bucket.fromSnapshot(bucketState).snapshot();
  if (bucketState.poolSlotIndex === undefined) {
    return cloned;
  }
  validatePoolSlotIndex(bucketState.poolSlotIndex, bucketState.instanceId);
  return Object.freeze({
    ...cloned,
    poolSlotIndex: bucketState.poolSlotIndex,
  });
}

function cloneAndValidateConveyor(conveyorState: ConveyorState, bucketStates: readonly BucketState[]): ConveyorState {
  validateConveyorShape(conveyorState);

  const bucketStatesById = new Map<string, BucketState>();
  for (const state of bucketStates) {
    bucketStatesById.set(state.instanceId, state);
  }

  const conveyor = createConveyor(conveyorState.maxSlots);
  let seenEmptySlot = false;
  const seenConveyorBucketIds = new Set<string>();
  for (const instanceId of conveyorState.slots) {
    if (instanceId === null) {
      seenEmptySlot = true;
      continue;
    }
    if (seenEmptySlot) {
      throw new Error("Conveyor snapshot cannot contain occupied slots after empty slots.");
    }
    if (seenConveyorBucketIds.has(instanceId)) {
      throw new Error(`Duplicate conveyor bucket instanceId: ${instanceId}.`);
    }

    const bucketState = bucketStatesById.get(instanceId);
    if (bucketState === undefined) {
      throw new Error(`Conveyor references missing bucket: ${instanceId}.`);
    }
    if (bucketState.status !== "inConveyor") {
      throw new Error(`Conveyor bucket must have inConveyor status: ${instanceId}.`);
    }

    seenConveyorBucketIds.add(instanceId);
    conveyor.addBucket(createBucket(
      bucketState.instanceId,
      { colorId: bucketState.colorId, capacity: bucketState.capacity },
      { currentAmount: bucketState.amount },
    ));
  }

  for (const state of bucketStates) {
    if (state.status === "inConveyor" && !seenConveyorBucketIds.has(state.instanceId)) {
      throw new Error(`In-conveyor bucket is missing from conveyor slots: ${state.instanceId}.`);
    }
  }

  return conveyor.snapshot();
}

function validateBattleSnapshotShape(snapshot: BattleSnapshot): void {
  if (typeof snapshot !== "object" || snapshot === null) {
    throw new TypeError("Battle snapshot is required.");
  }
  if (!Object.values(BattlePhase).includes(snapshot.phase)) {
    throw new Error(`Unsupported battle snapshot phase: ${String(snapshot.phase)}.`);
  }
  if (!Array.isArray(snapshot.buckets)) {
    throw new TypeError("Battle snapshot buckets must be an array.");
  }
}

function validateConveyorShape(conveyorState: ConveyorState): void {
  if (typeof conveyorState !== "object" || conveyorState === null) {
    throw new TypeError("Conveyor snapshot is required.");
  }
  validatePositiveInteger(conveyorState.maxSlots, "Conveyor maxSlots");
  if (!Array.isArray(conveyorState.slots)) {
    throw new TypeError("Conveyor snapshot slots must be an array.");
  }
  if (conveyorState.slots.length !== conveyorState.maxSlots) {
    throw new RangeError("Conveyor snapshot slot count must match maxSlots.");
  }
  for (const instanceId of conveyorState.slots) {
    if (instanceId !== null && (typeof instanceId !== "string" || instanceId.length === 0)) {
      throw new TypeError("Conveyor snapshot bucket ids must be non-empty strings or null.");
    }
  }
}

function validateBucketIds(bucketStates: readonly BucketState[]): void {
  const seen = new Set<string>();
  for (const state of bucketStates) {
    if (seen.has(state.instanceId)) {
      throw new Error(`Duplicate bucket in battle snapshot: ${state.instanceId}.`);
    }
    seen.add(state.instanceId);
  }
}

function validatePoolSlotIndex(poolSlotIndex: number, instanceId: string): void {
  if (!Number.isSafeInteger(poolSlotIndex) || poolSlotIndex < 0) {
    throw new RangeError(`Battle snapshot bucket poolSlotIndex must be a non-negative safe integer: ${instanceId}.`);
  }
}

function validateSequence(sequence: number, label: string): void {
  validatePositiveInteger(sequence, label);
}

function validateActionIndex(actionIndex: number): void {
  if (!Number.isSafeInteger(actionIndex) || actionIndex < 0) {
    throw new RangeError("Action index must be a non-negative safe integer.");
  }
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
}
