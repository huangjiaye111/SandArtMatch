import type { BattleViewSnapshot, SettlementStep } from "../../domain/battle/BattleState";
import type { AbsorbAllocation, AbsorbedSandCell } from "../../domain/battle/Settlement";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { ConveyorState } from "../../domain/bucket/Conveyor";
import type { GravityMoveTrace, GravitySettlementResult } from "../../domain/core/Gravity";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";

export type BattlePresentationEvent =
  | {
      readonly type: "invalidClick";
      readonly message: string;
    }
  | {
      readonly type: "bucketClicked";
      readonly bucketInstanceId: string;
    }
  | {
      readonly type: "bucketEnteredConveyor";
      readonly bucketInstanceId: string;
      readonly slotIndex: number;
    }
  | {
      readonly type: "exposedSandHighlighted";
      readonly cells: readonly AbsorbedSandCell[];
    }
  | {
      readonly type: "sandAbsorbed";
      readonly allocations: readonly AbsorbAllocation[];
      readonly assignedCount: number;
      readonly absorptionEvents: readonly AbsorptionPresentationEvent[];
    }
  | {
      readonly type: "sandGravitySettled";
      readonly revision: number;
      readonly actionId: number;
      readonly moves: readonly GravityMoveTrace[];
      readonly result: GravitySettlementResult;
      readonly grid: SandGridSnapshot;
      readonly totalMoves: number;
      readonly settlementSteps: readonly SettlementStep[];
    }
  | {
      readonly type: "merge";
      readonly bucketInstanceIds: readonly string[];
      readonly insertedBucketInstanceId: string | null;
      readonly slotIndex: number | null;
    }
  | {
      readonly type: "fullBucketLeft";
      readonly bucketInstanceIds: readonly string[];
      readonly slotIndexes: readonly number[];
    }
  | {
      readonly type: "sandCanvasRedrawn";
      readonly grid: SandGridSnapshot;
    }
  | {
      readonly type: "victory";
    }
  | {
      readonly type: "deadlock";
      readonly message: string;
    };

export interface AbsorptionPresentationEvent {
  readonly revision: number;
  readonly actionId: number;
  readonly bucketInstanceId: string;
  readonly slotIndex: number;
  readonly colorId: number;
  readonly absorbedCells: readonly AbsorbedSandCell[];
  readonly amountBefore: number;
  readonly amountAfter: number;
  readonly capacity: number;
}

export interface BattleView {
  initialize(snapshot: BattleViewSnapshot): void;
  setLevelText(text: string): void;
  setInputEnabled(enabled: boolean): void;
  renderSandGrid(grid: SandGridSnapshot): void;
  renderConveyor(conveyor: ConveyorState, buckets: readonly BucketState[]): void;
  renderBucketPool(buckets: readonly BucketState[]): void;
  playFeedback(events: readonly BattlePresentationEvent[]): Promise<void>;
  cancelFeedback(): void;
  showFeedback(message: string): void;
  showWin(): void;
  showLose(reason?: string): void;
  hideResult(): void;
  clear(): void;
}

export interface BattleUiActions {
  selectBucket(bucketInstanceId: string): void;
  restart(): void;
}
