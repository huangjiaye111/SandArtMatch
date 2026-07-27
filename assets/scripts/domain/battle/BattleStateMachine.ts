import {
  BattlePhase,
  type BattleActionResult,
  type BattleRejectReason,
  type BattleStageEvent,
  type BattleViewSnapshot,
} from "./BattleState.ts";
import {
  scheduleAbsorption,
  type AbsorbScheduleResult,
  type AbsorbedSandCell,
} from "./Settlement.ts";
import { detectDeadlock } from "./Outcome.ts";
import { Bucket, createBucket, type BucketState } from "../bucket/Bucket.ts";
import { ConveyorSystem, createConveyor, type ConveyorState } from "../bucket/Conveyor.ts";
import { MergeSystem, createMergeSystem, type MergeResult } from "../bucket/Merge.ts";
import { detectExposedSand, type ExposedSandCell } from "../core/Exposure.ts";
import { settleGravity, type GravitySettlementResult, type GravitySettleOptions } from "../core/Gravity.ts";
import { SeededRandom, type RandomSnapshot } from "../core/Random.ts";
import { SandGrid, type SandGridSnapshot } from "../core/SandGrid.ts";

export interface BattleStateMachineOptions {
  readonly grid: SandGrid;
  readonly buckets: readonly Bucket[];
  readonly conveyor?: ConveyorSystem;
  readonly random: SeededRandom;
  readonly maxAbsorbCount?: number;
  readonly gravityOptions?: GravitySettleOptions;
}

interface BattleInternalSnapshot {
  readonly phase: BattlePhase;
  readonly grid: SandGridSnapshot;
  readonly conveyor: ConveyorState;
  readonly buckets: readonly BucketState[];
  readonly random: RandomSnapshot;
  readonly mergeSequence: number;
}

const SELECTABLE_BUCKET_STATUS = "available";

export class BattleStateMachine {
  private phaseValue: BattlePhase;
  private grid: SandGrid;
  private conveyor: ConveyorSystem;
  private random: SeededRandom;
  private readonly mergeSystem: MergeSystem;
  private readonly maxAbsorbCount: number | undefined;
  private readonly gravityOptions: GravitySettleOptions;
  private bucketsById: Map<string, Bucket>;
  private bucketOrder: string[];

  public constructor(options: BattleStateMachineOptions) {
    validateOptions(options);

    this.phaseValue = BattlePhase.WaitingInput;
    this.grid = options.grid.clone();
    this.conveyor = createConveyor(options.conveyor?.maxSlots);
    this.random = SeededRandom.fromSnapshot(options.random.snapshot());
    this.mergeSystem = createMergeSystem();
    this.maxAbsorbCount = options.maxAbsorbCount;
    this.gravityOptions = { ...(options.gravityOptions ?? {}) };
    this.bucketsById = new Map<string, Bucket>();
    this.bucketOrder = [];

    this.loadInitialBuckets(options.buckets, options.conveyor);
  }

  public get currentPhase(): BattlePhase {
    return this.phaseValue;
  }

  public canAcceptInput(): boolean {
    return this.phaseValue === BattlePhase.WaitingInput;
  }

  public selectBucket(bucketInstanceId: string): BattleActionResult {
    validateBucketInstanceId(bucketInstanceId);

    const beforePhase = this.phaseValue;
    const rejection = this.validateBucketSelection(bucketInstanceId);
    if (rejection !== null) {
      return this.createRejectedResult(bucketInstanceId, beforePhase, rejection);
    }

    const rollbackSnapshot = this.createInternalSnapshot();
    const phaseSequence: BattlePhase[] = [beforePhase];
    const events: BattleStageEvent[] = [];

    try {
      this.enterPhase(BattlePhase.BucketEnqueue, phaseSequence);
      const enqueueEvent = this.enqueueBucket(bucketInstanceId);
      events.push(enqueueEvent);

      this.enterPhase(BattlePhase.MergeResolve, phaseSequence);
      const mergeResult = this.resolveMerge();
      events.push(Object.freeze({ type: "mergeResolved", phase: BattlePhase.MergeResolve, result: mergeResult }));

      this.enterPhase(BattlePhase.ExposedSandResolve, phaseSequence);
      const exposedSand = this.resolveExposedSand();
      events.push(
        Object.freeze({
          type: "exposedSandResolved",
          phase: BattlePhase.ExposedSandResolve,
          exposedSand,
        }),
      );

      this.enterPhase(BattlePhase.AbsorbResolve, phaseSequence);
      const schedule = this.resolveAbsorption(exposedSand);
      events.push(Object.freeze({ type: "absorbResolved", phase: BattlePhase.AbsorbResolve, schedule }));

      this.enterPhase(BattlePhase.SandGravity, phaseSequence);
      const gravity = this.resolveGravity();
      events.push(
        Object.freeze({
          type: "sandGravityResolved",
          phase: BattlePhase.SandGravity,
          result: gravity,
          grid: this.grid.snapshot(),
        }),
      );

      this.enterPhase(BattlePhase.BucketCompleteResolve, phaseSequence);
      const completedBucketInstanceIds = this.resolveCompletedBuckets();
      events.push(
        Object.freeze({
          type: "bucketCompleteResolved",
          phase: BattlePhase.BucketCompleteResolve,
          completedBucketInstanceIds,
          conveyor: this.conveyor.snapshot(),
        }),
      );

      this.enterPhase(BattlePhase.ResultCheck, phaseSequence);
      const outcome = detectDeadlock({
        grid: this.grid,
        conveyor: this.conveyor,
        phase: BattlePhase.ResultCheck,
        mergeSystem: this.mergeSystem,
        maxAbsorbCount: this.maxAbsorbCount,
      });
      events.push(
        Object.freeze({
          type: "resultChecked",
          phase: BattlePhase.ResultCheck,
          won: outcome.isVictory,
          failed: outcome.isDeadlocked,
          failureReason: outcome.isDeadlocked ? outcome.reason : undefined,
          deadlock: outcome,
        }),
      );

      this.enterPhase(outcome.isVictory ? BattlePhase.Won : outcome.isDeadlocked ? BattlePhase.Failed : BattlePhase.WaitingInput, phaseSequence);
      return this.freezeActionResult({
        accepted: true,
        action: "selectBucket",
        bucketInstanceId,
        beforePhase,
        afterPhase: this.phaseValue,
        phaseSequence,
        events,
        snapshot: this.snapshot(),
      });
    } catch (error) {
      this.restoreInternalSnapshot(rollbackSnapshot);
      return this.freezeActionResult({
        accepted: false,
        action: "selectBucket",
        bucketInstanceId,
        beforePhase,
        afterPhase: this.phaseValue,
        phaseSequence,
        events,
        snapshot: this.snapshot(),
        rejectReason: "settlementError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public snapshot(): BattleViewSnapshot {
    return Object.freeze({
      phase: this.phaseValue,
      grid: this.grid.snapshot(),
      conveyor: this.conveyor.snapshot(),
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.requireBucket(instanceId).snapshot())),
      random: this.random.snapshot(),
    });
  }

  private validateBucketSelection(bucketInstanceId: string): BattleRejectReason | null {
    if (this.phaseValue === BattlePhase.Won) {
      return "battleAlreadyWon";
    }

    if (this.phaseValue !== BattlePhase.WaitingInput) {
      return "battleNotWaitingInput";
    }

    const bucket = this.bucketsById.get(bucketInstanceId);
    if (bucket === undefined) {
      return "bucketNotFound";
    }

    if (bucket.status !== SELECTABLE_BUCKET_STATUS) {
      return "bucketNotSelectable";
    }

    if (this.conveyor.isFull()) {
      return "conveyorFull";
    }

    return null;
  }

  private enqueueBucket(bucketInstanceId: string): BattleStageEvent {
    const bucket = this.requireBucket(bucketInstanceId);
    const result = this.conveyor.addBucket(bucket);
    return Object.freeze({
      type: "bucketEnqueued",
      phase: BattlePhase.BucketEnqueue,
      bucketInstanceId,
      slotIndex: result.slotIndex,
      conveyor: result.state,
    });
  }

  private resolveMerge(): MergeResult {
    const result = this.mergeSystem.mergeOnce(this.conveyor);
    if (!result.merged || result.mergedBucket === null) {
      return result;
    }

    for (const participant of result.participantBuckets) {
      this.bucketsById.delete(participant.instanceId);
      this.bucketOrder = this.bucketOrder.filter((instanceId) => instanceId !== participant.instanceId);
    }

    const mergedBucket = this.conveyor.findBucket(result.mergedBucket.instanceId);
    if (mergedBucket === null) {
      throw new Error(`Merged bucket was not inserted into the conveyor: ${result.mergedBucket.instanceId}.`);
    }

    this.bucketsById.set(mergedBucket.instanceId, mergedBucket);
    const insertAt = result.insertIndex ?? this.bucketOrder.length;
    this.bucketOrder.splice(insertAt, 0, mergedBucket.instanceId);
    return result;
  }

  private resolveExposedSand(): readonly AbsorbedSandCell[] {
    return Object.freeze(detectExposedSand(this.grid).exposedSand.map((cell) => freezeSandCell(cell)));
  }

  private resolveAbsorption(exposedSand: readonly AbsorbedSandCell[]): AbsorbScheduleResult {
    const schedule = scheduleAbsorption({
      exposedSand,
      buckets: this.conveyor.bucketsSnapshot(),
      maxAbsorbCount: this.maxAbsorbCount,
    });

    this.validateAbsorptionPlan(schedule);
    for (const allocation of schedule.allocations) {
      for (const sand of allocation.sand) {
        this.grid.clear(sand.x, sand.y);
      }

      const bucket = this.conveyor.findBucket(allocation.bucketInstanceId);
      if (bucket === null) {
        throw new Error(`Bucket is not in the conveyor: ${allocation.bucketInstanceId}.`);
      }

      const fillResult = bucket.fill(allocation.absorbedCount);
      if (fillResult.acceptedAmount !== allocation.absorbedCount) {
        throw new Error(`Bucket accepted amount did not match absorption plan: ${bucket.instanceId}.`);
      }
    }

    return schedule;
  }

  private validateAbsorptionPlan(schedule: AbsorbScheduleResult): void {
    const deletedIndexes = new Set<number>();
    for (const allocation of schedule.allocations) {
      const bucket = this.conveyor.findBucket(allocation.bucketInstanceId);
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
        if (deletedIndexes.has(sand.index)) {
          throw new Error(`Duplicate absorption plan index: ${sand.index}.`);
        }
        deletedIndexes.add(sand.index);

        if (sand.index !== sand.y * this.grid.width + sand.x) {
          throw new Error(`Absorption plan index does not match coordinates: ${sand.index}.`);
        }

        if (this.grid.get(sand.x, sand.y) !== sand.colorId) {
          throw new Error(`Grid sand does not match absorption plan at (${sand.x}, ${sand.y}).`);
        }
      }
    }
  }

  private resolveGravity(): GravitySettlementResult {
    return settleGravity(this.grid, this.random, this.gravityOptions);
  }

  private resolveCompletedBuckets(): readonly string[] {
    const completedBucketInstanceIds = this.conveyor
      .bucketsSnapshot()
      .filter((bucket) => bucket.isFull())
      .map((bucket) => bucket.instanceId);

    for (const instanceId of completedBucketInstanceIds) {
      const bucket = this.conveyor.findBucket(instanceId);
      if (bucket === null) {
        throw new Error(`Completed bucket is not in the conveyor: ${instanceId}.`);
      }
      bucket.completeAndLeave();
      this.conveyor.removeBucketByInstanceId(instanceId);
    }

    return Object.freeze([...completedBucketInstanceIds]);
  }

  private enterPhase(nextPhase: BattlePhase, phaseSequence: BattlePhase[]): void {
    if (!isValidTransition(this.phaseValue, nextPhase)) {
      throw new Error(`Invalid battle phase transition: ${this.phaseValue} -> ${nextPhase}.`);
    }
    this.phaseValue = nextPhase;
    phaseSequence.push(nextPhase);
  }

  private createRejectedResult(
    bucketInstanceId: string,
    beforePhase: BattlePhase,
    rejectReason: BattleRejectReason,
  ): BattleActionResult {
    return this.freezeActionResult({
      accepted: false,
      action: "selectBucket",
      bucketInstanceId,
      beforePhase,
      afterPhase: this.phaseValue,
      phaseSequence: [beforePhase],
      events: [],
      snapshot: this.snapshot(),
      rejectReason,
    });
  }

  private createInternalSnapshot(): BattleInternalSnapshot {
    return Object.freeze({
      phase: this.phaseValue,
      grid: this.grid.snapshot(),
      conveyor: this.conveyor.snapshot(),
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.requireBucket(instanceId).snapshot())),
      random: this.random.snapshot(),
      mergeSequence: this.mergeSystem.snapshotSequence(),
    });
  }

  private restoreInternalSnapshot(snapshot: BattleInternalSnapshot): void {
    this.phaseValue = snapshot.phase;
    this.grid = SandGrid.fromSnapshot(snapshot.grid);
    this.random = SeededRandom.fromSnapshot(snapshot.random);
    this.mergeSystem.restoreSequence(snapshot.mergeSequence);
    this.restoreBucketsAndConveyor(snapshot.buckets, snapshot.conveyor);
  }

  private restoreBucketsAndConveyor(bucketStates: readonly BucketState[], conveyorState: ConveyorState): void {
    const nextBucketsById = new Map<string, Bucket>();
    const nextBucketOrder: string[] = [];
    const nextConveyor = createConveyor(conveyorState.maxSlots);

    for (const state of bucketStates) {
      if (nextBucketsById.has(state.instanceId)) {
        throw new Error(`Duplicate bucket in battle snapshot: ${state.instanceId}.`);
      }
      nextBucketOrder.push(state.instanceId);
    }

    for (const instanceId of conveyorState.slots) {
      if (instanceId === null) {
        continue;
      }

      const state = bucketStates.find((candidate) => candidate.instanceId === instanceId);
      if (state === undefined) {
        throw new Error(`Conveyor references missing bucket: ${instanceId}.`);
      }

      const bucket = createBucket(
        state.instanceId,
        { colorId: state.colorId, capacity: state.capacity },
        { currentAmount: state.amount },
      );
      nextConveyor.addBucket(bucket);
      nextBucketsById.set(instanceId, bucket);
    }

    for (const state of bucketStates) {
      if (nextBucketsById.has(state.instanceId)) {
        continue;
      }
      nextBucketsById.set(state.instanceId, Bucket.fromSnapshot(state));
    }

    this.bucketsById = nextBucketsById;
    this.bucketOrder = nextBucketOrder;
    this.conveyor = nextConveyor;
  }

  private loadInitialBuckets(buckets: readonly Bucket[], conveyor: ConveyorSystem | undefined): void {
    for (const bucket of buckets) {
      this.addBucketToPool(bucket.clone());
    }

    if (conveyor === undefined) {
      return;
    }

    const conveyorState = conveyor.snapshot();
    const allStates = [
      ...this.bucketOrder.map((instanceId) => this.requireBucket(instanceId).snapshot()),
      ...conveyor.bucketsSnapshot()
        .filter((bucket) => !this.bucketsById.has(bucket.instanceId))
        .map((bucket) => bucket.snapshot()),
    ];
    this.restoreBucketsAndConveyor(allStates, conveyorState);
  }

  private addBucketToPool(bucket: Bucket): void {
    if (this.bucketsById.has(bucket.instanceId)) {
      throw new Error(`Duplicate battle bucket instanceId: ${bucket.instanceId}.`);
    }
    this.bucketsById.set(bucket.instanceId, bucket);
    this.bucketOrder.push(bucket.instanceId);
  }

  private requireBucket(instanceId: string): Bucket {
    const bucket = this.bucketsById.get(instanceId);
    if (bucket === undefined) {
      throw new Error(`Bucket is not in battle state: ${instanceId}.`);
    }
    return bucket;
  }

  private freezeActionResult(result: BattleActionResult): BattleActionResult {
    return Object.freeze({
      accepted: result.accepted,
      action: result.action,
      bucketInstanceId: result.bucketInstanceId,
      beforePhase: result.beforePhase,
      afterPhase: result.afterPhase,
      phaseSequence: Object.freeze([...result.phaseSequence]),
      events: Object.freeze([...result.events]),
      snapshot: result.snapshot,
      rejectReason: result.rejectReason,
      errorMessage: result.errorMessage,
    });
  }
}

export function createBattleStateMachine(options: BattleStateMachineOptions): BattleStateMachine {
  return new BattleStateMachine(options);
}

function freezeSandCell(cell: ExposedSandCell): AbsorbedSandCell {
  return Object.freeze({
    x: cell.x,
    y: cell.y,
    index: cell.index,
    colorId: cell.colorId,
  });
}

function validateOptions(options: BattleStateMachineOptions): void {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("BattleStateMachine options are required.");
  }
  if (!(options.grid instanceof SandGrid)) {
    throw new TypeError("BattleStateMachine requires a SandGrid.");
  }
  if (!Array.isArray(options.buckets)) {
    throw new TypeError("BattleStateMachine buckets must be an array.");
  }
  if (!(options.random instanceof SeededRandom)) {
    throw new TypeError("BattleStateMachine requires a SeededRandom.");
  }
  if (options.conveyor !== undefined && !(options.conveyor instanceof ConveyorSystem)) {
    throw new TypeError("BattleStateMachine conveyor must be a ConveyorSystem.");
  }
  if (options.maxAbsorbCount !== undefined && (!Number.isSafeInteger(options.maxAbsorbCount) || options.maxAbsorbCount < 0)) {
    throw new RangeError("BattleStateMachine maxAbsorbCount must be a non-negative safe integer.");
  }
  for (const bucket of options.buckets) {
    if (!(bucket instanceof Bucket)) {
      throw new TypeError("BattleStateMachine buckets must be Bucket instances.");
    }
  }
}

function validateBucketInstanceId(bucketInstanceId: string): void {
  if (typeof bucketInstanceId !== "string" || bucketInstanceId.length === 0) {
    throw new TypeError("Bucket instanceId must be a non-empty string.");
  }
}

function isValidTransition(current: BattlePhase, next: BattlePhase): boolean {
  if (current === BattlePhase.WaitingInput) {
    return next === BattlePhase.BucketEnqueue || next === BattlePhase.WaitingInput;
  }
  if (current === BattlePhase.BucketEnqueue) {
    return next === BattlePhase.MergeResolve;
  }
  if (current === BattlePhase.MergeResolve) {
    return next === BattlePhase.ExposedSandResolve;
  }
  if (current === BattlePhase.ExposedSandResolve) {
    return next === BattlePhase.AbsorbResolve;
  }
  if (current === BattlePhase.AbsorbResolve) {
    return next === BattlePhase.SandGravity;
  }
  if (current === BattlePhase.SandGravity) {
    return next === BattlePhase.BucketCompleteResolve;
  }
  if (current === BattlePhase.BucketCompleteResolve) {
    return next === BattlePhase.ResultCheck;
  }
  if (current === BattlePhase.ResultCheck) {
    return next === BattlePhase.WaitingInput || next === BattlePhase.Won || next === BattlePhase.Failed;
  }
  return false;
}
