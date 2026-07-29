import { _decorator, Button, Color, Component, Label, Layout, Node, UITransform } from "cc";
import type { BucketState } from "../../domain/bucket/Bucket";
import { clearBucketVisual, renderBucketVisual } from "./BucketVisualView";
import type { BattlePresentationEvent } from "./BattleViewContract";
import type { BattleUiActions } from "./BattleViewContract";

const { ccclass, property } = _decorator;

const BUCKET_POOL_SCALE = 0.78;
const BUCKET_COLUMNS = 4;
const BUCKET_POSITIONS: ReadonlyArray<Readonly<{ x: number; y: number }>> = Object.freeze([
  Object.freeze({ x: -252, y: 80 }),
  Object.freeze({ x: -84, y: 80 }),
  Object.freeze({ x: 84, y: 80 }),
  Object.freeze({ x: 252, y: 80 }),
  Object.freeze({ x: -252, y: -74 }),
  Object.freeze({ x: -84, y: -74 }),
  Object.freeze({ x: 84, y: -74 }),
  Object.freeze({ x: 252, y: -74 }),
]);
const TEXT_COLOR = new Color(38, 48, 45, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 220);
const SHADOW_COLOR = new Color(38, 48, 45, 80);

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
    this.applyStableLayout();
    this.rebindButtons();
  }

  public clearActions(): void {
    this.actions = null;
    this.inputEnabled = false;
    this.clearButtonHandlers();
    this.refreshButtonStates();
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.refreshButtonStates();
  }

  public renderBucketPool(buckets: readonly BucketState[]): void {
    this.applyStableLayout();
    this.renderedBuckets = buckets;
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }

    for (let index = 0; index < this.bucketLabels.length; index += 1) {
      const bucket = buckets[index];
      this.bucketLabels[index].string = bucket === undefined ? "" : `${bucket.amount}/${bucket.capacity}`;
      this.bucketLabels[index].node.active = bucket !== undefined;
      this.styleBucketLabel(this.bucketLabels[index]);
      renderBucketVisual(this.getBucketVisualRoot(index), bucket, {
        disabled: !this.isBucketButtonEnabled(index, bucket),
        scale: BUCKET_POOL_SCALE,
      });
    }
    this.refreshButtonStates();
  }

  public playFeedback(events: readonly BattlePresentationEvent[]): void {
    for (const event of events) {
      if (event.type === "bucketClicked") {
        this.flashBucket(event.bucketInstanceId, "selected");
      } else if (event.type === "invalidClick") {
        this.flashFirstUnavailableBucket();
      } else if (event.type === "undoRestored") {
        this.flashAvailableBuckets();
      }
    }
  }

  public clear(): void {
    this.applyStableLayout();
    this.renderedBuckets = [];
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }
    for (let index = 0; index < this.bucketLabels.length; index += 1) {
      this.bucketLabels[index].string = "";
      this.bucketLabels[index].node.active = false;
      this.styleBucketLabel(this.bucketLabels[index]);
      clearBucketVisual(this.getBucketVisualRoot(index));
    }
    this.refreshButtonStates();
  }

  protected onDestroy(): void {
    this.clearActions();
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
      this.bucketButtons[index].interactable = this.isBucketButtonEnabled(index, bucket);
      renderBucketVisual(this.getBucketVisualRoot(index), bucket, {
        disabled: !this.bucketButtons[index].interactable,
        scale: BUCKET_POOL_SCALE,
      });
    }
  }

  private getBucketVisualRoot(index: number) {
    return this.bucketButtons[index]?.node.getChildByName("BucketVisualRoot") ?? null;
  }

  private applyStableLayout(): void {
    const grid = this.node.getChildByName("BucketPoolGrid");
    const slotLayer = this.node.getChildByName("BucketPoolSlotArtLayer");
    const layout = grid?.getComponent(Layout) ?? null;
    if (layout !== null) {
      layout.enabled = false;
    }
    setContentSize(grid, 670, 265);
    setContentSize(slotLayer, 670, 265);

    for (let index = 0; index < this.bucketButtons.length; index += 1) {
      const position = BUCKET_POSITIONS[index];
      const buttonNode = this.bucketButtons[index].node;
      if (position !== undefined) {
        buttonNode.setPosition(position.x, position.y, 0);
        buttonNode.setSiblingIndex(index);
        const slot = slotLayer?.children[index] ?? null;
        slot?.setPosition(position.x, position.y, 0);
        slot?.setSiblingIndex(index);
        setContentSize(slot, 132, 118);
      }
      setContentSize(buttonNode, 132, 126);
      const visualRoot = this.getBucketVisualRoot(index);
      visualRoot?.setPosition(0, 14, 0);
      const label = this.bucketLabels[index];
      label.node.setPosition(0, -66, 0);
      setContentSize(label.node, 118, 28);
    }

    if (this.bucketButtons.length >= BUCKET_COLUMNS * 2) {
      for (let index = 0; index < BUCKET_COLUMNS; index += 1) {
        this.bucketButtons[index].node.setSiblingIndex(index);
        this.bucketButtons[index + BUCKET_COLUMNS].node.setSiblingIndex(index + BUCKET_COLUMNS);
      }
    }
  }

  private styleBucketLabel(label: Label): void {
    label.color = TEXT_COLOR;
    label.fontSize = 16;
    label.lineHeight = 20;
    label.enableOutline = true;
    label.outlineColor = TEXT_OUTLINE_COLOR;
    label.outlineWidth = 2;
    label.enableShadow = true;
    label.shadowColor = SHADOW_COLOR;
    label.shadowOffset.set(1, -1);
    label.shadowBlur = 1;
  }

  private isBucketButtonEnabled(_index: number, bucket: BucketState | undefined): boolean {
    return this.inputEnabled && bucket !== undefined && bucket.status === "available";
  }

  private selectBucketAt(index: number): void {
    if (!this.inputEnabled) {
      return;
    }
    const bucket = this.renderedBuckets[index];
    if (bucket === undefined || bucket.status !== "available") {
      this.flashBucketAt(index, "error");
      return;
    }
    this.flashBucketAt(index, "selected");
    this.actions?.selectBucket(bucket.instanceId);
  }

  private flashBucket(bucketInstanceId: string, kind: "selected" | "error"): void {
    const index = this.renderedBuckets.findIndex((bucket) => bucket.instanceId === bucketInstanceId);
    if (index >= 0) {
      this.flashBucketAt(index, kind);
    }
  }

  private flashFirstUnavailableBucket(): void {
    const index = this.renderedBuckets.findIndex((bucket) => bucket.status !== "available");
    this.flashBucketAt(index >= 0 ? index : 0, "error");
  }

  private flashAvailableBuckets(): void {
    for (let index = 0; index < this.renderedBuckets.length; index += 1) {
      if (this.renderedBuckets[index].status === "available") {
        this.flashBucketAt(index, "selected");
      }
    }
  }

  private flashBucketAt(index: number, kind: "selected" | "error"): void {
    const bucket = this.renderedBuckets[index];
    const root = this.getBucketVisualRoot(index);
    if (bucket === undefined || root === null) {
      return;
    }

    const position = BUCKET_POSITIONS[index];
    if (position !== undefined) {
      root.setPosition(0, kind === "selected" ? 22 : 14, 0);
    }
    renderBucketVisual(root, bucket, {
      disabled: !this.isBucketButtonEnabled(index, bucket),
      error: kind === "error",
      selected: kind === "selected",
      scale: kind === "selected" ? BUCKET_POOL_SCALE * 1.06 : BUCKET_POOL_SCALE,
    });
    this.scheduleOnce(() => {
      root.setPosition(0, 14, 0);
      renderBucketVisual(root, bucket, {
        disabled: !this.isBucketButtonEnabled(index, bucket),
        scale: BUCKET_POOL_SCALE,
      });
    }, kind === "error" ? 0.18 : 0.22);
  }
}

function setContentSize(node: Node | null | undefined, width: number, height: number): void {
  node?.getComponent(UITransform)?.setContentSize(width, height);
}
