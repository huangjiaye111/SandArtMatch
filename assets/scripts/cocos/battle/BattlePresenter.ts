import { BattlePhase, type BattleViewSnapshot } from "../../domain/battle/BattleState";
import type { BattleStateMachine } from "../../domain/battle/BattleStateMachine";
import type { BattleView } from "./BattleViewContract";

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
      return;
    }

    if (snapshot.phase === BattlePhase.Failed) {
      this.view.showLose(failureReason);
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
