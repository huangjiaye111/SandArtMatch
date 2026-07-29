import type { BattleViewSnapshot } from "../../domain/battle/BattleState";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { ConveyorState } from "../../domain/bucket/Conveyor";
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
      readonly type: "merge";
      readonly bucketInstanceIds: readonly string[];
      readonly insertedBucketInstanceId: string | null;
      readonly slotIndex: number | null;
    }
  | {
      readonly type: "fullBucketLeft";
      readonly bucketInstanceIds: readonly string[];
    }
  | {
      readonly type: "undoRestored";
    }
  | {
      readonly type: "victory";
    }
  | {
      readonly type: "deadlock";
      readonly message: string;
    };

export interface BattleView {
  initialize(snapshot: BattleViewSnapshot): void;
  setLevelText(text: string): void;
  setInputEnabled(enabled: boolean): void;
  setUndoEnabled(enabled: boolean): void;
  renderSandGrid(grid: SandGridSnapshot): void;
  renderConveyor(conveyor: ConveyorState, buckets: readonly BucketState[]): void;
  renderBucketPool(buckets: readonly BucketState[]): void;
  playFeedback(events: readonly BattlePresentationEvent[]): void;
  showFeedback(message: string): void;
  showWin(): void;
  showLose(reason?: string): void;
  hideResult(): void;
  clear(): void;
}

export interface BattleUiActions {
  selectBucket(bucketInstanceId: string): void;
  undo(): void;
}
