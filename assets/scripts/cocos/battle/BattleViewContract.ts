import type { BattleViewSnapshot } from "../../domain/battle/BattleState";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { ConveyorState } from "../../domain/bucket/Conveyor";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";

export interface BattleView {
  initialize(snapshot: BattleViewSnapshot): void;
  setLevelText(text: string): void;
  setInputEnabled(enabled: boolean): void;
  setUndoEnabled(enabled: boolean): void;
  renderSandGrid(grid: SandGridSnapshot): void;
  renderConveyor(conveyor: ConveyorState, buckets: readonly BucketState[]): void;
  renderBucketPool(buckets: readonly BucketState[]): void;
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
