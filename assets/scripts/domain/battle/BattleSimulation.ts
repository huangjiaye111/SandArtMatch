import { BattlePhase, type BattleViewSnapshot } from "./BattleState";
import { detectDeadlock, type DeadlockDetectionResult } from "./Outcome";
import { DEFAULT_BATTLE_SIMULATION_CONFIG, type BattleSimulationConfig } from "./BattleSimulationConfig";
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
          ...this.bucketOrder.map((instanceId) => this.requireBucket(instanceId).snapshot()),
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
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.requireBucket(instanceId).snapshot())),
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
      buckets: Object.freeze(this.bucketOrder.map((instanceId) => this.requireBucket(instanceId).snapshot())),
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
    const conveyor = createConveyor(conveyorState.maxSlots);
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
    this.conveyor = conveyor;
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
      throw new Error(`Bucket is not in battle simulation: ${instanceId}.`);
    }
    return bucket;
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
