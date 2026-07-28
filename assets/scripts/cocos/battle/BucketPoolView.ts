import { _decorator, Button, Component, Label } from "cc";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { BattleUiActions } from "./BattleViewContract";

const { ccclass, property } = _decorator;

@ccclass("BucketPoolView")
export class BucketPoolView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property([Label])
  public bucketLabels: Label[] = [];

  @property([Button])
  public bucketButtons: Button[] = [];

  private actions: BattleUiActions | null = null;
  private inputEnabled = true;
  private renderedBuckets: readonly BucketState[] = [];
  private readonly buttonHandlers: Array<() => void> = [];

  public setActions(actions: BattleUiActions): void {
    this.actions = actions;
    this.rebindButtons();
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.refreshButtonStates();
  }

  public renderBucketPool(buckets: readonly BucketState[]): void {
    this.renderedBuckets = buckets;
    if (this.titleLabel !== null) {
      this.titleLabel.string = "Bucket Pool";
    }

    for (let index = 0; index < this.bucketLabels.length; index += 1) {
      const bucket = buckets[index];
      this.bucketLabels[index].string =
        bucket === undefined ? `Bucket ${index + 1}` : `C${bucket.colorId} ${bucket.amount}/${bucket.capacity}`;
    }
    this.refreshButtonStates();
  }

  public clear(): void {
    this.renderedBuckets = [];
    if (this.titleLabel !== null) {
      this.titleLabel.string = "Bucket Pool";
    }
    for (let index = 0; index < this.bucketLabels.length; index += 1) {
      this.bucketLabels[index].string = `Bucket ${index + 1}`;
    }
    this.refreshButtonStates();
  }

  protected onDestroy(): void {
    this.clearButtonHandlers();
  }

  private rebindButtons(): void {
    this.clearButtonHandlers();
    for (let index = 0; index < this.bucketButtons.length; index += 1) {
      const button = this.bucketButtons[index];
      const handler = () => this.selectBucketAt(index);
      button.node.on(Button.EventType.CLICK, handler, this);
      this.buttonHandlers.push(handler);
    }
    this.refreshButtonStates();
  }

  private clearButtonHandlers(): void {
    for (let index = 0; index < this.buttonHandlers.length; index += 1) {
      const button = this.bucketButtons[index];
      if (button !== undefined) {
        button.node.off(Button.EventType.CLICK, this.buttonHandlers[index], this);
      }
    }
    this.buttonHandlers.length = 0;
  }

  private refreshButtonStates(): void {
    for (let index = 0; index < this.bucketButtons.length; index += 1) {
      const bucket = this.renderedBuckets[index];
      this.bucketButtons[index].interactable = this.inputEnabled && bucket !== undefined && bucket.status === "available";
    }
  }

  private selectBucketAt(index: number): void {
    if (!this.inputEnabled) {
      return;
    }
    const bucket = this.renderedBuckets[index];
    if (bucket === undefined || bucket.status !== "available") {
      return;
    }
    this.actions?.selectBucket(bucket.instanceId);
  }
}
