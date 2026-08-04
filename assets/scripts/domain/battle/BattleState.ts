import type { AbsorbScheduleResult, AbsorbedSandCell } from "./Settlement";
import type { DeadlockDetectionResult } from "./Outcome";
import type { BucketState } from "../bucket/Bucket";
import type { ConveyorState } from "../bucket/Conveyor";
import type { MergeResult } from "../bucket/Merge";
import type { GravityMoveTrace, GravitySettlementResult } from "../core/Gravity";
import type { RandomSnapshot } from "../core/Random";
import type { SandGridSnapshot } from "../core/SandGrid";

export const BattlePhase = Object.freeze({
  WaitingInput: "WaitingInput",
  BucketEnqueue: "BucketEnqueue",
  MergeResolve: "MergeResolve",
  ExposedSandResolve: "ExposedSandResolve",
  AbsorbResolve: "AbsorbResolve",
  SandGravity: "SandGravity",
  BucketCompleteResolve: "BucketCompleteResolve",
  ResultCheck: "ResultCheck",
  Won: "Won",
  Failed: "Failed",
} as const);

export type BattlePhase = (typeof BattlePhase)[keyof typeof BattlePhase];

export type BattleRejectReason =
  | "battleNotWaitingInput"
  | "battleAlreadyWon"
  | "bucketNotFound"
  | "bucketNotSelectable"
  | "bucketNotColumnFront"
  | "conveyorFull"
  | "settlementError";

export interface BattleViewSnapshot {
  readonly phase: BattlePhase;
  readonly grid: SandGridSnapshot;
  readonly conveyor: ConveyorState;
  readonly buckets: readonly BucketState[];
  readonly random: RandomSnapshot;
  readonly actionIndex: number;
}

export interface BucketEnqueuedEvent {
  readonly type: "bucketEnqueued";
  readonly phase: typeof BattlePhase.BucketEnqueue;
  readonly bucketInstanceId: string;
  readonly slotIndex: number;
  readonly conveyor: ConveyorState;
}

export interface MergeResolvedEvent {
  readonly type: "mergeResolved";
  readonly phase: typeof BattlePhase.MergeResolve;
  readonly result: MergeResult;
}

export interface ExposedSandResolvedEvent {
  readonly type: "exposedSandResolved";
  readonly phase: typeof BattlePhase.ExposedSandResolve;
  readonly exposedSand: readonly AbsorbedSandCell[];
}

export interface AbsorbResolvedEvent {
  readonly type: "absorbResolved";
  readonly phase: typeof BattlePhase.AbsorbResolve;
  readonly schedule: AbsorbScheduleResult;
}

export interface SandGravityResolvedEvent {
  readonly type: "sandGravityResolved";
  readonly phase: typeof BattlePhase.SandGravity;
  readonly result: GravitySettlementResult;
  readonly grid: SandGridSnapshot;
  readonly settlementSteps: readonly SettlementStep[];
}

export type SettlementStep =
  | {
      readonly kind: "absorb";
      readonly actionId: number;
      readonly bucketId: string;
      readonly cells: readonly AbsorbedSandCell[];
      readonly amountAfter: number;
    }
  | {
      readonly kind: "gravity";
      readonly actionId: number;
      readonly iteration: number;
      readonly moves: readonly GravityMoveTrace[];
    };

export interface BucketCompleteResolvedEvent {
  readonly type: "bucketCompleteResolved";
  readonly phase: typeof BattlePhase.BucketCompleteResolve;
  readonly completedBucketInstanceIds: readonly string[];
  readonly completedBucketSlotIndexes: readonly number[];
  readonly conveyor: ConveyorState;
}

export interface ResultCheckedEvent {
  readonly type: "resultChecked";
  readonly phase: typeof BattlePhase.ResultCheck;
  readonly won: boolean;
  readonly failed: boolean;
  readonly failureReason?: string;
  readonly deadlock: DeadlockDetectionResult;
}

export type BattleStageEvent =
  | BucketEnqueuedEvent
  | MergeResolvedEvent
  | ExposedSandResolvedEvent
  | AbsorbResolvedEvent
  | SandGravityResolvedEvent
  | BucketCompleteResolvedEvent
  | ResultCheckedEvent;

export interface BattleActionResult {
  readonly accepted: boolean;
  readonly action: "selectBucket" | "restart";
  readonly bucketInstanceId: string;
  readonly beforePhase: BattlePhase;
  readonly afterPhase: BattlePhase;
  readonly phaseSequence: readonly BattlePhase[];
  readonly events: readonly BattleStageEvent[];
  readonly snapshot: BattleViewSnapshot;
  readonly rejectReason?: BattleRejectReason;
  readonly errorMessage?: string;
}
