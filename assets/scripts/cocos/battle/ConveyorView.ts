import { _decorator, Component, Label } from "cc";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { ConveyorState } from "../../domain/bucket/Conveyor";

const { ccclass, property } = _decorator;

@ccclass("ConveyorView")
export class ConveyorView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property([Label])
  public slotLabels: Label[] = [];

  public renderConveyor(conveyor: ConveyorState, buckets: readonly BucketState[]): void {
    if (this.titleLabel !== null) {
      this.titleLabel.string = "Conveyor";
    }

    const bucketsById = new Map(buckets.map((bucket) => [bucket.instanceId, bucket]));
    for (let index = 0; index < this.slotLabels.length; index += 1) {
      const label = this.slotLabels[index];
      const bucketId = conveyor.slots[index] ?? null;
      const bucket = bucketId === null ? undefined : bucketsById.get(bucketId);
      label.string = bucket === undefined ? `Slot ${index + 1}` : `C${bucket.colorId} ${bucket.amount}/${bucket.capacity}`;
    }
  }

  public clear(): void {
    if (this.titleLabel !== null) {
      this.titleLabel.string = "Conveyor";
    }
    for (let index = 0; index < this.slotLabels.length; index += 1) {
      this.slotLabels[index].string = `Slot ${index + 1}`;
    }
  }
}
