import { _decorator, Button, Color, Component, Graphics, Label, Layout, Mask, Node, Sprite, tween, Tween, UIOpacity, UITransform, Vec3 } from "cc";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { ConveyorState } from "../../domain/bucket/Conveyor";
import type { BattlePresentationEvent } from "./BattleViewContract";
import type { BucketExitPresentationTask, BucketMergePresentationTask } from "./BucketPresentationTaskModel";
import { createBucketVisualModel } from "./BucketVisualModel";
import { clearBucketVisual, renderBucketVisual } from "./BucketVisualView";
import {
  createConveyorCarrierLayout,
  sampleConveyorLoopPosition,
  selectVisibleEmptyCarrierIndex,
} from "./ConveyorCarrierMotionModel";
import { createConveyorLayoutModel } from "./ConveyorLayoutModel";
import { BATTLE_PRESENTATION_CONFIG } from "./BattlePresentationConfig";

const { ccclass, property } = _decorator;

const CONVEYOR_BUCKET_SCALE = 0.64;
const TEXT_COLOR = new Color(38, 48, 45, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 220);
const SHADOW_COLOR = new Color(38, 48, 45, 80);
const SLOT_MARKER_FILL_COLOR = new Color(238, 242, 239, 56);
const SLOT_MARKER_STROKE_COLOR = new Color(88, 105, 111, 116);
const CARRIER_FILL_COLOR = new Color(238, 242, 239, 245);
const CARRIER_STROKE_COLOR = new Color(88, 105, 111, 190);
const LAYOUT = createConveyorLayoutModel();
const CARRIER_LAYOUT = createConveyorCarrierLayout({ slotPositions: LAYOUT.slots });

interface ActiveBucketPresentationTask {
  readonly bucketId: string;
  readonly revision: number;
  readonly node: Node;
  readonly progress: { value: number };
}

interface ActiveCarrierEntry {
  readonly bucketInstanceId: string;
  readonly carrierIndex: number;
  readonly node: Node;
  readonly progress: { value: number };
}

@ccclass("ConveyorView")
export class ConveyorView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property([Label])
  public slotLabels: Label[] = [];

  private renderedSlots: readonly (string | null)[] = [];
  private latestBucketsById: ReadonlyMap<string, BucketState> = new Map();
  private readonly enteringCarriers = new Map<string, ActiveCarrierEntry>();
  private readonly activeCarriersByBucketId = new Map<string, Node>();
  private readonly reservedCarrierIndexesByBucketId = new Map<string, number>();
  private readonly carrierPool: Node[] = [];
  private readonly activeBucketTasks = new Map<string, ActiveBucketPresentationTask>();
  private readonly transitionNodePool: Node[] = [];
  private readonly loopCarrierNodes: Node[] = [];
  private conveyorPhase = 0;
  private carrierToolTargetEnabled = false;
  private carrierToolTargetHandler: ((bucketInstanceId: string) => void) | null = null;

  public renderConveyor(conveyor: ConveyorState, buckets: readonly BucketState[]): void {
    this.applyStableLayout();
    this.renderedSlots = conveyor.slots;
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }

    const bucketsById = new Map(buckets.map((bucket) => [bucket.instanceId, bucket]));
    this.latestBucketsById = bucketsById;
    const liveBucketIds = new Set(conveyor.slots.filter((bucketId): bucketId is string => bucketId !== null));
    this.recycleInactiveActiveCarriers(liveBucketIds);
    const mergeReadyIds = collectMergeReadyBucketIds(conveyor, bucketsById);

    for (let index = 0; index < LAYOUT.slots.length; index += 1) {
      this.slotLabels[index]?.node && (this.slotLabels[index].node.active = false);
      const bucketId = conveyor.slots[index] ?? null;
      if (bucketId === null) {
        continue;
      }
      const bucket = bucketsById.get(bucketId);
      if (bucket === undefined) {
        continue;
      }
      const entering = this.enteringCarriers.get(bucketId);
      if (entering !== undefined) {
        continue;
      }
      const carrier = this.ensureActiveCarrier(bucket, index);
      this.renderCarrierVisual(carrier, bucket, mergeReadyIds.has(bucket.instanceId));
      this.refreshCarrierInteractable(carrier);
    }
  }

  public setCarrierToolTargetEnabled(enabled: boolean): void {
    this.carrierToolTargetEnabled = enabled;
    for (const carrier of this.activeCarriersByBucketId.values()) {
      this.refreshCarrierInteractable(carrier);
    }
  }

  public setCarrierToolTargetHandler(handler: ((bucketInstanceId: string) => void) | null): void {
    this.carrierToolTargetHandler = handler;
  }

  protected update(deltaTime: number): void {
    this.conveyorPhase += deltaTime * BATTLE_PRESENTATION_CONFIG.carrierCellsPerSecond * CARRIER_LAYOUT.spacing;
    for (let index = 0; index < this.loopCarrierNodes.length; index += 1) {
      const carrier = this.loopCarrierNodes[index];
      const position = sampleConveyorLoopPosition(CARRIER_LAYOUT, index, this.conveyorPhase);
      carrier.setPosition(position.x, position.y, 0);
    }
  }

  public playFeedback(events: readonly BattlePresentationEvent[]): void {
    for (const event of events) {
      if (event.type === "merge") {
        this.playMergePlaceholder(event);
      } else if (event.type === "fullBucketLeft") {
        this.playFullBucketExitPlaceholder(event.slotIndexes);
      }
    }
  }

  public playBucketTransitionTasks(
    mergeTasks: readonly BucketMergePresentationTask[],
    exitTasks: readonly BucketExitPresentationTask[],
  ): void {
    let started = 0;
    for (const task of mergeTasks) {
      if (started >= BATTLE_PRESENTATION_CONFIG.maxConcurrentBucketPresentationTasks) {
        return;
      }
      started += this.playMergeTask(task);
    }
    for (const task of exitTasks) {
      if (started >= BATTLE_PRESENTATION_CONFIG.maxConcurrentBucketPresentationTasks) {
        return;
      }
      if (this.playExitTask(task)) {
        started += 1;
      }
    }
  }

  public playMergeResultBounces(tasks: readonly BucketMergePresentationTask[]): void {
    for (const task of tasks) {
      if (task.resultSlotIndex === null) {
        continue;
      }
      const root = this.getBucketVisualRoot(task.resultSlotIndex);
      if (root === null) {
        continue;
      }
      Tween.stopAllByTarget(root);
      root.setScale(CONVEYOR_BUCKET_SCALE * 0.92, CONVEYOR_BUCKET_SCALE * 0.92, 1);
      tween(root)
        .to(BATTLE_PRESENTATION_CONFIG.mergeResultBounceDuration, {
          scale: new Vec3(CONVEYOR_BUCKET_SCALE * 1.06, CONVEYOR_BUCKET_SCALE * 1.06, 1),
        })
        .to(BATTLE_PRESENTATION_CONFIG.mergeResultBounceDuration * 0.55, {
          scale: new Vec3(CONVEYOR_BUCKET_SCALE, CONVEYOR_BUCKET_SCALE, 1),
        })
        .start();
    }
  }

  public getBucketMouthWorldPosition(bucketInstanceId: string): Vec3 | null {
    const entering = this.enteringCarriers.get(bucketInstanceId);
    if (entering !== undefined) {
      const root = entering.node.getChildByName("BucketVisualRoot") ?? null;
      const rim = root?.getChildByName("TargetColorRim") ?? root;
      return rim === null ? null : rim.worldPosition.clone();
    }
    const carrier = this.getCarrierByBucketId(bucketInstanceId);
    const root = carrier?.getChildByName("BucketAnchor")?.getChildByName("BucketVisualRoot") ?? null;
    const rim = root?.getChildByName("TargetColorRim") ?? root;
    return rim === null ? null : rim.worldPosition.clone();
  }

  public setBucketPresentationAmount(bucketInstanceId: string, amount: number): void {
    const bucket = this.latestBucketsById.get(bucketInstanceId);
    const carrier = this.getCarrierByBucketId(bucketInstanceId);
    if (bucket === undefined || carrier === null) {
      return;
    }
    const presentationBucket: BucketState = Object.freeze({
      ...bucket,
      amount: Math.max(0, Math.min(bucket.capacity, Math.round(amount))),
    });
    this.renderCarrierVisual(carrier, presentationBucket, false);
  }

  public playAbsorbPulse(bucketInstanceId: string): void {
    const root = this.getCarrierByBucketId(bucketInstanceId)?.getChildByName("BucketAnchor")?.getChildByName("BucketVisualRoot") ?? null;
    if (root === null) {
      return;
    }
    Tween.stopAllByTarget(root);
    tween(root)
      .to(0.08, { scale: new Vec3(CONVEYOR_BUCKET_SCALE * 1.07, CONVEYOR_BUCKET_SCALE * 1.07, 1) })
      .to(0.1, { scale: new Vec3(CONVEYOR_BUCKET_SCALE, CONVEYOR_BUCKET_SCALE, 1) })
      .start();
  }

  public clearPresentationOverrides(): void {
    for (let index = 0; index < this.renderedSlots.length; index += 1) {
      const bucketId = this.renderedSlots[index] ?? null;
      const bucket = bucketId === null ? undefined : this.latestBucketsById.get(bucketId);
      const carrier = bucketId === null ? null : this.getCarrierByBucketId(bucketId);
      if (bucket !== undefined && carrier !== null) {
        this.renderCarrierVisual(carrier, bucket, false);
      }
    }
  }

  public playBucketEntry(
    bucket: BucketState,
    slotIndex: number,
    startWorldPosition: Vec3,
    onComplete?: () => void,
  ): boolean {
    this.applyStableLayout();
    if (this.getCarrierByBucketId(bucket.instanceId) !== null) {
      return false;
    }
    const carrierIndex = this.selectCarrierIndexForBucket(bucket.instanceId, slotIndex);
    this.reservedCarrierIndexesByBucketId.set(bucket.instanceId, carrierIndex);
    const carrier = this.ensureLoopCarrier(carrierIndex);
    const entry = this.startCarrierTransfer(bucket, carrier, startWorldPosition, onComplete);
    if (entry === null) {
      return false;
    }
    return true;
  }

  public cancelFeedback(): void {
    this.unscheduleAllCallbacks();
    this.cancelEnteringCarriers("cancelFeedback");
    this.cancelBucketPresentationTasks();
    for (const carrier of this.activeCarriersByBucketId.values()) {
      Tween.stopAllByTarget(carrier);
      carrier.setScale(1, 1, 1);
    }
    this.reservedCarrierIndexesByBucketId.clear();
  }

  protected onDisable(): void {
    this.cancelFeedback();
    this.recycleAllCarriers();
  }

  protected onDestroy(): void {
    this.cancelFeedback();
    this.recycleAllCarriers();
  }

  public clear(): void {
    this.cancelFeedback();
    this.applyStableLayout();
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }
    this.renderedSlots = [];
    for (let index = 0; index < this.slotLabels.length; index += 1) {
      this.slotLabels[index].string = "";
      this.slotLabels[index].node.active = false;
    }
    this.recycleAllCarriers();
    this.reservedCarrierIndexesByBucketId.clear();
  }

  private flashSlot(index: number, kind: "enter" | "merge"): void {
    const visual = this.getBucketVisualRoot(index);
    const scale = kind === "merge" ? 1.12 : 1.06;
    visual?.setScale(CONVEYOR_BUCKET_SCALE * scale, CONVEYOR_BUCKET_SCALE * scale, 1);
    this.scheduleOnce(() => {
      visual?.setScale(CONVEYOR_BUCKET_SCALE, CONVEYOR_BUCKET_SCALE, 1);
    }, kind === "merge" ? 0.32 : 0.16);
  }

  private flashBucketId(bucketInstanceId: string, kind: "enter" | "merge" | "absorb" = "enter"): void {
    for (let index = 0; index < this.renderedSlots.length; index += 1) {
      if (this.renderedSlots[index] === bucketInstanceId) {
        this.flashSlot(index, kind === "merge" ? "merge" : "enter");
      }
    }
  }

  private playMergePlaceholder(event: Extract<BattlePresentationEvent, { readonly type: "merge" }>): void {
    for (const bucketId of event.bucketInstanceIds) {
      this.flashBucketId(bucketId, "merge");
    }
    if (event.slotIndex !== null) {
      this.flashSlot(event.slotIndex, "merge");
    }
  }

  private playMergeTask(task: BucketMergePresentationTask): number {
    const targetPosition = task.resultSlotIndex === null ? null : this.getSlotLocalPosition(task.resultSlotIndex);
    if (targetPosition === null) {
      return 0;
    }
    let started = 0;
    for (const bucketId of task.participantBucketIds) {
      const bucket = this.latestBucketsById.get(bucketId);
      const slotIndex = this.renderedSlots.indexOf(bucketId);
      const sourcePosition = slotIndex >= 0 ? this.getSlotLocalPosition(slotIndex) : null;
      if (bucket === undefined || sourcePosition === null || this.activeBucketTasks.has(bucketId)) {
        continue;
      }
      const node = this.acquireTransitionNode(bucket);
      const progress = { value: 0 };
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
      opacity.opacity = 245;
      node.active = true;
      node.setPosition(sourcePosition);
      node.setScale(CONVEYOR_BUCKET_SCALE, CONVEYOR_BUCKET_SCALE, 1);
      this.activeBucketTasks.set(bucketId, Object.freeze({ bucketId, revision: task.revision, node, progress }));
      const target = new Vec3(
        sourcePosition.x + (targetPosition.x - sourcePosition.x) * 0.42,
        sourcePosition.y + (targetPosition.y - sourcePosition.y) * 0.42 + 10,
        0,
      );
      tween(progress)
        .to(BATTLE_PRESENTATION_CONFIG.mergePulseDuration, { value: 1 }, {
          onUpdate: () => {
            if (!node.active) return;
            const scale = CONVEYOR_BUCKET_SCALE * (1 + 0.1 * progress.value);
            node.setScale(scale, scale, 1);
          },
        })
        .to(BATTLE_PRESENTATION_CONFIG.mergeMoveDuration, { value: 2 }, {
          onUpdate: () => {
            if (!node.active) return;
            const p = progress.value - 1;
            node.setPosition(lerp(sourcePosition.x, target.x, p), lerp(sourcePosition.y, target.y, p), 0);
            const scale = CONVEYOR_BUCKET_SCALE * (1.1 - 0.32 * p);
            node.setScale(scale, scale, 1);
            opacity.opacity = Math.max(0, Math.round(245 * (1 - p)));
          },
        })
        .call(() => this.recycleTransitionNode(bucketId))
        .start();
      started += 1;
    }
    return started;
  }

  private playFullBucketExitPlaceholder(slotIndexes: readonly number[]): void {
    for (const slotIndex of slotIndexes) {
      const root = this.getBucketVisualRoot(slotIndex);
      if (root === null) {
        continue;
      }
      Tween.stopAllByTarget(root);
      tween(root)
        .to(BATTLE_PRESENTATION_CONFIG.fullBucketExitDurationSeconds, {
          scale: new Vec3(CONVEYOR_BUCKET_SCALE * 0.72, CONVEYOR_BUCKET_SCALE * 0.72, 1),
          position: new Vec3(root.position.x + 40, root.position.y + 20, 0),
        })
        .call(() => {
          const bucketId = this.renderedSlots[slotIndex] ?? null;
          const carrier = bucketId === null ? null : this.getCarrierByBucketId(bucketId);
          if (carrier !== null) {
            carrier.setPosition(LAYOUT.slots[slotIndex].x, LAYOUT.slots[slotIndex].y, 0);
          }
        })
        .start();
    }
  }

  private playExitTask(task: BucketExitPresentationTask): boolean {
    const bucket = this.latestBucketsById.get(task.bucketId);
    const sourcePosition = this.getSlotLocalPosition(task.slotIndex);
    if (bucket === undefined || sourcePosition === null || this.activeBucketTasks.has(task.bucketId)) {
      return false;
    }
    const node = this.acquireTransitionNode(bucket);
    const progress = { value: 0 };
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    opacity.opacity = 255;
    node.active = true;
    node.setPosition(sourcePosition);
    node.setScale(CONVEYOR_BUCKET_SCALE, CONVEYOR_BUCKET_SCALE, 1);
    this.activeBucketTasks.set(task.bucketId, Object.freeze({ bucketId: task.bucketId, revision: task.revision, node, progress }));
    const exitOffset = BATTLE_PRESENTATION_CONFIG.bucketExitOffset;
    const exitPosition = new Vec3(sourcePosition.x + exitOffset.x, sourcePosition.y + exitOffset.y, 0);
    tween(progress)
      .to(BATTLE_PRESENTATION_CONFIG.bucketCompleteHoldDuration, { value: 1 }, {
        onUpdate: () => {
          if (!node.active) return;
          const scale = CONVEYOR_BUCKET_SCALE * (1 + 0.12 * progress.value);
          node.setScale(scale, scale, 1);
        },
      })
      .to(BATTLE_PRESENTATION_CONFIG.bucketExitDuration, { value: 2 }, {
        onUpdate: () => {
          if (!node.active) return;
          const p = progress.value - 1;
          node.setPosition(lerp(sourcePosition.x, exitPosition.x, p), lerp(sourcePosition.y, exitPosition.y, p), 0);
          const scale = CONVEYOR_BUCKET_SCALE * (1.12 - 0.42 * p);
          node.setScale(scale, scale, 1);
          opacity.opacity = Math.max(0, Math.round(255 * (1 - p)));
        },
      })
      .call(() => this.recycleTransitionNode(task.bucketId))
      .start();
    return true;
  }

  private getBucketVisualRoot(index: number): Node | null {
    const bucketId = this.renderedSlots[index] ?? null;
    const carrier = bucketId === null ? null : this.getCarrierByBucketId(bucketId);
    return carrier?.getChildByName("BucketAnchor")?.getChildByName("BucketVisualRoot") ?? null;
  }

  private getCarrierByBucketId(bucketInstanceId: string): Node | null {
    return this.enteringCarriers.get(bucketInstanceId)?.node ?? this.activeCarriersByBucketId.get(bucketInstanceId) ?? null;
  }

  private getSlotLocalPosition(index: number): Vec3 | null {
    const slot = LAYOUT.slots[index];
    if (slot === undefined) {
      return null;
    }
    return new Vec3(slot.x, slot.y, 0);
  }

  private applyStableLayout(): void {
    const slotArtLayer = this.node.getChildByName("ConveyorSlotArtLayer");
    const visualLayer = this.node.getChildByName("ConveyorBucketVisualLayer");
    const slots = this.node.getChildByName("ConveyorSlots");
    const base = this.node.getChildByName("ConveyorBaseArt");
    const layout = slots?.getComponent(Layout) ?? null;
    if (layout !== null) {
      layout.enabled = false;
    }
    setContentSize(this.node, LAYOUT.width, LAYOUT.height);
    setContentSize(base, LAYOUT.width, 118);
    setContentSize(slotArtLayer, LAYOUT.width, LAYOUT.height);
    setContentSize(visualLayer, LAYOUT.width, LAYOUT.height);
    setContentSize(slots, LAYOUT.width, LAYOUT.height);
    slotArtLayer?.setPosition(0, -28, 0);
    visualLayer?.setPosition(0, -28, 0);
    slots?.setPosition(0, -28, 0);
    if (slotArtLayer !== null) slotArtLayer.active = false;
    if (visualLayer !== null) visualLayer.active = false;
    if (slots !== null) slots.active = false;
    this.hideLegacyLabels(this.node);
    this.ensureCarrierHierarchy();
    this.ensureCarrierTransferRoot();
  }

  private hideLegacyLabels(root: Node): void {
    const label = root.getComponent(Label);
    if (label !== null) {
      label.string = "";
      label.node.active = false;
    }
    for (const child of root.children) {
      this.hideLegacyLabels(child);
    }
  }

  private ensureCarrierHierarchy(): Node {
    let viewport = this.node.getChildByName("TrackViewport");
    if (viewport === null) {
      viewport = new Node("TrackViewport");
      this.node.addChild(viewport);
    }
    viewport.active = true;
    viewport.setPosition(0, -28, 0);
    viewport.setSiblingIndex(8);
    (viewport.getComponent(UITransform) ?? viewport.addComponent(UITransform)).setContentSize(LAYOUT.width, LAYOUT.height);
    const mask = viewport.getComponent(Mask) ?? viewport.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    const legacyCarrierRoot = viewport.getChildByName("CarrierRoot");
    if (legacyCarrierRoot !== null) {
      legacyCarrierRoot.active = false;
    }

    let loopRoot = viewport.getChildByName("CarrierLoopRoot");
    if (loopRoot === null) {
      loopRoot = new Node("CarrierLoopRoot");
      viewport.addChild(loopRoot);
    }
    loopRoot.active = true;
    loopRoot.setPosition(0, 0, 0);
    loopRoot.setSiblingIndex(2);
    (loopRoot.getComponent(UITransform) ?? loopRoot.addComponent(UITransform)).setContentSize(LAYOUT.width + CARRIER_LAYOUT.spacing * 2, LAYOUT.height);
    for (let index = 0; index < LAYOUT.slots.length; index += 1) {
      this.ensureLoopCarrier(index, loopRoot);
    }
    return loopRoot;
  }

  private ensureCarrierTransferRoot(): Node {
    let root = this.node.getChildByName("CarrierTransferRoot");
    if (root === null) {
      root = new Node("CarrierTransferRoot");
      this.node.addChild(root);
    }
    root.active = true;
    root.setPosition(0, -28, 0);
    root.setSiblingIndex(18);
    (root.getComponent(UITransform) ?? root.addComponent(UITransform)).setContentSize(LAYOUT.width, LAYOUT.height + 180);
    return root;
  }

  private ensureLoopCarrier(index: number, loopRoot?: Node): Node {
    const root = loopRoot ?? this.node.getChildByPath("TrackViewport/CarrierLoopRoot");
    if (root === null) {
      throw new Error("Carrier loop root is missing.");
    }
    let carrier = root.getChildByName(`Carrier${index}`);
    if (carrier === null) {
      carrier = new Node(`Carrier${index}`);
      root.addChild(carrier);
      carrier.addComponent(UITransform).setContentSize(LAYOUT.slotWidth, LAYOUT.slotHeight + 58);
      carrier.addComponent(UIOpacity);
      carrier.addComponent(Button);
      carrier.on(Button.EventType.CLICK, () => this.handleCarrierTapped(carrier as Node), this);
    }
    carrier.active = true;
    this.ensureCarrierVisualChildren(carrier);
    this.refreshCarrierInteractable(carrier);
    this.loopCarrierNodes[index] = carrier;
    return carrier;
  }

  private selectCarrierIndexForBucket(bucketInstanceId: string, slotIndex = 0): number {
    const occupied = new Set<number>();
    for (const carrier of this.activeCarriersByBucketId.values()) {
      const index = this.loopCarrierNodes.indexOf(carrier);
      if (index >= 0) {
        occupied.add(index);
      }
    }
    for (const index of this.reservedCarrierIndexesByBucketId.values()) {
      occupied.add(index);
    }
    for (const entry of this.enteringCarriers.values()) {
      occupied.add(entry.carrierIndex);
    }
    const seed = this.hashString(`${bucketInstanceId}:${slotIndex}:${this.conveyorPhase.toFixed(3)}`);
    return selectVisibleEmptyCarrierIndex({
      layout: CARRIER_LAYOUT,
      phase: this.conveyorPhase,
      occupiedCarrierIndexes: occupied,
      reservationSeed: seed,
    });
  }

  private hashString(text: string): number {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return hash;
  }

  private startCarrierTransfer(
    bucket: BucketState,
    carrier: Node,
    startWorldPosition: Vec3,
    onComplete?: () => void,
  ): ActiveCarrierEntry | null {
    const progress = { value: 0 };
    const transferRoot = this.ensureCarrierTransferRoot();
    const transform = transferRoot.getComponent(UITransform);
    if (transform === null) {
      return null;
    }
    const sourceLocal = transform.convertToNodeSpaceAR(startWorldPosition);
    const entry = Object.freeze({
      bucketInstanceId: bucket.instanceId,
      carrierIndex: this.loopCarrierNodes.indexOf(carrier),
      node: this.createMotionBucketNode(bucket),
      progress,
    });
    if (entry.carrierIndex < 0) {
      return null;
    }
    this.enteringCarriers.set(bucket.instanceId, entry);
    transferRoot.addChild(entry.node);
    entry.node.active = true;
    entry.node.setScale(CONVEYOR_BUCKET_SCALE, CONVEYOR_BUCKET_SCALE, 1);
    entry.node.setPosition(sourceLocal.x, sourceLocal.y, 0);
    tween(progress)
      .to(BATTLE_PRESENTATION_CONFIG.carrierEnterDuration, { value: 1 }, {
        easing: "quadInOut",
        onUpdate: () => {
          const current = this.enteringCarriers.get(bucket.instanceId);
          if (current === undefined) {
            return;
          }
          const target = this.getCarrierMouthNode(current.carrierIndex);
          const targetWorld = target?.worldPosition ?? null;
          if (targetWorld === null) {
            return;
          }
          const targetLocal = transform.convertToNodeSpaceAR(targetWorld);
          const p = progress.value;
          const x = lerp(sourceLocal.x, targetLocal.x, p);
          const y = lerp(sourceLocal.y, targetLocal.y, p) + 38 * Math.sin(Math.PI * p);
          entry.node.setPosition(x, y, 0);
        },
      })
      .call(() => {
        const current = this.enteringCarriers.get(bucket.instanceId);
        if (current === undefined) {
          return;
        }
        const targetCarrier = this.loopCarrierNodes[current.carrierIndex];
        if (targetCarrier === undefined) {
          return;
        }
        const root = targetCarrier.getChildByName("BucketAnchor")?.getChildByName("BucketVisualRoot") ?? null;
        if (root === null) {
          return;
        }
        this.enteringCarriers.delete(bucket.instanceId);
        this.activeCarriersByBucketId.set(bucket.instanceId, targetCarrier);
        this.reservedCarrierIndexesByBucketId.delete(bucket.instanceId);
        entry.node.destroy();
        renderBucketVisual(root, bucket, { scale: CONVEYOR_BUCKET_SCALE });
        onComplete?.();
      })
      .start();
    return entry;
  }

  private getCarrierMouthNode(carrierIndex: number): Node | null {
    return this.loopCarrierNodes[carrierIndex]?.getChildByName("BucketAnchor")?.getChildByName("BucketVisualRoot") ?? null;
  }

  private acquireCarrierVisual(bucketInstanceId: string): Node {
    const free = this.carrierPool.find((node) => !node.active && !this.isCarrierOwned(node));
    const carrier = free ?? new Node("CarrierVisual");
    if (free === undefined) {
      this.carrierPool.push(carrier);
    }
    carrier.name = `CarrierVisual_${bucketInstanceId}`;
    carrier.active = true;
    (carrier.getComponent(UITransform) ?? carrier.addComponent(UITransform)).setContentSize(LAYOUT.slotWidth, LAYOUT.slotHeight + 58);
    carrier.getComponent(UIOpacity) ?? carrier.addComponent(UIOpacity);
    this.ensureCarrierVisualChildren(carrier);
    return carrier;
  }

  private ensureCarrierVisualChildren(carrier: Node): void {
    let slotArt = carrier.getChildByName("SlotArt");
    if (slotArt === null) {
      slotArt = new Node("SlotArt");
      carrier.addChild(slotArt);
      slotArt.addComponent(UITransform).setContentSize(LAYOUT.slotWidth, LAYOUT.slotHeight);
      slotArt.addComponent(Graphics);
    }
    slotArt.setPosition(0, 0, 0);

    let anchor = carrier.getChildByName("BucketAnchor");
    if (anchor === null) {
      anchor = new Node("BucketAnchor");
      carrier.addChild(anchor);
      anchor.addComponent(UITransform).setContentSize(118, 128);
      anchor.addComponent(UIOpacity);
    }
    anchor.setPosition(0, 5, 0);
    if (anchor.getChildByName("BucketVisualRoot") === null) {
      const visualRoot = new Node("BucketVisualRoot");
      visualRoot.addComponent(UITransform);
      anchor.addChild(visualRoot);
      const body = new Node("BucketBody");
      body.addComponent(UITransform);
      body.addComponent(Sprite);
      visualRoot.addChild(body);
      const fillMask = new Node("FillMask");
      fillMask.addComponent(UITransform);
      visualRoot.addChild(fillMask);
      const fillSurface = new Node("FillSurface");
      fillSurface.addComponent(UITransform);
      fillSurface.addComponent(Sprite);
      fillMask.addChild(fillSurface);
      const fullBadge = new Node("FullBadge");
      fullBadge.addComponent(UITransform);
      fullBadge.addComponent(Sprite);
      visualRoot.addChild(fullBadge);
    }

    let remainingLabel = carrier.getChildByName("RemainingLabel");
    if (remainingLabel === null) {
      remainingLabel = new Node("RemainingLabel");
      carrier.addChild(remainingLabel);
      remainingLabel.addComponent(UITransform).setContentSize(72, 22);
      remainingLabel.addComponent(Label);
    }
    remainingLabel.setPosition(0, -52, 0);
    const label = remainingLabel.getComponent(Label);
    if (label !== null) {
      this.styleLabel(label, 15, 18);
    }
  }

  private renderCarrierVisual(carrier: Node, bucket: BucketState, mergeReady: boolean): void {
    this.drawCarrierSlotArt(carrier);
    const visualRoot = carrier.getChildByName("BucketAnchor")?.getChildByName("BucketVisualRoot") ?? null;
    renderBucketVisual(visualRoot, bucket, { mergeReady, scale: CONVEYOR_BUCKET_SCALE });
    const label = carrier.getChildByName("RemainingLabel")?.getComponent(Label) ?? null;
    if (label !== null) {
      label.string = createBucketVisualModel(bucket).remainingText;
      label.node.active = true;
      this.styleLabel(label, 15, 18);
    }
  }

  private drawCarrierSlotArt(carrier: Node): void {
    const graphics = carrier.getChildByName("SlotArt")?.getComponent(Graphics) ?? null;
    if (graphics === null) {
      return;
    }
    graphics.clear();
    graphics.fillColor = CARRIER_FILL_COLOR;
    graphics.strokeColor = CARRIER_STROKE_COLOR;
    graphics.lineWidth = 3;
    graphics.roundRect(-LAYOUT.slotWidth / 2, -LAYOUT.slotHeight / 2, LAYOUT.slotWidth, LAYOUT.slotHeight, 16);
    graphics.fill();
    graphics.stroke();
  }

  private ensureActiveCarrier(bucket: BucketState, slotIndex: number): Node {
    const existing = this.activeCarriersByBucketId.get(bucket.instanceId) ?? null;
    if (existing !== null) {
      return existing;
    }
    const carrierIndex = this.selectCarrierIndexForBucket(bucket.instanceId, slotIndex);
    const carrier = this.ensureLoopCarrier(carrierIndex);
    this.activeCarriersByBucketId.set(bucket.instanceId, carrier);
    return carrier;
  }

  private recycleInactiveActiveCarriers(liveBucketIds: ReadonlySet<string>): void {
    for (const [bucketId, carrier] of [...this.activeCarriersByBucketId.entries()]) {
      if (!liveBucketIds.has(bucketId)) {
        this.activeCarriersByBucketId.delete(bucketId);
        this.reservedCarrierIndexesByBucketId.delete(bucketId);
        this.recycleCarrierVisual(carrier);
      }
    }
  }

  private cancelEnteringCarriers(reason: string): void {
    for (const entry of this.enteringCarriers.values()) {
      Tween.stopAllByTarget(entry.progress);
      Tween.stopAllByTarget(entry.node);
      if (BATTLE_PRESENTATION_CONFIG.carrierDebugLogging) {
        console.log(`[ConveyorView] carrier transfer cancel bucketId=${entry.bucketInstanceId} reason=${reason}`);
      }
      this.reservedCarrierIndexesByBucketId.delete(entry.bucketInstanceId);
      this.recycleCarrierVisual(entry.node);
    }
    this.enteringCarriers.clear();
  }

  private recycleAllCarriers(): void {
    this.cancelEnteringCarriers("recycleAll");
    for (const carrier of this.activeCarriersByBucketId.values()) {
      this.recycleCarrierVisual(carrier);
    }
    this.activeCarriersByBucketId.clear();
  }

  private recycleCarrierVisual(carrier: Node): void {
    Tween.stopAllByTarget(carrier);
    const isLoopCarrier = this.loopCarrierNodes.includes(carrier);
    if (!isLoopCarrier) {
      carrier.active = false;
      carrier.name = "CarrierVisual";
      carrier.setPosition(0, 0, 0);
      carrier.setScale(1, 1, 1);
      (carrier.getComponent(UIOpacity) ?? carrier.addComponent(UIOpacity)).opacity = 255;
    }
    const root = carrier.getChildByName("BucketAnchor")?.getChildByName("BucketVisualRoot") ?? null;
    clearBucketVisual(root);
    const label = carrier.getChildByName("RemainingLabel");
    if (label !== null) {
      label.active = false;
    }
    this.refreshCarrierInteractable(carrier);
  }

  private refreshCarrierInteractable(carrier: Node): void {
    const button = carrier.getComponent(Button) ?? null;
    if (button !== null) {
      button.interactable = this.carrierToolTargetEnabled && this.findBucketIdForCarrier(carrier) !== null;
    }
    carrier.setScale(this.carrierToolTargetEnabled && this.findBucketIdForCarrier(carrier) !== null ? 1.04 : 1, this.carrierToolTargetEnabled && this.findBucketIdForCarrier(carrier) !== null ? 1.04 : 1, 1);
  }

  private handleCarrierTapped(carrier: Node): void {
    if (!this.carrierToolTargetEnabled) {
      return;
    }
    const bucketId = this.findBucketIdForCarrier(carrier);
    if (bucketId === null) {
      return;
    }
    this.flashBucketId(bucketId, "enter");
    this.carrierToolTargetHandler?.(bucketId);
  }

  private findBucketIdForCarrier(carrier: Node): string | null {
    for (const [bucketId, storedCarrier] of this.activeCarriersByBucketId.entries()) {
      if (storedCarrier === carrier) {
        return bucketId;
      }
    }
    return null;
  }

  private isCarrierOwned(node: Node): boolean {
    for (const entry of this.enteringCarriers.values()) {
      if (entry.node === node) {
        return true;
      }
    }
    for (const carrier of this.activeCarriersByBucketId.values()) {
      if (carrier === node) {
        return true;
      }
    }
    return false;
  }

  private acquireTransitionNode(bucket: BucketState): Node {
    const free = this.transitionNodePool.find((node) => !node.active);
    const node = free ?? this.createMotionBucketNode(bucket);
    if (free === undefined) {
      this.ensureCarrierTransferRoot().addChild(node);
      this.transitionNodePool.push(node);
    }
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    opacity.opacity = 255;
    renderBucketVisual(node.getChildByName("BucketVisualRoot"), bucket, { scale: 1 });
    node.active = false;
    return node;
  }

  private recycleTransitionNode(bucketId: string): void {
    const task = this.activeBucketTasks.get(bucketId);
    if (task === undefined) {
      return;
    }
    Tween.stopAllByTarget(task.progress);
    Tween.stopAllByTarget(task.node);
    resetTransitionNode(task.node);
    this.activeBucketTasks.delete(bucketId);
  }

  private cancelBucketPresentationTasks(): void {
    for (const task of this.activeBucketTasks.values()) {
      Tween.stopAllByTarget(task.progress);
      if (task.node.isValid) {
        Tween.stopAllByTarget(task.node);
      }
      resetTransitionNode(task.node);
    }
    this.activeBucketTasks.clear();
    for (const node of this.transitionNodePool) {
      if (node.isValid) {
        Tween.stopAllByTarget(node);
      }
      resetTransitionNode(node);
    }
    for (let index = this.transitionNodePool.length - 1; index >= 0; index -= 1) {
      if (!this.transitionNodePool[index].isValid) {
        this.transitionNodePool.splice(index, 1);
      }
    }
  }

  private createMotionBucketNode(bucket: BucketState): Node {
    const wrapper = new Node(`BucketMotion_${bucket.instanceId}`);
    wrapper.addComponent(UITransform).setContentSize(118, 126);

    const root = new Node("BucketVisualRoot");
    root.addComponent(UITransform);
    wrapper.addChild(root);

    const body = new Node("BucketBody");
    body.addComponent(UITransform);
    body.addComponent(Sprite);
    root.addChild(body);

    const fillMask = new Node("FillMask");
    fillMask.addComponent(UITransform);
    root.addChild(fillMask);

    const fillSurface = new Node("FillSurface");
    fillSurface.addComponent(UITransform);
    fillSurface.addComponent(Sprite);
    fillMask.addChild(fillSurface);

    const fullBadge = new Node("FullBadge");
    fullBadge.addComponent(UITransform);
    fullBadge.addComponent(Sprite);
    root.addChild(fullBadge);

    renderBucketVisual(root, bucket, { scale: 1 });
    return wrapper;
  }

  private styleLabel(label: Label, fontSize: number, lineHeight: number): void {
    label.color = TEXT_COLOR;
    label.fontSize = label.string.length >= 4 ? Math.max(12, fontSize - 2) : fontSize;
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

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * Math.max(0, Math.min(1, progress));
}

function resetTransitionNode(node: Node): void {
  if (!node.isValid) {
    return;
  }
  node.active = false;
  node.setPosition(0, 0, 0);
  node.setScale(1, 1, 1);
  const opacity = node.getComponent(UIOpacity);
  if (opacity !== null) {
    opacity.opacity = 255;
  }
}
