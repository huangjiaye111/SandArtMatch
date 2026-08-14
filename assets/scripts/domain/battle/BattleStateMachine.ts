import {
  BattlePhase,
  type BattleActionResult,
  type BattleRejectReason,
  type BattleStageEvent,
  type BattleToolActionResult,
  type SettlementStep,
  type BattleViewSnapshot,
} from "./BattleState";
import { resolveBattleHint, shuffleAvailableBucketOrder, type BattleToolAction } from "./BattleToolRules";
import { cloneAndValidateBattleSnapshot, type BattleSnapshot } from "./BattleSnapshot";
import {
  scheduleAbsorption,
  type AbsorbScheduleResult,
  type AbsorbedSandCell,
} from "./Settlement";
import { detectDeadlock } from "./Outcome";
import { Bucket, createBucket, type BucketState } from "../bucket/Bucket";
import { getBucketPoolSelectionReason } from "../bucket/BucketPool";
import { ConveyorSystem, createConveyor, type ConveyorState } from "../bucket/Conveyor";
import { MergeSystem, createMergeSystem, type MergeResult } from "../bucket/Merge";
import { detectExposedSand, type ExposedSandCell } from "../core/Exposure";
import { settleGravity, type GravitySettlementResult, type GravitySettleOptions } from "../core/Gravity";
import { SeededRandom, type RandomSnapshot } from "../core/Random";
import { SandGrid, type SandGridSnapshot } from "../core/SandGrid";

export interface BattleStateMachineOptions {
  readonly grid: SandGrid;
  readonly buckets: readonly Bucket[];
  readonly conveyor?: ConveyorSystem;
  readonly random: SeededRandom;
  readonly maxAbsorbCount?: number;
  readonly gravityOptions?: GravitySettleOptions;
}

type BattleInternalSnapshot = BattleSnapshot;

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
  private bucketPoolSlotById: Map<string, number>;
  private actionIndex: number;
  private isProcessing: boolean;
  private readonly initialSnapshot: BattleInternalSnapshot;

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
    this.bucketPoolSlotById = new Map<string, number>();
    this.actionIndex = 0;
    this.isProcessing = false;

    this.loadInitialBuckets(options.buckets, options.conveyor);
    this.initialSnapshot = this.createInternalSnapshot();
  }

  public get currentPhase(): BattlePhase {
    return this.phaseValue;
  }

  public canAcceptInput(): boolean {
    return this.phaseValue === BattlePhase.WaitingInput && !this.isProcessing;
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

    this.isProcessing = true;
    try {
      this.actionIndex += 1;
      this.enterPhase(BattlePhase.BucketEnqueue, phaseSequence);
      const enqueueEvent = this.enqueueBucket(bucketInstanceId);
      events.push(enqueueEvent);

      this.enterPhase(BattlePhase.MergeResolve, phaseSequence);
      const mergeResult = this.resolveMerge();
      events.push(Object.freeze({ type: "mergeResolved", phase: BattlePhase.MergeResolve, result: mergeResult }));

      this.resolveSandUntilIdle(events, phaseSequence);

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
      this.isProcessing = false;
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
      this.isProcessing = false;
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

  public restart(): BattleActionResult {
    const beforePhase = this.phaseValue;
    this.restoreInternalSnapshot(this.initialSnapshot);
    this.isProcessing = false;
    return this.freezeActionResult({
      accepted: true,
      action: "restart",
      bucketInstanceId: "",
      beforePhase,
      afterPhase: this.phaseValue,
      phaseSequence: Object.freeze([beforePhase, this.phaseValue]),
      events: Object.freeze([]),
      snapshot: this.snapshot(),
    });
  }

  public useTool(action: BattleToolAction): BattleToolActionResult {
    validateToolAction(action);

    const beforePhase = this.phaseValue;
    const rejection = this.validateToolUse();
    if (rejection !== null) {
      return this.freezeToolActionResult({
        accepted: false,
        action,
        beforePhase,
        afterPhase: this.phaseValue,
        snapshot: this.snapshot(),
        hint: null,
        shuffledBucketInstanceIds: Object.freeze([]),
        rejectReason: rejection,
      });
    }

    if (action === "hint") {
      return this.freezeToolActionResult({
        accepted: true,
        action,
        beforePhase,
        afterPhase: this.phaseValue,
        snapshot: this.snapshot(),
        hint: resolveBattleHint({ grid: this.grid.snapshot(), buckets: this.snapshot().buckets }),
        shuffledBucketInstanceIds: Object.freeze([]),
      });
    }

    const nextOrder = shuffleAvailableBucketOrder({ buckets: this.snapshot().buckets, random: this.random });
    this.bucketOrder = [...nextOrder];
    this.assignPoolSlotsFromOrder(this.bucketOrder);
    this.actionIndex += 1;
    return this.freezeToolActionResult({
      accepted: true,
      action,
      beforePhase,
      afterPhase: this.phaseValue,
      snapshot: this.snapshot(),
      hint: null,
      shuffledBucketInstanceIds: nextOrder,
    });
  }

  public snapshot(): BattleViewSnapshot {
    return Object.freeze({
      phase: this.phaseValue,
      grid: this.grid.snapshot(),
      conveyor: this.conveyor.snapshot(),
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.snapshotBucket(instanceId))),
      random: this.random.snapshot(),
      actionIndex: this.actionIndex,
    });
  }

  private validateBucketSelection(bucketInstanceId: string): BattleRejectReason | null {
    if (this.phaseValue === BattlePhase.Won) {
      return "battleAlreadyWon";
    }

    if (this.isProcessing) {
      return "battleNotWaitingInput";
    }

    if (this.phaseValue !== BattlePhase.WaitingInput) {
      return "battleNotWaitingInput";
    }

    const bucket = this.bucketsById.get(bucketInstanceId);
    if (bucket === undefined) {
      return "bucketNotFound";
    }

    const poolReason = getBucketPoolSelectionReason(this.snapshot().buckets, bucketInstanceId);
    if (poolReason === "bucketNotFound") {
      return "bucketNotFound";
    }
    if (poolReason === "bucketNotSelectable" || bucket.status !== SELECTABLE_BUCKET_STATUS) {
      return "bucketNotSelectable";
    }
    if (poolReason === "bucketNotColumnFront") {
      return "bucketNotColumnFront";
    }

    if (this.conveyor.isFull()) {
      return "conveyorFull";
    }

    return null;
  }

  private validateToolUse(): BattleRejectReason | null {
    if (this.phaseValue === BattlePhase.Won) {
      return "battleAlreadyWon";
    }
    if (this.isProcessing || this.phaseValue !== BattlePhase.WaitingInput) {
      return "battleNotWaitingInput";
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

  private resolveSandUntilIdle(events: BattleStageEvent[], phaseSequence: BattlePhase[]): void {
    const maxCycles = Math.max(2, this.grid.width * this.grid.height * 2);
    let cycles = 0;

    while (cycles < maxCycles) {
      cycles += 1;

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
          settlementSteps: createSettlementSteps(this.actionIndex, schedule, gravity),
        }),
      );

      this.enterPhase(BattlePhase.BucketCompleteResolve, phaseSequence);
      const preCompleteSlots = this.conveyor.snapshot().slots;
      const completedBucketInstanceIds = this.resolveCompletedBuckets();
      events.push(
        Object.freeze({
          type: "bucketCompleteResolved",
          phase: BattlePhase.BucketCompleteResolve,
          completedBucketInstanceIds,
          completedBucketSlotIndexes: Object.freeze(completedBucketInstanceIds.map((instanceId) => preCompleteSlots.indexOf(instanceId))),
          conveyor: this.conveyor.snapshot(),
        }),
      );

      if (schedule.assignedCount === 0 && gravity.totalMoves === 0) {
        return;
      }
    }

    throw new Error("Sand settlement did not reach an idle state.");
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
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.snapshotBucket(instanceId))),
      random: this.random.snapshot(),
      mergeSequence: this.mergeSystem.snapshotSequence(),
      actionIndex: this.actionIndex,
    });
  }

  private restoreInternalSnapshot(snapshot: BattleInternalSnapshot): void {
    const validatedSnapshot = cloneAndValidateBattleSnapshot(snapshot);
    const nextGrid = SandGrid.fromSnapshot(validatedSnapshot.grid);
    const nextRandom = SeededRandom.fromSnapshot(validatedSnapshot.random);
    const nextBucketsAndConveyor = this.buildBucketsAndConveyor(validatedSnapshot.buckets, validatedSnapshot.conveyor);

    this.phaseValue = validatedSnapshot.phase;
    this.grid = nextGrid;
    this.random = nextRandom;
    this.mergeSystem.restoreSequence(validatedSnapshot.mergeSequence);
    this.actionIndex = validatedSnapshot.actionIndex;
    this.bucketsById = nextBucketsAndConveyor.bucketsById;
    this.bucketOrder = nextBucketsAndConveyor.bucketOrder;
    this.bucketPoolSlotById = nextBucketsAndConveyor.bucketPoolSlotById;
    this.conveyor = nextBucketsAndConveyor.conveyor;
  }

  private restoreBucketsAndConveyor(bucketStates: readonly BucketState[], conveyorState: ConveyorState): void {
    const nextState = this.buildBucketsAndConveyor(bucketStates, conveyorState);
    this.bucketsById = nextState.bucketsById;
    this.bucketOrder = nextState.bucketOrder;
    this.bucketPoolSlotById = nextState.bucketPoolSlotById;
    this.conveyor = nextState.conveyor;
  }

  private buildBucketsAndConveyor(
    bucketStates: readonly BucketState[],
    conveyorState: ConveyorState,
  ): {
    readonly bucketsById: Map<string, Bucket>;
    readonly bucketOrder: string[];
    readonly bucketPoolSlotById: Map<string, number>;
    readonly conveyor: ConveyorSystem;
  } {
    const nextBucketsById = new Map<string, Bucket>();
    const nextBucketOrder: string[] = [];
    const nextBucketPoolSlotById = new Map<string, number>();
    const nextConveyor = createConveyor(conveyorState.maxSlots);

    for (let index = 0; index < bucketStates.length; index += 1) {
      const state = bucketStates[index];
      if (nextBucketsById.has(state.instanceId)) {
        throw new Error(`Duplicate bucket in battle snapshot: ${state.instanceId}.`);
      }
      nextBucketOrder.push(state.instanceId);
      const poolSlotIndex = state.poolSlotIndex ?? (state.status === "available" ? index : undefined);
      if (poolSlotIndex !== undefined) {
        validatePoolSlotIndex(poolSlotIndex, state.instanceId);
        nextBucketPoolSlotById.set(state.instanceId, poolSlotIndex);
      }
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

    return Object.freeze({
      bucketsById: nextBucketsById,
      bucketOrder: nextBucketOrder,
      bucketPoolSlotById: nextBucketPoolSlotById,
      conveyor: nextConveyor,
    });
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
      ...this.bucketOrder.map((instanceId) => this.snapshotBucket(instanceId)),
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
    this.bucketPoolSlotById.set(bucket.instanceId, this.bucketOrder.length - 1);
  }

  private requireBucket(instanceId: string): Bucket {
    const bucket = this.bucketsById.get(instanceId);
    if (bucket === undefined) {
      throw new Error(`Bucket is not in battle state: ${instanceId}.`);
    }
    return bucket;
  }

  private snapshotBucket(instanceId: string): BucketState {
    const snapshot = this.requireBucket(instanceId).snapshot();
    const poolSlotIndex = this.bucketPoolSlotById.get(instanceId);
    if (poolSlotIndex === undefined) {
      return snapshot;
    }
    return Object.freeze({
      ...snapshot,
      poolSlotIndex,
    });
  }

  private assignPoolSlotsFromOrder(order: readonly string[]): void {
    this.bucketPoolSlotById.clear();
    for (let index = 0; index < order.length; index += 1) {
      this.bucketPoolSlotById.set(order[index], index);
    }
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

  private freezeToolActionResult(result: BattleToolActionResult): BattleToolActionResult {
    return Object.freeze({
      accepted: result.accepted,
      action: result.action,
      beforePhase: result.beforePhase,
      afterPhase: result.afterPhase,
      snapshot: result.snapshot,
      hint: result.hint,
      shuffledBucketInstanceIds: Object.freeze([...result.shuffledBucketInstanceIds]),
      rejectReason: result.rejectReason,
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

function createSettlementSteps(
  actionId: number,
  schedule: AbsorbScheduleResult,
  gravity: GravitySettlementResult,
): readonly SettlementStep[] {
  const steps: SettlementStep[] = [];
  for (const allocation of schedule.allocations) {
    steps.push(Object.freeze({
      kind: "absorb" as const,
      actionId,
      bucketId: allocation.bucketInstanceId,
      cells: allocation.sand,
      amountAfter: allocation.bucketAmountAfter,
    }));
  }

  const gravityMovesByIteration = new Map<number, typeof gravity.moveTraces>();
  for (const move of gravity.moveTraces) {
    const moves = gravityMovesByIteration.get(move.iteration) ?? [];
    gravityMovesByIteration.set(move.iteration, Object.freeze([...moves, move]));
  }
  for (const [iteration, moves] of [...gravityMovesByIteration.entries()].sort(([left], [right]) => left - right)) {
    steps.push(Object.freeze({
      kind: "gravity" as const,
      actionId,
      iteration,
      moves,
    }));
  }
  return Object.freeze(steps);
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

function validatePoolSlotIndex(poolSlotIndex: number, instanceId: string): void {
  if (!Number.isSafeInteger(poolSlotIndex) || poolSlotIndex < 0) {
    throw new RangeError(`Battle bucket poolSlotIndex must be a non-negative safe integer: ${instanceId}.`);
  }
}

function validateBucketInstanceId(bucketInstanceId: string): void {
  if (typeof bucketInstanceId !== "string" || bucketInstanceId.length === 0) {
    throw new TypeError("Bucket instanceId must be a non-empty string.");
  }
}

function validateToolAction(action: BattleToolAction): void {
  if (action !== "hint" && action !== "shuffle") {
    throw new TypeError("Battle tool action must be hint or shuffle.");
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
    return next === BattlePhase.ResultCheck || next === BattlePhase.ExposedSandResolve;
  }
  if (current === BattlePhase.ResultCheck) {
    return next === BattlePhase.WaitingInput || next === BattlePhase.Won || next === BattlePhase.Failed;
  }
  return false;
}
