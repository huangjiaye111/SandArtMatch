import { _decorator, Component } from "cc";
import { BattlePhase } from "../../domain/battle/BattleState";
import { createBattleStateMachineForBuiltInTestLevel } from "../../domain/config/TestLevels";
import type { BattleStateMachine } from "../../domain/battle/BattleStateMachine";
import type { BattleViewSnapshot } from "../../domain/battle/BattleState";
import { BattlePresenter } from "./BattlePresenter";
import type { BattleView } from "./BattleViewContract";
import { BucketPoolView } from "./BucketPoolView";
import { ConveyorView } from "./ConveyorView";
import { SandGridView } from "./SandGridView";
import { ToolbarView } from "./ToolbarView";

const { ccclass, property } = _decorator;

@ccclass("BattleRoot")
export class BattleRoot extends Component implements BattleView {
  @property(SandGridView)
  public sandGridView: SandGridView | null = null;

  @property(ConveyorView)
  public conveyorView: ConveyorView | null = null;

  @property(BucketPoolView)
  public bucketPoolView: BucketPoolView | null = null;

  @property(ToolbarView)
  public toolbarView: ToolbarView | null = null;

  @property
  public levelId = 1;

  @property
  public levelText = "Level 1";

  private machine: BattleStateMachine | null = null;
  private presenter: BattlePresenter | null = null;

  public onLoad(): void {
    this.machine = createBattleStateMachineForBuiltInTestLevel(this.levelId);
    this.presenter = new BattlePresenter(this.machine, this, this.levelText);
    this.bindChildActions();
    this.presenter.initialize();
  }

  protected onDestroy(): void {
    this.presenter?.clear();
    this.bucketPoolView?.clearActions();
    this.toolbarView?.clearActions();
    this.presenter = null;
    this.machine = null;
  }

  public initialize(snapshot: BattleViewSnapshot): void {
    this.clear();
    this.renderSandGrid(snapshot.grid);
    this.renderConveyor(snapshot.conveyor, snapshot.buckets);
    this.renderBucketPool(snapshot.buckets);
    this.setUndoEnabled(snapshot.canUndo);
    this.setInputEnabled(snapshot.phase === BattlePhase.WaitingInput);
  }

  public setLevelText(text: string): void {
    this.toolbarView?.setLevelText(text);
  }

  public setInputEnabled(enabled: boolean): void {
    this.bucketPoolView?.setInputEnabled(enabled);
    this.setUndoEnabled(enabled && (this.machine?.canUndo() ?? false));
  }

  public setUndoEnabled(enabled: boolean): void {
    this.toolbarView?.setUndoEnabled(enabled);
  }

  public renderSandGrid(grid: BattleViewSnapshot["grid"]): void {
    this.sandGridView?.renderSandGrid(grid);
  }

  public renderConveyor(conveyor: BattleViewSnapshot["conveyor"], buckets: BattleViewSnapshot["buckets"]): void {
    this.conveyorView?.renderConveyor(conveyor, buckets);
  }

  public renderBucketPool(buckets: BattleViewSnapshot["buckets"]): void {
    this.bucketPoolView?.renderBucketPool(buckets);
  }

  public showFeedback(message: string): void {
    this.toolbarView?.showFeedback(message);
  }

  public showWin(): void {
    this.toolbarView?.showWin();
  }

  public showLose(reason?: string): void {
    this.toolbarView?.showLose(reason);
  }

  public hideResult(): void {
    this.toolbarView?.hideResult();
  }

  public clear(): void {
    this.sandGridView?.clear();
    this.conveyorView?.clear();
    this.bucketPoolView?.clear();
    this.toolbarView?.clear();
  }

  public onBucketTapped(bucketInstanceId: string): void {
    this.presenter?.selectBucket(bucketInstanceId);
  }

  public onUndoTapped(): void {
    this.presenter?.undo();
  }

  private bindChildActions(): void {
    const actions = {
      selectBucket: (bucketInstanceId: string) => this.onBucketTapped(bucketInstanceId),
      undo: () => this.onUndoTapped(),
    };
    this.bucketPoolView?.setActions(actions);
    this.toolbarView?.setActions(actions);
  }
}
