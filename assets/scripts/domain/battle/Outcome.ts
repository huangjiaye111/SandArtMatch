import { scheduleAbsorption } from "./Settlement";
import { BattlePhase } from "./BattleState";
import { ConveyorSystem } from "../bucket/Conveyor";
import { MergeSystem, createMergeSystem, type MergeCandidate } from "../bucket/Merge";
import { detectExposedSand } from "../core/Exposure";
import { hasPendingGravity as detectPendingGravity } from "../core/Gravity";
import { SandGrid } from "../core/SandGrid";

export type DeadlockReason =
  | "victory"
  | "notStable"
  | "conveyorHasEmptySlot"
  | "pendingBucketCompletion"
  | "pendingGravity"
  | "pendingAbsorption"
  | "pendingMergeResolution"
  | "pendingSpecialResolution"
  | "sandMoving"
  | "availableMerge"
  | "absorbableMove"
  | "deadlocked";

export interface DeadlockDetectionInput {
  readonly grid: SandGrid;
  readonly conveyor: ConveyorSystem;
  readonly phase?: BattlePhase;
  readonly isStable?: boolean;
  readonly mergeSystem?: MergeSystem;
  readonly maxAbsorbCount?: number;
  readonly hasPendingAbsorption?: boolean;
  readonly hasPendingMergeResolution?: boolean;
  readonly hasPendingSpecialResolution?: boolean;
  readonly hasSandMoving?: boolean;
  readonly hasPendingGravity?: boolean;
  readonly hasPendingBucketCompletion?: boolean;
}

export interface DeadlockDetectionResult {
  readonly isDeadlocked: boolean;
  readonly isVictory: boolean;
  readonly isStable: boolean;
  readonly reason: DeadlockReason;
  readonly reasons: readonly DeadlockReason[];
  readonly conveyorFull: boolean;
  readonly hasAvailableMerge: boolean;
  readonly hasAbsorbableMove: boolean;
  readonly hasPendingBucketCompletion: boolean;
  readonly hasPendingGravity: boolean;
  readonly hasPendingResolution: boolean;
  readonly hasPendingAbsorption: boolean;
  readonly hasPendingMergeResolution: boolean;
  readonly hasPendingSpecialResolution: boolean;
  readonly hasSandMoving: boolean;
  readonly remainingSandCount: number;
  readonly exposedSandCount: number;
  readonly mergeCandidate: MergeCandidate | null;
}

const STABLE_DETECTION_PHASES: readonly BattlePhase[] = Object.freeze([
  BattlePhase.WaitingInput,
  BattlePhase.ResultCheck,
]);

export function detectDeadlock(input: DeadlockDetectionInput): DeadlockDetectionResult {
  validateInput(input);

  const remainingSandCount = input.grid.countSand();
  const isVictory = remainingSandCount === 0;
  const isStable = isDetectionStable(input);
  const conveyorFull = input.conveyor.isFull();
  if (isVictory) {
    return createResult("victory", false);
  }

  if (!isStable) {
    return createResult("notStable", false);
  }

  if (!conveyorFull) {
    return createResult("conveyorHasEmptySlot", false);
  }

  const hasPendingBucketCompletion =
    input.hasPendingBucketCompletion === true || input.conveyor.bucketsSnapshot().some((bucket) => bucket.isFull());
  const hasPendingGravity = input.hasPendingGravity === true || detectPendingGravity(input.grid);
  const hasPendingAbsorption = input.hasPendingAbsorption === true;
  const hasPendingMergeResolution = input.hasPendingMergeResolution === true;
  const hasPendingSpecialResolution = input.hasPendingSpecialResolution === true;
  const hasSandMoving = input.hasSandMoving === true;
  const pendingReason = firstPendingReason({
    hasPendingBucketCompletion,
    hasPendingGravity,
    hasPendingAbsorption,
    hasPendingMergeResolution,
    hasPendingSpecialResolution,
    hasSandMoving,
  });
  const hasPendingResolution = pendingReason !== null;

  if (pendingReason !== null) {
    return createResult(pendingReason, false, {
      hasPendingBucketCompletion,
      hasPendingGravity,
      hasPendingResolution,
      hasPendingAbsorption,
      hasPendingMergeResolution,
      hasPendingSpecialResolution,
      hasSandMoving,
    });
  }

  const mergeCandidate = (input.mergeSystem ?? createMergeSystem()).findMergeCandidate(input.conveyor);
  const hasAvailableMerge = mergeCandidate !== null;

  if (hasAvailableMerge) {
    return createResult("availableMerge", false, {
      hasAvailableMerge,
      mergeCandidate,
    });
  }

  const exposedSand = detectExposedSand(input.grid).exposedSand;
  const absorbSchedule = scheduleAbsorption({
    exposedSand,
    buckets: input.conveyor.bucketsSnapshot(),
    maxAbsorbCount: input.maxAbsorbCount,
  });
  const hasAbsorbableMove = absorbSchedule.assignedCount > 0;

  if (hasAbsorbableMove) {
    return createResult("absorbableMove", false, {
      hasAbsorbableMove,
      exposedSandCount: exposedSand.length,
    });
  }

  return createResult("deadlocked", true, {
    exposedSandCount: exposedSand.length,
  });

  function createResult(
    reason: DeadlockReason,
    isDeadlocked: boolean,
    details: Partial<DeadlockDetectionResult> = {},
  ): DeadlockDetectionResult {
    return freezeResult({
      isDeadlocked,
      isVictory,
      isStable,
      reason,
      reasons: [reason],
      conveyorFull,
      hasAvailableMerge: details.hasAvailableMerge ?? false,
      hasAbsorbableMove: details.hasAbsorbableMove ?? false,
      hasPendingBucketCompletion: details.hasPendingBucketCompletion ?? false,
      hasPendingGravity: details.hasPendingGravity ?? false,
      hasPendingResolution: details.hasPendingResolution ?? false,
      hasPendingAbsorption: details.hasPendingAbsorption ?? false,
      hasPendingMergeResolution: details.hasPendingMergeResolution ?? false,
      hasPendingSpecialResolution: details.hasPendingSpecialResolution ?? false,
      hasSandMoving: details.hasSandMoving ?? false,
      remainingSandCount,
      exposedSandCount: details.exposedSandCount ?? 0,
      mergeCandidate: details.mergeCandidate ?? null,
    });
  }
}

function isDetectionStable(input: DeadlockDetectionInput): boolean {
  if (input.isStable === false) {
    return false;
  }

  if (input.phase === undefined) {
    return true;
  }

  return STABLE_DETECTION_PHASES.includes(input.phase);
}

function firstPendingReason(input: {
  readonly hasPendingBucketCompletion: boolean;
  readonly hasPendingGravity: boolean;
  readonly hasPendingAbsorption: boolean;
  readonly hasPendingMergeResolution: boolean;
  readonly hasPendingSpecialResolution: boolean;
  readonly hasSandMoving: boolean;
}): DeadlockReason | null {
  if (input.hasPendingBucketCompletion) {
    return "pendingBucketCompletion";
  }
  if (input.hasPendingGravity) {
    return "pendingGravity";
  }
  if (input.hasPendingAbsorption) {
    return "pendingAbsorption";
  }
  if (input.hasPendingMergeResolution) {
    return "pendingMergeResolution";
  }
  if (input.hasPendingSpecialResolution) {
    return "pendingSpecialResolution";
  }
  if (input.hasSandMoving) {
    return "sandMoving";
  }
  return null;
}

function freezeResult(result: DeadlockDetectionResult): DeadlockDetectionResult {
  return Object.freeze({
    isDeadlocked: result.isDeadlocked,
    isVictory: result.isVictory,
    isStable: result.isStable,
    reason: result.reason,
    reasons: Object.freeze([...result.reasons]),
    conveyorFull: result.conveyorFull,
    hasAvailableMerge: result.hasAvailableMerge,
    hasAbsorbableMove: result.hasAbsorbableMove,
    hasPendingBucketCompletion: result.hasPendingBucketCompletion,
    hasPendingGravity: result.hasPendingGravity,
    hasPendingResolution: result.hasPendingResolution,
    hasPendingAbsorption: result.hasPendingAbsorption,
    hasPendingMergeResolution: result.hasPendingMergeResolution,
    hasPendingSpecialResolution: result.hasPendingSpecialResolution,
    hasSandMoving: result.hasSandMoving,
    remainingSandCount: result.remainingSandCount,
    exposedSandCount: result.exposedSandCount,
    mergeCandidate: result.mergeCandidate,
  });
}

function validateInput(input: DeadlockDetectionInput): void {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Deadlock detection input is required.");
  }
  if (!(input.grid instanceof SandGrid)) {
    throw new TypeError("Deadlock detection requires a SandGrid.");
  }
  if (!(input.conveyor instanceof ConveyorSystem)) {
    throw new TypeError("Deadlock detection requires a ConveyorSystem.");
  }
  if (input.mergeSystem !== undefined && !(input.mergeSystem instanceof MergeSystem)) {
    throw new TypeError("Deadlock detection mergeSystem must be a MergeSystem.");
  }
  if (input.maxAbsorbCount !== undefined && (!Number.isSafeInteger(input.maxAbsorbCount) || input.maxAbsorbCount < 0)) {
    throw new RangeError("Deadlock detection maxAbsorbCount must be a non-negative safe integer.");
  }
}
