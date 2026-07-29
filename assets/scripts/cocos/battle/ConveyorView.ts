import { _decorator, Color, Component, Label, Layout, Node, UITransform } from "cc";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { ConveyorState } from "../../domain/bucket/Conveyor";
import type { BattlePresentationEvent } from "./BattleViewContract";
import { clearBucketVisual, renderBucketVisual } from "./BucketVisualView";

const { ccclass, property } = _decorator;

const CONVEYOR_BUCKET_SCALE = 0.64;
const SLOT_POSITIONS = Object.freeze([-275, -165, -55, 55, 165, 275]);
const TEXT_COLOR = new Color(38, 48, 45, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 220);
const SHADOW_COLOR = new Color(38, 48, 45, 80);

@ccclass("ConveyorView")
export class ConveyorView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property([Label])
  public slotLabels: Label[] = [];

  public renderConveyor(conveyor: ConveyorState, buckets: readonly BucketState[]): void {
    this.applyStableLayout();
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }

    const bucketsById = new Map(buckets.map((bucket) => [bucket.instanceId, bucket]));
    const mergeReadyIds = collectMergeReadyBucketIds(conveyor, bucketsById);
    for (let index = 0; index < this.slotLabels.length; index += 1) {
      const label = this.slotLabels[index];
      const bucketId = conveyor.slots[index] ?? null;
      const bucket = bucketId === null ? undefined : bucketsById.get(bucketId);
      label.string = bucket === undefined ? "" : `${bucket.amount}/${bucket.capacity}`;
      label.node.active = bucket !== undefined;
      this.styleLabel(label, 15, 18);
      renderBucketVisual(this.getBucketVisualRoot(index), bucket, {
        mergeReady: bucket !== undefined && mergeReadyIds.has(bucket.instanceId),
        scale: CONVEYOR_BUCKET_SCALE,
      });
    }
  }

  public playFeedback(events: readonly BattlePresentationEvent[]): void {
    for (const event of events) {
      if (event.type === "bucketEnteredConveyor" && event.slotIndex >= 0) {
        this.flashSlot(event.slotIndex, "enter");
      } else if (event.type === "merge" && event.slotIndex !== null) {
        this.flashSlot(event.slotIndex, "merge");
      } else if (event.type === "fullBucketLeft") {
        for (const bucketId of event.bucketInstanceIds) {
          this.flashBucketId(bucketId);
        }
      } else if (event.type === "undoRestored") {
        this.flashAllSlots();
      }
    }
  }

  public clear(): void {
    this.applyStableLayout();
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }
    for (let index = 0; index < this.slotLabels.length; index += 1) {
      this.slotLabels[index].string = "";
      this.slotLabels[index].node.active = false;
      clearBucketVisual(this.getBucketVisualRoot(index));
    }
  }

  private flashSlot(index: number, kind: "enter" | "merge"): void {
    const slot = this.node.getChildByName("ConveyorSlotArtLayer")?.children[index] ?? null;
    const visual = this.getBucketVisualRoot(index);
    const scale = kind === "merge" ? 1.12 : 1.06;
    slot?.setScale(scale, scale, 1);
    visual?.setScale(CONVEYOR_BUCKET_SCALE * scale, CONVEYOR_BUCKET_SCALE * scale, 1);
    this.scheduleOnce(() => {
      slot?.setScale(1, 1, 1);
      visual?.setScale(CONVEYOR_BUCKET_SCALE, CONVEYOR_BUCKET_SCALE, 1);
    }, kind === "merge" ? 0.32 : 0.16);
  }

  private flashBucketId(bucketInstanceId: string): void {
    for (let index = 0; index < this.slotLabels.length; index += 1) {
      const root = this.getBucketVisualRoot(index);
      if (root?.active === true && root.name.includes(bucketInstanceId)) {
        this.flashSlot(index, "enter");
      }
    }
  }

  private flashAllSlots(): void {
    for (let index = 0; index < this.slotLabels.length; index += 1) {
      this.flashSlot(index, "enter");
    }
  }

  private getBucketVisualRoot(index: number) {
    const layer = this.node.getChildByName("ConveyorBucketVisualLayer");
    const layerChild = layer?.children[index] ?? null;
    return layerChild?.getChildByName("BucketVisualRoot") ?? layerChild ?? this.slotLabels[index]?.node.getChildByName("BucketVisualRoot") ?? null;
  }

  private applyStableLayout(): void {
    const slotArtLayer = this.node.getChildByName("ConveyorSlotArtLayer");
    const visualLayer = this.node.getChildByName("ConveyorBucketVisualLayer");
    const slots = this.node.getChildByName("ConveyorSlots");
    const layout = slots?.getComponent(Layout) ?? null;
    if (layout !== null) {
      layout.enabled = false;
    }

    for (let index = 0; index < SLOT_POSITIONS.length; index += 1) {
      const x = SLOT_POSITIONS[index];
      slotArtLayer?.children[index]?.setPosition(x, 0, 0);
      visualLayer?.children[index]?.setPosition(x, 2, 0);
      this.slotLabels[index]?.node.setPosition(x, -48, 0);
      setContentSize(slotArtLayer?.children[index], 96, 72);
      setContentSize(this.slotLabels[index]?.node, 72, 22);
    }
  }

  private styleLabel(label: Label, fontSize: number, lineHeight: number): void {
    label.color = TEXT_COLOR;
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.enableOutline = true;
    label.outlineColor = TEXT_OUTLINE_COLOR;
    label.outlineWidth = 2;
    label.enableShadow = true;
    label.shadowColor = SHADOW_COLOR;
    label.shadowOffset.set(1, -1);
    label.shadowBlur = 1;
  }
}

function collectMergeReadyBucketIds(
  conveyor: ConveyorState,
  bucketsById: ReadonlyMap<string, BucketState>,
): ReadonlySet<string> {
  const idsByColor = new Map<number, string[]>();
  for (const bucketId of conveyor.slots) {
    if (bucketId === null) {
      continue;
    }
    const bucket = bucketsById.get(bucketId);
    if (bucket === undefined) {
      continue;
    }
    const ids = idsByColor.get(bucket.colorId) ?? [];
    ids.push(bucket.instanceId);
    idsByColor.set(bucket.colorId, ids);
  }

  const ready = new Set<string>();
  for (const ids of idsByColor.values()) {
    if (ids.length >= 3) {
      for (const id of ids.slice(0, 3)) {
        ready.add(id);
      }
    }
  }
  return ready;
}

function setContentSize(node: Node | null | undefined, width: number, height: number): void {
  node?.getComponent(UITransform)?.setContentSize(width, height);
}
