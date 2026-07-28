import { BattlePhase, type BattleViewSnapshot } from "../../domain/battle/BattleState";
import type { BattleStateMachine } from "../../domain/battle/BattleStateMachine";
import type { BattleView } from "./BattleViewContract";

export class BattlePresenter {
  private inputEnabled = true;
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
    if (!this.inputEnabled || !this.machine.canAcceptInput()) {
      return;
    }

    const result = this.machine.selectBucket(bucketInstanceId);
    this.sync(result.snapshot, result.rejectReason);
  }

  public undo(): void {
    if (!this.inputEnabled || !this.machine.canUndo()) {
      return;
    }

    const result = this.machine.undo();
    this.sync(result.snapshot, result.rejectReason);
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
  }
}
