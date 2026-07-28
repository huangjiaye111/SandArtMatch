import { BattlePhase } from "./BattleState";
import type { BucketState } from "../bucket/Bucket";
import { Bucket, createBucket } from "../bucket/Bucket";
import type { ConveyorState } from "../bucket/Conveyor";
import { createConveyor } from "../bucket/Conveyor";
import type { RandomSnapshot } from "../core/Random";
import { SeededRandom } from "../core/Random";
import type { SandGridSnapshot } from "../core/SandGrid";
import { SandGrid } from "../core/SandGrid";

export const DEFAULT_UNDO_HISTORY_LIMIT = 3;

export type UndoFailureReason = "emptyHistory" | "invalidSnapshot" | "notStablePhase";

export interface BattleSnapshot {
  readonly phase: BattlePhase;
  readonly grid: SandGridSnapshot;
  readonly conveyor: ConveyorState;
  readonly buckets: readonly BucketState[];
  readonly random: RandomSnapshot;
  readonly mergeSequence: number;
  readonly actionIndex: number;
}

export interface UndoStackSaveResult {
  readonly saved: boolean;
  readonly historyDepth: number;
  readonly limit: number;
  readonly failureReason?: UndoFailureReason;
  readonly errorMessage?: string;
}

export interface UndoStackRestoreResult {
  readonly restored: boolean;
  readonly historyDepth: number;
  readonly limit: number;
  readonly snapshot?: BattleSnapshot;
  readonly failureReason?: UndoFailureReason;
  readonly errorMessage?: string;
}

export class UndoStack {
  private readonly limitValue: number;
  private readonly history: BattleSnapshot[];

  public constructor(limit: number = DEFAULT_UNDO_HISTORY_LIMIT) {
    validateHistoryLimit(limit);

    this.limitValue = limit;
    this.history = [];
  }

  public get limit(): number {
    return this.limitValue;
  }

  public get historyDepth(): number {
    return this.history.length;
  }

  public canUndo(): boolean {
    return this.history.length > 0;
  }

  public saveOperationSnapshot(snapshot: BattleSnapshot): UndoStackSaveResult {
    if (snapshot.phase !== BattlePhase.WaitingInput) {
      return this.freezeSaveResult({
        saved: false,
        historyDepth: this.history.length,
        limit: this.limitValue,
        failureReason: "notStablePhase",
      });
    }

    try {
      const storedSnapshot = cloneAndValidateBattleSnapshot(snapshot);
      this.history.push(storedSnapshot);
      while (this.history.length > this.limitValue) {
        this.history.shift();
      }

      return this.freezeSaveResult({
        saved: true,
        historyDepth: this.history.length,
        limit: this.limitValue,
      });
    } catch (error) {
      return this.freezeSaveResult({
        saved: false,
        historyDepth: this.history.length,
        limit: this.limitValue,
        failureReason: "invalidSnapshot",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public restoreLatest(): UndoStackRestoreResult {
    const snapshot = this.peekLatest();
    if (snapshot.restored !== true || snapshot.snapshot === undefined) {
      return snapshot;
    }

    this.history.pop();
    return this.freezeRestoreResult({
      restored: true,
      historyDepth: this.history.length,
      limit: this.limitValue,
      snapshot: snapshot.snapshot,
    });
  }

  public peekLatest(): UndoStackRestoreResult {
    if (this.history.length === 0) {
      return this.freezeRestoreResult({
        restored: false,
        historyDepth: this.history.length,
        limit: this.limitValue,
        failureReason: "emptyHistory",
      });
    }

    const latestSnapshot = this.history[this.history.length - 1];
    try {
      const restoredSnapshot = cloneAndValidateBattleSnapshot(latestSnapshot);
      return this.freezeRestoreResult({
        restored: true,
        historyDepth: this.history.length,
        limit: this.limitValue,
        snapshot: restoredSnapshot,
      });
    } catch (error) {
      return this.freezeRestoreResult({
        restored: false,
        historyDepth: this.history.length,
        limit: this.limitValue,
        failureReason: "invalidSnapshot",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public discardLatest(): void {
    this.history.pop();
  }

  public clear(): void {
    this.history.splice(0, this.history.length);
  }

  public snapshots(): readonly BattleSnapshot[] {
    return Object.freeze(this.history.map((snapshot) => cloneAndValidateBattleSnapshot(snapshot)));
  }

  private freezeSaveResult(result: UndoStackSaveResult): UndoStackSaveResult {
    return Object.freeze({
      saved: result.saved,
      historyDepth: result.historyDepth,
      limit: result.limit,
      failureReason: result.failureReason,
      errorMessage: result.errorMessage,
    });
  }

  private freezeRestoreResult(result: UndoStackRestoreResult): UndoStackRestoreResult {
    return Object.freeze({
      restored: result.restored,
      historyDepth: result.historyDepth,
      limit: result.limit,
      snapshot: result.snapshot,
      failureReason: result.failureReason,
      errorMessage: result.errorMessage,
    });
  }
}

export function createUndoStack(limit: number = DEFAULT_UNDO_HISTORY_LIMIT): UndoStack {
  return new UndoStack(limit);
}

export function cloneAndValidateBattleSnapshot(snapshot: BattleSnapshot): BattleSnapshot {
  validateBattleSnapshotShape(snapshot);

  const grid = SandGrid.fromSnapshot(snapshot.grid).snapshot();
  const random = SeededRandom.fromSnapshot(snapshot.random).snapshot();
  validateSequence(snapshot.mergeSequence, "Merge sequence");
  validateActionIndex(snapshot.actionIndex);

  const bucketStates = snapshot.buckets.map((bucketState) => Bucket.fromSnapshot(bucketState).snapshot());
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
    conveyor.addBucket(
      createBucket(
        bucketState.instanceId,
        {
          colorId: bucketState.colorId,
          capacity: bucketState.capacity,
        },
        {
          currentAmount: bucketState.amount,
        },
      ),
    );
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

  validateHistoryLimit(conveyorState.maxSlots);
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

function validateHistoryLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("Undo history limit must be a positive safe integer.");
  }
}

function validateSequence(sequence: number, label: string): void {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
}

function validateActionIndex(actionIndex: number): void {
  if (!Number.isSafeInteger(actionIndex) || actionIndex < 0) {
    throw new RangeError("Action index must be a non-negative safe integer.");
  }
}
