import {
  BattlePhase,
  type BattleActionResult,
  type BattleStageEvent,
  type BattleUndoResult,
  type BattleViewSnapshot,
} from "../../domain/battle/BattleState";
import type { BattleStateMachine } from "../../domain/battle/BattleStateMachine";
import type { BattlePresentationEvent, BattleView } from "./BattleViewContract";

export class BattlePresenter {
  private inputEnabled = true;
  private isHandlingAction = false;
  private readonly machine: BattleStateMachine;
  private readonly view: BattleView;
  private readonly levelText: string;

  public constructor(machine: BattleStateMachine, view: BattleView, levelText: string) {
    this.machine = machine;
    this.view = view;
    this.levelText = levelText;
  }

  public initialize(): void {
    const snapshot = this.machine.snapshot();
    this.view.initialize(snapshot);
    this.view.setLevelText(this.levelText);
    this.sync(snapshot);
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.view.setInputEnabled(enabled && this.machine.canAcceptInput());
  }

  public selectBucket(bucketInstanceId: string): void {
    if (!this.inputEnabled || this.isHandlingAction || !this.machine.canAcceptInput()) {
      this.view.showFeedback("Input locked");
      return;
    }

    this.isHandlingAction = true;
    this.view.setInputEnabled(false);
    this.view.setUndoEnabled(false);
    try {
      const result = this.machine.selectBucket(bucketInstanceId);
      this.sync(result.snapshot, result.rejectReason);
      this.view.playFeedback(toPresentationEvents(result));
    } finally {
      this.isHandlingAction = false;
      const snapshot = this.machine.snapshot();
      this.view.setInputEnabled(this.inputEnabled && this.machine.canAcceptInput());
      this.view.setUndoEnabled(this.inputEnabled && snapshot.canUndo);
    }
  }

  public undo(): void {
    if (!this.inputEnabled || this.isHandlingAction) {
      this.view.showFeedback("Input locked");
      return;
    }

    this.isHandlingAction = true;
    this.view.setInputEnabled(false);
    this.view.setUndoEnabled(false);
    try {
      const result = this.machine.undo();
      this.sync(result.snapshot, result.rejectReason);
      this.view.playFeedback(toUndoPresentationEvents(result));
    } finally {
      this.isHandlingAction = false;
      const snapshot = this.machine.snapshot();
      this.view.setInputEnabled(this.inputEnabled && this.machine.canAcceptInput());
      this.view.setUndoEnabled(this.inputEnabled && snapshot.canUndo);
    }
  }

  public refresh(): void {
    this.sync(this.machine.snapshot());
  }

  public clear(): void {
    this.view.clear();
  }

  private sync(snapshot: BattleViewSnapshot, failureReason?: string): void {
    this.view.renderSandGrid(snapshot.grid);
    this.view.renderConveyor(snapshot.conveyor, snapshot.buckets);
    this.view.renderBucketPool(snapshot.buckets);
    this.view.setInputEnabled(this.inputEnabled && this.machine.canAcceptInput());
    this.view.setUndoEnabled(this.inputEnabled && snapshot.canUndo);

    if (snapshot.phase === BattlePhase.Won) {
      this.view.showWin();
      this.view.playFeedback([{ type: "victory" }]);
      return;
    }

    if (snapshot.phase === BattlePhase.Failed) {
      this.view.showLose(failureReason);
      this.view.playFeedback([{ type: "deadlock", message: failureReason ?? "Deadlock" }]);
      return;
    }

    this.view.hideResult();

    if (failureReason !== undefined) {
      this.view.showFeedback(formatFailureReason(failureReason));
    } else {
      this.view.setLevelText(this.levelText);
    }
  }
}

function toPresentationEvents(result: BattleActionResult): readonly BattlePresentationEvent[] {
  if (!result.accepted) {
    return Object.freeze([
      {
        type: "invalidClick",
        message: formatFailureReason(result.rejectReason ?? "Input locked"),
      },
    ]);
  }

  const events: BattlePresentationEvent[] = [
    {
      type: "bucketClicked",
      bucketInstanceId: result.bucketInstanceId,
    },
  ];

  for (const stageEvent of result.events) {
    appendStagePresentationEvent(events, stageEvent);
  }

  return Object.freeze(events);
}

function toUndoPresentationEvents(result: BattleUndoResult): readonly BattlePresentationEvent[] {
  if (!result.accepted) {
    return Object.freeze([
      {
        type: "invalidClick",
        message: formatFailureReason(result.rejectReason ?? "Input locked"),
      },
    ]);
  }

  return Object.freeze([{ type: "undoRestored" }]);
}

function appendStagePresentationEvent(events: BattlePresentationEvent[], stageEvent: BattleStageEvent): void {
  switch (stageEvent.type) {
    case "bucketEnqueued":
      events.push({
        type: "bucketEnteredConveyor",
        bucketInstanceId: stageEvent.bucketInstanceId,
        slotIndex: stageEvent.slotIndex,
      });
      return;
    case "mergeResolved":
      if (stageEvent.result.merged) {
        events.push({
          type: "merge",
          bucketInstanceIds: stageEvent.result.candidate?.bucketInstanceIds ?? [],
          insertedBucketInstanceId: stageEvent.result.mergedBucket?.instanceId ?? null,
          slotIndex: stageEvent.result.insertIndex,
        });
      }
      return;
    case "bucketCompleteResolved":
      if (stageEvent.completedBucketInstanceIds.length > 0) {
        events.push({
          type: "fullBucketLeft",
          bucketInstanceIds: stageEvent.completedBucketInstanceIds,
        });
      }
      return;
    default:
      return;
  }
}

function formatFailureReason(reason: string): string {
  switch (reason) {
    case "battleNotWaitingInput":
      return "Input locked";
    case "battleAlreadyWon":
      return "Already won";
    case "bucketNotFound":
      return "Bucket unavailable";
    case "bucketNotSelectable":
      return "Bucket not selectable";
    case "conveyorFull":
      return "Conveyor full";
    case "settlementError":
      return "Settlement error";
    case "emptyHistory":
      return "Nothing to undo";
    default:
      return reason;
  }
}
