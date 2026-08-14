import { BattlePhase, type BattleToolActionResult, type BattleViewSnapshot } from "./BattleState";
import { detectDeadlock, type DeadlockDetectionResult } from "./Outcome";
import { DEFAULT_BATTLE_SIMULATION_CONFIG, type BattleSimulationConfig } from "./BattleSimulationConfig";
import { type BattleToolAction, type TargetedBattleToolAction, resolveBattleHint, shuffleAvailableBucketOrder } from "./BattleToolRules";
import { type AbsorbedSandCell } from "./Settlement";
import { Bucket, createBucket, type BucketState } from "../bucket/Bucket";
import { getBucketPoolSelectionReason } from "../bucket/BucketPool";
import { ConveyorSystem, createConveyor, type ConveyorState } from "../bucket/Conveyor";
import { createMergeSystem, type MergeResult, type MergeSystem } from "../bucket/Merge";
import { detectExposedSand } from "../core/Exposure";
import { applyGravityStep, hasPendingGravity, type GravityMoveTrace, type GravitySettleOptions } from "../core/Gravity";
import { SeededRandom, type RandomSnapshot } from "../core/Random";
import { SandGrid, type SandGridSnapshot } from "../core/SandGrid";

export interface BattleSimulationOptions {
  readonly grid: SandGrid;
  readonly buckets: readonly Bucket[];
  readonly conveyor?: ConveyorSystem;
  readonly random: SeededRandom;
  readonly config?: Partial<BattleSimulationConfig>;
  readonly gravityOptions?: GravitySettleOptions;
}

export interface BucketAmountDelta {
  readonly bucketInstanceId: string;
  readonly colorId: number;
  readonly amountBefore: number;
  readonly amountAfter: number;
  readonly delta: number;
  readonly capacity: number;
  readonly slotIndex: number;
  readonly absorbedCellIndices: readonly number[];
}

export interface BattleSimulationFrame {
  readonly tick: number;
  readonly revision: number;
  readonly absorbedCellIndices: readonly number[];
  readonly gravityMoves: readonly GravityMoveTrace[];
  readonly gravityIterations: readonly (readonly GravityMoveTrace[])[];
  readonly bucketAmountDeltas: readonly BucketAmountDelta[];
  readonly enqueuedBucketId: string | null;
  readonly enqueuedSlotIndex: number | null;
  readonly completedBucketIds: readonly string[];
  readonly completedSlotIndexes: readonly number[];
  readonly mergeResults: readonly MergeResult[];
  readonly exitResults: readonly string[];
  readonly battleState: BattleViewSnapshot;
  readonly won: boolean;
  readonly failed: boolean;
  readonly deadlock: DeadlockDetectionResult;
}

export interface EnqueueBucketSelectionResult {
  readonly accepted: boolean;
  readonly bucketInstanceId: string;
  readonly slotIndex: number | null;
  readonly reason?: string;
}

export class BattleSimulation {
  private readonly config: BattleSimulationConfig;
  private readonly gravityOptions: GravitySettleOptions;
  private grid: SandGrid;
  private conveyor: ConveyorSystem;
  private random: SeededRandom;
  private mergeSystem: MergeSystem;
  private bucketsById = new Map<string, Bucket>();
  private bucketOrder: string[] = [];
  private bucketPoolSlotById = new Map<string, number>();
  private pendingSelections: string[] = [];
  private phaseValue: BattlePhase = BattlePhase.WaitingInput;
  private tickIndex = 0;
  private revision = 0;
  private disposed = false;
  private readonly initialSnapshot: BattleSimulationInternalSnapshot;

  public constructor(options: BattleSimulationOptions) {
    validateOptions(options);
    this.config = Object.freeze({ ...DEFAULT_BATTLE_SIMULATION_CONFIG, ...(options.config ?? {}) });
    this.gravityOptions = { ...(options.gravityOptions ?? {}) };
    this.grid = options.grid.clone();
    this.conveyor = createConveyor(options.conveyor?.maxSlots);
    this.random = SeededRandom.fromSnapshot(options.random.snapshot());
    this.mergeSystem = createMergeSystem();
    for (const bucket of options.buckets) {
      this.addBucketToPool(bucket.clone());
    }
    if (options.conveyor !== undefined) {
      this.restoreBucketsAndConveyor(
        [
          ...this.bucketOrder.map((instanceId) => this.snapshotBucket(instanceId)),
          ...options.conveyor.bucketsSnapshot()
            .filter((bucket) => !this.bucketsById.has(bucket.instanceId))
            .map((bucket) => bucket.snapshot()),
        ],
        options.conveyor.snapshot(),
      );
    }
    this.initialSnapshot = this.createInternalSnapshot();
  }

  public enqueueBucketSelection(bucketInstanceId: string): EnqueueBucketSelectionResult {
    if (this.disposed) {
      return Object.freeze({ accepted: false, bucketInstanceId, slotIndex: null, reason: "disposed" });
    }
    if (this.phaseValue === BattlePhase.Won || this.phaseValue === BattlePhase.Failed) {
      return Object.freeze({ accepted: false, bucketInstanceId, slotIndex: null, reason: "battleEnded" });
    }
    const bucket = this.bucketsById.get(bucketInstanceId);
    if (bucket === undefined) {
      return Object.freeze({ accepted: false, bucketInstanceId, slotIndex: null, reason: "bucketNotFound" });
    }
    if (bucket.status !== "available") {
      return Object.freeze({ accepted: false, bucketInstanceId, slotIndex: null, reason: "bucketNotSelectable" });
    }
    const poolReason = getBucketPoolSelectionReason(this.bucketOrder.map((instanceId) => this.requireBucket(instanceId).snapshot()), bucketInstanceId);
    if (poolReason === "bucketNotColumnFront") {
      return Object.freeze({ accepted: false, bucketInstanceId, slotIndex: null, reason: "bucketNotColumnFront" });
    }
    const reservedSlots = this.pendingSelections.length;
    if (this.conveyor.count + reservedSlots >= this.conveyor.maxSlots) {
      return Object.freeze({ accepted: false, bucketInstanceId, slotIndex: null, reason: "conveyorFull" });
    }
    if (this.pendingSelections.includes(bucketInstanceId)) {
      return Object.freeze({ accepted: false, bucketInstanceId, slotIndex: null, reason: "bucketAlreadyPending" });
    }
    const slotIndex = this.conveyor.count + reservedSlots;
    this.pendingSelections.push(bucketInstanceId);
    return Object.freeze({ accepted: true, bucketInstanceId, slotIndex });
  }

  public useTool(action: BattleToolAction): BattleToolActionResult {
    const before = this.getSnapshot();
    if (action !== "hint" && action !== "shuffle") {
      return this.freezeToolActionResult({
        accepted: false,
        action,
        beforePhase: before.phase,
        afterPhase: before.phase,
        snapshot: before,
        hint: null,
        shuffledBucketInstanceIds: [],
        rejectReason: "toolNotFound",
      });
    }
    const rejectedReason = this.validateToolUse();
    if (rejectedReason !== null) {
      return this.freezeToolActionResult({
        accepted: false,
        action,
        beforePhase: before.phase,
        afterPhase: before.phase,
        snapshot: before,
        hint: null,
        shuffledBucketInstanceIds: [],
        rejectReason: rejectedReason,
      });
    }

    if (action === "hint") {
      return this.freezeToolActionResult({
        accepted: true,
        action,
        beforePhase: before.phase,
        afterPhase: before.phase,
        hint: resolveBattleHint({ grid: before.grid, buckets: before.buckets }),
        shuffledBucketInstanceIds: [],
        snapshot: before,
      });
    }

    const nextOrder = shuffleAvailableBucketOrder({ buckets: before.buckets, random: this.random });
    this.bucketOrder = [...nextOrder];
    this.assignPoolSlotsFromOrder(this.bucketOrder);
    this.revision += 1;
    const after = this.getSnapshot();
    return this.freezeToolActionResult({
      accepted: true,
      action,
      beforePhase: before.phase,
      afterPhase: after.phase,
      hint: null,
      shuffledBucketInstanceIds: nextOrder,
      snapshot: after,
    });
  }

  public useTargetedTool(action: TargetedBattleToolAction, bucketInstanceId: string): BattleToolActionResult {
    const before = this.getSnapshot();
    const rejectedReason = this.validateToolUse();
    if (rejectedReason !== null) {
      return this.freezeToolActionResult({
        accepted: false,
        action,
        beforePhase: before.phase,
        afterPhase: before.phase,
        snapshot: before,
        hint: null,
        shuffledBucketInstanceIds: [],
        rejectReason: rejectedReason,
      });
    }

    const bucket = this.bucketsById.get(bucketInstanceId);
    if (bucket === undefined) {
      return this.rejectTargetedTool(action, before, "bucketNotFound");
    }

    if (action === "removePoolBucket") {
      if (bucket.status !== "available") {
        return this.rejectTargetedTool(action, before, "bucketNotSelectable");
      }
      this.clearMatchingSandForRemovedBucket(bucket);
      this.removeBucketFromBattle(bucketInstanceId);
    } else {
      if (bucket.status !== "inConveyor" || this.conveyor.findBucket(bucketInstanceId) === null) {
        return this.rejectTargetedTool(action, before, "bucketNotSelectable");
      }
      this.clearMatchingSandForRemovedBucket(bucket);
      this.conveyor.removeBucketByInstanceId(bucketInstanceId);
      this.removeBucketFromBattle(bucketInstanceId);
    }

    this.revision += 1;
    const after = this.getSnapshot();
    return this.freezeToolActionResult({
      accepted: true,
      action,
      beforePhase: before.phase,
      afterPhase: after.phase,
      hint: null,
      shuffledBucketInstanceIds: [],
      snapshot: after,
    });
  }

  public tick(): BattleSimulationFrame {
    if (this.disposed) {
      throw new Error("BattleSimulation has been disposed.");
    }
    this.tickIndex += 1;
    this.revision += 1;

    const enqueued = this.applyOnePendingSelection();
    const bucketAmountDeltas = this.absorbForActiveBuckets();
    const gravityIterations = this.applyGravityIterations();
    const completed = this.findFullBuckets();
    const mergeResults = this.applyMergesUntilIdle();
    const exitResults = this.exitCompletedBuckets(completed.ids);
    const deadlock = this.checkOutcome();
    const won = deadlock.isVictory;
    const failed = deadlock.isDeadlocked;
    this.phaseValue = won ? BattlePhase.Won : failed ? BattlePhase.Failed : BattlePhase.WaitingInput;

    return Object.freeze({
      tick: this.tickIndex,
      revision: this.revision,
      absorbedCellIndices: Object.freeze(bucketAmountDeltas.flatMap((delta) => [...delta.absorbedCellIndices])),
      gravityMoves: Object.freeze(gravityIterations.flatMap((moves) => [...moves])),
      gravityIterations: Object.freeze(gravityIterations),
      bucketAmountDeltas: Object.freeze(bucketAmountDeltas),
      enqueuedBucketId: enqueued?.bucketInstanceId ?? null,
      enqueuedSlotIndex: enqueued?.slotIndex ?? null,
      completedBucketIds: completed.ids,
      completedSlotIndexes: completed.slotIndexes,
      mergeResults: Object.freeze(mergeResults),
      exitResults,
      battleState: this.getSnapshot(),
      won,
      failed,
      deadlock,
    });
  }

  public getSnapshot(): BattleViewSnapshot {
    return Object.freeze({
      phase: this.phaseValue,
      grid: this.grid.snapshot(),
      conveyor: this.conveyor.snapshot(),
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.snapshotBucket(instanceId))),
      random: this.random.snapshot(),
      actionIndex: this.revision,
    });
  }

  public isIdle(): boolean {
    return this.pendingSelections.length === 0 &&
      this.phaseValue === BattlePhase.WaitingInput &&
      !this.hasWork() &&
      !hasPendingGravity(this.grid);
  }

  public reset(): void {
    this.restoreInternalSnapshot(this.initialSnapshot);
    this.pendingSelections = [];
    this.disposed = false;
  }

  public dispose(): void {
    this.pendingSelections = [];
    this.disposed = true;
  }

  private validateToolUse(): BattleToolActionResult["rejectReason"] | null {
    if (this.disposed) {
      return "battleNotWaitingInput";
    }
    if (this.phaseValue === BattlePhase.Won || this.phaseValue === BattlePhase.Failed) {
      return "battleAlreadyWon";
    }
    if (this.phaseValue !== BattlePhase.WaitingInput || this.pendingSelections.length > 0 || this.hasWork() || hasPendingGravity(this.grid)) {
      return "battleNotWaitingInput";
    }
    return null;
  }

  private rejectTargetedTool(
    action: TargetedBattleToolAction,
    snapshot: BattleViewSnapshot,
    rejectReason: NonNullable<BattleToolActionResult["rejectReason"]>,
  ): BattleToolActionResult {
    return this.freezeToolActionResult({
      accepted: false,
      action,
      beforePhase: snapshot.phase,
      afterPhase: snapshot.phase,
      snapshot,
      hint: null,
      shuffledBucketInstanceIds: [],
      rejectReason,
    });
  }

  private freezeToolActionResult(result: BattleToolActionResult): BattleToolActionResult {
    return freezeBattleToolActionResult(result);
  }

  private applyOnePendingSelection(): { readonly bucketInstanceId: string; readonly slotIndex: number } | null {
    const bucketInstanceId = this.pendingSelections.shift();
    if (bucketInstanceId === undefined) {
      return null;
    }
    const bucket = this.requireBucket(bucketInstanceId);
    const result = this.conveyor.addBucket(bucket);
    return Object.freeze({ bucketInstanceId, slotIndex: result.slotIndex });
  }

  private absorbForActiveBuckets(): BucketAmountDelta[] {
    const deltas: BucketAmountDelta[] = [];
    const buckets = this.conveyor.bucketsSnapshot();
    for (let slotIndex = 0; slotIndex < buckets.length; slotIndex += 1) {
      const bucket = buckets[slotIndex];
      if (bucket.remainingCapacity <= 0) {
        continue;
      }
      const exposed = detectExposedSand(this.grid, { colorId: bucket.colorId }).exposedSand;
      if (exposed.length === 0) {
        continue;
      }
      const cells = exposed.slice(0, Math.min(
        this.config.maxAbsorbCellsPerBucketPerTick,
        bucket.remainingCapacity,
      ));
      if (cells.length === 0) {
        continue;
      }
      for (const cell of cells) {
        this.grid.clear(cell.x, cell.y);
      }
      const amountBefore = bucket.currentAmount;
      const fill = bucket.fill(cells.length);
      deltas.push(Object.freeze({
        bucketInstanceId: bucket.instanceId,
        colorId: bucket.colorId,
        amountBefore,
        amountAfter: fill.bucket.amount,
        delta: fill.acceptedAmount,
        capacity: bucket.capacity,
        slotIndex,
        absorbedCellIndices: Object.freeze(cells.map((cell) => cell.index)),
      }));
    }
    return deltas;
  }

  private applyGravityIterations(): readonly (readonly GravityMoveTrace[])[] {
    const iterations: GravityMoveTrace[][] = [];
    const maxIterations = Math.min(this.config.gravityIterationsPerTick, this.gravityOptions.maxIterations ?? this.config.gravityIterationsPerTick);
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const result = applyGravityStep(this.grid, this.random);
      if (!result.moved) {
        break;
      }
      iterations.push([...result.moveTraces]);
    }
    return Object.freeze(iterations.map((moves) => Object.freeze(moves)));
  }

  private findFullBuckets(): { readonly ids: readonly string[]; readonly slotIndexes: readonly number[] } {
    const ids: string[] = [];
    const slotIndexes: number[] = [];
    const buckets = this.conveyor.bucketsSnapshot();
    for (let slotIndex = 0; slotIndex < buckets.length; slotIndex += 1) {
      const bucket = buckets[slotIndex];
      if (bucket.isFull()) {
        ids.push(bucket.instanceId);
        slotIndexes.push(slotIndex);
      }
    }
    return Object.freeze({ ids: Object.freeze(ids), slotIndexes: Object.freeze(slotIndexes) });
  }

  private applyMergesUntilIdle(): MergeResult[] {
    const results: MergeResult[] = [];
    while (true) {
      const result = this.mergeSystem.mergeOnce(this.conveyor);
      if (!result.merged) {
        break;
      }
      for (const participant of result.participantBuckets) {
        this.bucketsById.delete(participant.instanceId);
        this.bucketOrder = this.bucketOrder.filter((instanceId) => instanceId !== participant.instanceId);
      }
      if (result.mergedBucket !== null) {
        const merged = this.conveyor.findBucket(result.mergedBucket.instanceId);
        if (merged !== null) {
          this.bucketsById.set(merged.instanceId, merged);
          this.bucketOrder.splice(result.insertIndex ?? this.bucketOrder.length, 0, merged.instanceId);
        }
      }
      results.push(result);
    }
    return results;
  }

  private exitCompletedBuckets(candidateIds: readonly string[]): readonly string[] {
    const exited: string[] = [];
    for (const instanceId of candidateIds) {
      const bucket = this.conveyor.findBucket(instanceId);
      if (bucket === null || !bucket.isFull()) {
        continue;
      }
      bucket.completeAndLeave();
      this.conveyor.removeBucketByInstanceId(instanceId);
      exited.push(instanceId);
    }
    return Object.freeze(exited);
  }

  private checkOutcome(): DeadlockDetectionResult {
    return detectDeadlock({
      grid: this.grid,
      conveyor: this.conveyor,
      phase: BattlePhase.ResultCheck,
      mergeSystem: this.mergeSystem,
    });
  }

  private hasWork(): boolean {
    if (this.pendingSelections.length > 0) {
      return true;
    }
    for (const bucket of this.conveyor.bucketsSnapshot()) {
      if (bucket.remainingCapacity > 0 && detectExposedSand(this.grid, { colorId: bucket.colorId }).exposedSand.length > 0) {
        return true;
      }
    }
    return false;
  }

  private createInternalSnapshot(): BattleSimulationInternalSnapshot {
    return Object.freeze({
      phase: this.phaseValue,
      grid: this.grid.snapshot(),
      conveyor: this.conveyor.snapshot(),
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.snapshotBucket(instanceId))),
      random: this.random.snapshot(),
      mergeSequence: this.mergeSystem.snapshotSequence(),
      tickIndex: this.tickIndex,
      revision: this.revision,
    });
  }

  private restoreInternalSnapshot(snapshot: BattleSimulationInternalSnapshot): void {
    this.phaseValue = snapshot.phase;
    this.grid = SandGrid.fromSnapshot(snapshot.grid);
    this.random = SeededRandom.fromSnapshot(snapshot.random);
    this.mergeSystem.restoreSequence(snapshot.mergeSequence);
    this.tickIndex = snapshot.tickIndex;
    this.revision = snapshot.revision;
    this.restoreBucketsAndConveyor(snapshot.buckets, snapshot.conveyor);
  }

  private restoreBucketsAndConveyor(bucketStates: readonly BucketState[], conveyorState: ConveyorState): void {
    const bucketsById = new Map<string, Bucket>();
    const bucketOrder = bucketStates.map((state) => state.instanceId);
    const bucketPoolSlotById = new Map<string, number>();
    const conveyor = createConveyor(conveyorState.maxSlots);
    for (let index = 0; index < bucketStates.length; index += 1) {
      const state = bucketStates[index];
      const poolSlotIndex = state.poolSlotIndex ?? (state.status === "available" ? index : undefined);
      if (poolSlotIndex !== undefined) {
        validatePoolSlotIndex(poolSlotIndex, state.instanceId);
        bucketPoolSlotById.set(state.instanceId, poolSlotIndex);
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
      conveyor.addBucket(bucket);
      bucketsById.set(instanceId, bucket);
    }
    for (const state of bucketStates) {
      if (!bucketsById.has(state.instanceId)) {
        bucketsById.set(state.instanceId, Bucket.fromSnapshot(state));
      }
    }
    this.bucketsById = bucketsById;
    this.bucketOrder = bucketOrder;
    this.bucketPoolSlotById = bucketPoolSlotById;
    this.conveyor = conveyor;
  }

  private addBucketToPool(bucket: Bucket): void {
    if (this.bucketsById.has(bucket.instanceId)) {
      throw new Error(`Duplicate battle bucket instanceId: ${bucket.instanceId}.`);
    }
    this.bucketsById.set(bucket.instanceId, bucket);
    this.bucketOrder.push(bucket.instanceId);
    this.bucketPoolSlotById.set(bucket.instanceId, this.bucketOrder.length - 1);
  }

  private removeBucketFromBattle(bucketInstanceId: string): void {
    this.bucketsById.delete(bucketInstanceId);
    this.bucketOrder = this.bucketOrder.filter((instanceId) => instanceId !== bucketInstanceId);
    this.bucketPoolSlotById.delete(bucketInstanceId);
    this.pendingSelections = this.pendingSelections.filter((instanceId) => instanceId !== bucketInstanceId);
  }

  private clearMatchingSandForRemovedBucket(bucket: Bucket): number {
    const absorbCount = Math.max(0, bucket.remainingCapacity);
    if (absorbCount === 0) {
      return 0;
    }
    let cleared = 0;
    for (let y = 0; y < this.grid.height && cleared < absorbCount; y += 1) {
      for (let x = 0; x < this.grid.width && cleared < absorbCount; x += 1) {
        if (this.grid.get(x, y) !== bucket.colorId) {
          continue;
        }
        this.grid.clear(x, y);
        cleared += 1;
      }
    }
    return cleared;
  }

  private requireBucket(instanceId: string): Bucket {
    const bucket = this.bucketsById.get(instanceId);
    if (bucket === undefined) {
      throw new Error(`Bucket is not in battle simulation: ${instanceId}.`);
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
}

interface BattleSimulationInternalSnapshot {
  readonly phase: BattlePhase;
  readonly grid: SandGridSnapshot;
  readonly conveyor: ConveyorState;
  readonly buckets: readonly BucketState[];
  readonly random: RandomSnapshot;
  readonly mergeSequence: number;
  readonly tickIndex: number;
  readonly revision: number;
}

export function createBattleSimulation(options: BattleSimulationOptions): BattleSimulation {
  return new BattleSimulation(options);
}

function freezeBattleToolActionResult(result: BattleToolActionResult): BattleToolActionResult {
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

function validateOptions(options: BattleSimulationOptions): void {
  if (!(options.grid instanceof SandGrid)) {
    throw new TypeError("BattleSimulation requires a SandGrid.");
  }
  if (!Array.isArray(options.buckets)) {
    throw new TypeError("BattleSimulation buckets must be an array.");
  }
  if (!(options.random instanceof SeededRandom)) {
    throw new TypeError("BattleSimulation requires a SeededRandom.");
  }
}

function validatePoolSlotIndex(poolSlotIndex: number, instanceId: string): void {
  if (!Number.isSafeInteger(poolSlotIndex) || poolSlotIndex < 0) {
    throw new RangeError(`Battle simulation bucket poolSlotIndex must be a non-negative safe integer: ${instanceId}.`);
  }
}
