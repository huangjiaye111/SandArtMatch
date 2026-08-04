import { _decorator, Button, Color, Component, Graphics, Label, Layout, Mask, Node, ScrollView, Sprite, Tween, UIOpacity, UITransform, Vec3, tween } from "cc";
import { createBucketPoolState, type BucketPoolBucketState } from "../../domain/bucket/BucketPool";
import type { BucketState } from "../../domain/bucket/Bucket";
import { createBucketPoolLayoutModel, createBucketPoolVisualLayoutModel, selectCandidateBuckets } from "./BucketPoolLayoutModel";
import { createBucketVisualModel } from "./BucketVisualModel";
import { clearBucketVisual, renderBucketVisual } from "./BucketVisualView";
import type { BattlePresentationEvent } from "./BattleViewContract";
import type { BattleUiActions } from "./BattleViewContract";

const { ccclass, property } = _decorator;

const BUCKET_POOL_SCALE = 0.78;
const BUCKET_POOL_VIEWPORT_HEIGHT = 438;
const BUCKET_POOL_SHIFT_DURATION = 0.16;
const GENERATED_BUCKET_PREFIX = "RuntimeBucketButton";
const TEXT_COLOR = new Color(38, 48, 45, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 220);
const SHADOW_COLOR = new Color(38, 48, 45, 80);
const SLOT_FILL_COLOR = new Color(255, 247, 222, 135);
const SLOT_STROKE_COLOR = new Color(142, 111, 62, 95);
const VIEWPORT_NODE_NAME = "Viewport";
const CONTENT_NODE_NAME = "Content";
const GRID_NODE_NAME = "BucketPoolGrid";
const SLOT_LAYER_NODE_NAME = "BucketPoolSlotArtLayer";

@ccclass("BucketPoolView")
export class BucketPoolView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property([Label])
  public bucketLabels: Label[] = [];

  @property([Button])
  public bucketButtons: Button[] = [];

  @property
  public debugBindingChecksEnabled = false;

  private actions: BattleUiActions | null = null;
  private inputEnabled = true;
  private renderedBuckets: readonly BucketState[] = [];
  private renderedPoolBuckets: readonly BucketPoolBucketState[] = [];
  private readonly buttonHandlers: Array<() => void> = [];
  private readonly inFlightBucketIds = new Set<string>();
  private viewportNode: Node | null = null;
  private contentNode: Node | null = null;
  private visualRevision = 0;

  public setActions(actions: BattleUiActions): void {
    this.actions = actions;
    this.ensureBucketViews(this.renderedBuckets.length);
    this.applyStableLayout(createBucketPoolVisualLayoutModel(this.renderedPoolBuckets, BUCKET_POOL_VIEWPORT_HEIGHT));
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
    this.visualRevision += 1;
    const poolState = createBucketPoolState(buckets);
    const candidateBuckets = selectCandidateBuckets(buckets);
    const layout = createBucketPoolVisualLayoutModel(poolState.buckets, BUCKET_POOL_VIEWPORT_HEIGHT);
    const previousPositions = this.captureBucketPositions();
    this.ensureScrollContainer();
    this.ensureBucketViews(candidateBuckets.length);
    this.applyStableLayout(layout);
    this.renderedBuckets = candidateBuckets;
    this.renderedPoolBuckets = poolState.buckets;
    this.debugValidateCandidateBindings(candidateBuckets);
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }

    for (let index = 0; index < this.bucketLabels.length; index += 1) {
      const bucket = candidateBuckets[index];
      const poolBucket = poolState.buckets[index];
      this.resetBucketNode(index);
      this.bucketLabels[index].string = bucket === undefined ? "" : createBucketVisualModel(bucket).remainingText;
      this.bucketLabels[index].node.active = bucket !== undefined && !this.inFlightBucketIds.has(bucket.instanceId);
      this.styleBucketLabel(this.bucketLabels[index]);
      renderBucketVisual(this.getBucketVisualRoot(index), bucket, {
        disabled: !this.isBucketButtonEnabled(index, bucket, poolBucket),
        scale: BUCKET_POOL_SCALE,
      });
      this.applyBucketFlightVisibility(index, bucket);
      if (bucket !== undefined) {
        const target = layout.cells[index];
        if (target !== undefined) {
          this.positionBucketNode(index, bucket.instanceId, target, previousPositions);
        }
      }
    }
    this.refreshButtonStates();
  }

  public playFeedback(events: readonly BattlePresentationEvent[]): void {
    for (const event of events) {
      if (event.type === "bucketClicked") {
        this.flashBucket(event.bucketInstanceId, "selected");
      } else if (event.type === "invalidClick") {
        this.flashFirstUnavailableBucket();
      }
    }
  }

  public cancelFeedback(): void {
    this.visualRevision += 1;
    this.inFlightBucketIds.clear();
    this.unscheduleAllCallbacks();
    for (const button of this.bucketButtons) {
      Tween.stopAllByTarget(button.node);
      button.node.setScale(1, 1, 1);
      const opacity = button.node.getComponent(UIOpacity) ?? button.node.addComponent(UIOpacity);
      opacity.opacity = 255;
    }
    for (let index = 0; index < this.renderedBuckets.length; index += 1) {
      const bucket = this.renderedBuckets[index];
      const poolBucket = this.renderedPoolBuckets[index];
      if (bucket !== undefined) {
        renderBucketVisual(this.getBucketVisualRoot(index), bucket, {
          disabled: !this.isBucketButtonEnabled(index, bucket, poolBucket),
          scale: BUCKET_POOL_SCALE,
        });
      }
    }
  }

  public getBucketWorldPosition(bucketInstanceId: string): Vec3 | null {
    const index = this.renderedBuckets.findIndex((bucket) => bucket.instanceId === bucketInstanceId);
    const root = index >= 0 ? this.getBucketVisualRoot(index) : null;
    return root === null ? null : root.worldPosition.clone();
  }

  public markBucketInFlight(bucketInstanceId: string): void {
    this.inFlightBucketIds.add(bucketInstanceId);
    const index = this.renderedBuckets.findIndex((bucket) => bucket.instanceId === bucketInstanceId);
    if (index >= 0) {
      this.applyBucketFlightVisibility(index, this.renderedBuckets[index]);
    }
  }

  public completeBucketFlight(bucketInstanceId: string): void {
    this.inFlightBucketIds.delete(bucketInstanceId);
  }

  public clear(): void {
    this.visualRevision += 1;
    this.inFlightBucketIds.clear();
    this.cancelFeedback();
    this.applyStableLayout(createBucketPoolVisualLayoutModel(this.renderedPoolBuckets, BUCKET_POOL_VIEWPORT_HEIGHT));
    this.renderedBuckets = [];
    this.renderedPoolBuckets = [];
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
      const poolBucket = this.renderedPoolBuckets[index];
      this.bucketButtons[index].interactable = this.isBucketButtonEnabled(index, bucket, poolBucket);
      renderBucketVisual(this.getBucketVisualRoot(index), bucket, {
        disabled: !this.bucketButtons[index].interactable,
        scale: BUCKET_POOL_SCALE,
      });
      this.applyBucketFlightVisibility(index, bucket);
    }
  }

  private getBucketVisualRoot(index: number) {
    return this.bucketButtons[index]?.node.getChildByName("BucketVisualRoot") ?? null;
  }

  private ensureBucketViews(count: number): void {
    this.ensureScrollContainer();
    const grid = this.getGridNode();
    const slotLayer = this.getSlotLayerNode();
    if (grid === null) {
      return;
    }
    this.syncSerializedButtonsIntoGrid(grid);
    while (this.bucketButtons.length < count) {
      const index = this.bucketButtons.length;
      const buttonNode = this.createRuntimeBucketButton(index);
      grid.addChild(buttonNode);
      this.bucketButtons.push(buttonNode.getComponent(Button) as Button);
      this.bucketLabels.push(buttonNode.getChildByName("RemainingLabel")?.getComponent(Label) as Label);
    }
    while (slotLayer !== null && slotLayer.children.length < count) {
      const slotNode = this.createRuntimeSlotArt(slotLayer.children.length);
      slotLayer.addChild(slotNode);
    }
    if (this.buttonHandlers.length !== this.bucketButtons.length && this.actions !== null) {
      this.rebindButtons();
    }
  }

  private createRuntimeBucketButton(index: number): Node {
    const buttonNode = new Node(`${GENERATED_BUCKET_PREFIX}${index + 1}`);
    buttonNode.addComponent(UITransform);
    buttonNode.addComponent(UIOpacity);
    buttonNode.addComponent(Button);

    const visualRoot = new Node("BucketVisualRoot");
    visualRoot.addComponent(UITransform);
    buttonNode.addChild(visualRoot);

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

    const labelNode = new Node("RemainingLabel");
    labelNode.addComponent(UITransform);
    labelNode.addComponent(Label);
    buttonNode.addChild(labelNode);
    return buttonNode;
  }

  private applyStableLayout(model: ReturnType<typeof createBucketPoolVisualLayoutModel> | null): void {
    this.ensureScrollContainer();
    const grid = this.getGridNode();
    const slotLayer = this.getSlotLayerNode();
    const panel = this.node.getChildByName("PanelBackground");
    const layout = grid?.getComponent(Layout) ?? null;
    if (layout !== null) {
      layout.enabled = false;
    }
    const nextModel = model ?? createBucketPoolLayoutModel(this.bucketButtons.length, BUCKET_POOL_VIEWPORT_HEIGHT);
    if (grid !== null) {
      this.syncSerializedButtonsIntoGrid(grid);
    }
    setContentSize(this.node, nextModel.panelWidth, nextModel.viewportHeight);
    setContentSize(panel, nextModel.panelWidth, nextModel.viewportHeight);
    setContentSize(this.viewportNode, nextModel.panelWidth, nextModel.viewportHeight);
    setContentSize(this.contentNode, nextModel.panelWidth, nextModel.contentHeight);
    setContentSize(grid, nextModel.panelWidth, nextModel.contentHeight);
    setContentSize(slotLayer, nextModel.panelWidth, nextModel.contentHeight);
    this.contentNode?.setPosition(0, -nextModel.scrollableOverflow / 2, 0);
    grid?.setPosition(0, 0, 0);
    slotLayer?.setPosition(0, 0, 0);

    for (let index = 0; index < this.bucketButtons.length; index += 1) {
      const position = nextModel.cells[index] ?? { x: 0, y: 0 };
      const buttonNode = this.bucketButtons[index].node;
      buttonNode.setPosition(position.x, position.y, 0);
      buttonNode.setSiblingIndex(index);
      const slot = slotLayer?.children[index] ?? null;
      slot?.setPosition(position.x, position.y, 0);
      slot?.setSiblingIndex(index);
      setContentSize(slot, 132, nextModel.cellHeight - 10);
      drawRuntimeSlotArt(slot);
      setContentSize(buttonNode, 132, nextModel.cellHeight);
      const visualRoot = this.getBucketVisualRoot(index);
      visualRoot?.setPosition(0, 24, 0);
      const label = this.bucketLabels[index];
      label.node.setPosition(0, -58, 0);
      setContentSize(label.node, 128, 30);
      this.styleBucketLabel(label);
    }

    for (let index = 0; index < this.bucketButtons.length; index += 1) {
      this.bucketButtons[index].node.active = index < nextModel.cells.length;
      if (this.bucketLabels[index] !== undefined) {
        this.bucketLabels[index].node.active = index < nextModel.cells.length && this.bucketLabels[index].string.length > 0;
      }
    }
  }

  private resetBucketNode(index: number): void {
    const button = this.bucketButtons[index];
    const label = this.bucketLabels[index];
    const root = this.getBucketVisualRoot(index);
    if (button !== undefined) {
      Tween.stopAllByTarget(button.node);
      button.node.setScale(1, 1, 1);
      const opacity = button.node.getComponent(UIOpacity) ?? button.node.addComponent(UIOpacity);
      opacity.opacity = 255;
    }
    if (root !== null) {
      Tween.stopAllByTarget(root);
      root.setScale(1, 1, 1);
      root.setPosition(0, 24, 0);
      const opacity = root.getComponent(UIOpacity) ?? root.addComponent(UIOpacity);
      opacity.opacity = 255;
      clearBucketVisual(root);
    }
    if (label !== undefined) {
      label.string = "";
      label.node.active = false;
      label.node.setScale(1, 1, 1);
      label.node.setPosition(0, -58, 0);
      this.styleBucketLabel(label);
    }
  }

  private ensureScrollContainer(): void {
    const panel = this.node.getChildByName("PanelBackground");
    const viewport = this.node.getChildByName(VIEWPORT_NODE_NAME) ?? new Node(VIEWPORT_NODE_NAME);
    if (viewport.parent === null) {
      this.node.addChild(viewport);
    }
    viewport.active = true;
    viewport.setPosition(0, 0, 0);
    viewport.setSiblingIndex(1);
    viewport.getComponent(UITransform) ?? viewport.addComponent(UITransform);
    const mask = viewport.getComponent(Mask) ?? viewport.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const content = viewport.getChildByName(CONTENT_NODE_NAME) ?? new Node(CONTENT_NODE_NAME);
    if (content.parent !== viewport) {
      content.removeFromParent();
      viewport.addChild(content);
    }
    content.active = true;
    content.getComponent(UITransform) ?? content.addComponent(UITransform);

    const scrollView = this.node.getComponent(ScrollView) ?? this.node.addComponent(ScrollView);
    scrollView.content = content;
    scrollView.vertical = true;
    scrollView.horizontal = false;
    scrollView.inertia = true;
    scrollView.brake = 0.55;

    this.viewportNode = viewport;
    this.contentNode = content;
    this.moveLayerIntoContent(SLOT_LAYER_NODE_NAME);
    this.moveLayerIntoContent(GRID_NODE_NAME);
    this.getSlotLayerNode();
    this.getGridNode();
    panel?.setSiblingIndex(0);
    viewport.setSiblingIndex(1);
  }

  private moveLayerIntoContent(name: string): void {
    const content = this.contentNode;
    if (content === null) {
      return;
    }
    const direct = this.findDirectOrNestedLayer(name);
    const existing = content.getChildByName(name);
    const layer = existing ?? direct;
    if (layer === null) {
      return;
    }
    if (layer.parent !== content) {
      layer.removeFromParent();
      content.addChild(layer);
    }
    layer.active = true;
  }

  private findDirectOrNestedLayer(name: string): Node | null {
    const direct = this.node.getChildByName(name);
    if (direct !== null) {
      return direct;
    }
    const viewport = this.node.getChildByName(VIEWPORT_NODE_NAME);
    const content = viewport?.getChildByName(CONTENT_NODE_NAME) ?? null;
    return content?.getChildByName(name) ?? null;
  }

  private getGridNode(): Node | null {
    const existing = this.contentNode?.getChildByName(GRID_NODE_NAME) ?? this.node.getChildByName(GRID_NODE_NAME);
    if (existing !== null) {
      return existing;
    }
    if (this.contentNode === null) {
      return null;
    }
    const grid = new Node(GRID_NODE_NAME);
    grid.addComponent(UITransform);
    this.contentNode.addChild(grid);
    return grid;
  }

  private getSlotLayerNode(): Node | null {
    const existing = this.contentNode?.getChildByName(SLOT_LAYER_NODE_NAME) ?? this.node.getChildByName(SLOT_LAYER_NODE_NAME);
    if (existing !== null) {
      return existing;
    }
    if (this.contentNode === null) {
      return null;
    }
    const layer = new Node(SLOT_LAYER_NODE_NAME);
    layer.addComponent(UITransform);
    this.contentNode.addChild(layer);
    layer.setSiblingIndex(0);
    return layer;
  }

  private syncSerializedButtonsIntoGrid(grid: Node): void {
    for (const button of this.bucketButtons) {
      const buttonNode = button.node;
      if (buttonNode.parent === grid) {
        buttonNode.active = true;
        continue;
      }
      buttonNode.removeFromParent();
      grid.addChild(buttonNode);
      buttonNode.active = true;
    }
  }

  private createRuntimeSlotArt(index: number): Node {
    const slotNode = new Node(`RuntimeBucketSlotArt${index + 1}`);
    slotNode.addComponent(UITransform);
    slotNode.addComponent(Graphics);
    return slotNode;
  }

  private styleBucketLabel(label: Label): void {
    label.color = TEXT_COLOR;
    label.fontSize = label.string.length >= 4 ? 14 : 16;
    label.lineHeight = 20;
    label.enableOutline = true;
    label.outlineColor = TEXT_OUTLINE_COLOR;
    label.outlineWidth = 2;
    label.enableShadow = true;
    label.shadowColor = SHADOW_COLOR;
    label.shadowOffset.set(1, -1);
    label.shadowBlur = 1;
  }

  private isBucketButtonEnabled(_index: number, bucket: BucketState | undefined, poolBucket: BucketPoolBucketState | undefined): boolean {
    return this.inputEnabled && bucket !== undefined && poolBucket !== undefined && poolBucket.isSelectable && !this.inFlightBucketIds.has(bucket.instanceId);
  }

  private captureBucketPositions(): Map<string, Vec3> {
    const positions = new Map<string, Vec3>();
    for (let index = 0; index < this.renderedBuckets.length; index += 1) {
      const bucket = this.renderedBuckets[index];
      const node = this.bucketButtons[index]?.node;
      if (bucket === undefined || node === undefined) {
        continue;
      }
      positions.set(bucket.instanceId, node.position.clone());
    }
    return positions;
  }

  private positionBucketNode(
    index: number,
    bucketInstanceId: string,
    target: { readonly x: number; readonly y: number },
    previousPositions: Map<string, Vec3>,
  ): void {
    const node = this.bucketButtons[index]?.node;
    if (node === undefined) {
      return;
    }

    const previous = previousPositions.get(bucketInstanceId);
    const targetPosition = new Vec3(target.x, target.y, 0);
    Tween.stopAllByTarget(node);
    if (previous !== undefined && (previous.x !== targetPosition.x || previous.y !== targetPosition.y)) {
      node.setPosition(previous);
      tween(node).to(BUCKET_POOL_SHIFT_DURATION, { position: targetPosition }, { easing: "cubicOut" }).start();
      return;
    }

    node.setPosition(targetPosition);
  }

  private selectBucketAt(index: number): void {
    if (!this.inputEnabled) {
      return;
    }
    const bucket = this.renderedBuckets[index];
    const poolBucket = this.renderedPoolBuckets[index];
    if (bucket === undefined || poolBucket === undefined || !poolBucket.isSelectable) {
      this.flashBucketAt(index, "error");
      return;
    }
    this.flashBucketAt(index, "selected");
    this.actions?.selectBucket(bucket.instanceId);
  }

  private applyBucketFlightVisibility(index: number, bucket: BucketState | undefined): void {
    const hidden = bucket !== undefined && this.inFlightBucketIds.has(bucket.instanceId);
    const button = this.bucketButtons[index];
    const label = this.bucketLabels[index];
    const root = this.getBucketVisualRoot(index);
    if (button !== undefined) {
      button.node.active = bucket !== undefined && !hidden;
      button.interactable = !hidden && this.isBucketButtonEnabled(index, bucket, this.renderedPoolBuckets[index]);
    }
    if (root !== null) {
      root.active = bucket !== undefined && !hidden;
    }
    if (label !== undefined) {
      label.node.active = bucket !== undefined && !hidden && label.string.length > 0;
    }
  }

  private flashBucket(bucketInstanceId: string, kind: "selected" | "error"): void {
    const index = this.renderedBuckets.findIndex((bucket) => bucket.instanceId === bucketInstanceId);
    if (index >= 0) {
      this.flashBucketAt(index, kind);
    }
  }

  private flashFirstUnavailableBucket(): void {
    const index = this.renderedPoolBuckets.findIndex((bucket) => !bucket.isSelectable);
    this.flashBucketAt(index >= 0 ? index : 0, "error");
  }

  private flashBucketAt(index: number, kind: "selected" | "error"): void {
    const bucket = this.renderedBuckets[index];
    const root = this.getBucketVisualRoot(index);
    if (bucket === undefined || root === null) {
      return;
    }

    root.setPosition(0, kind === "selected" ? 22 : 14, 0);
    const revision = this.visualRevision;
    const bucketInstanceId = bucket.instanceId;
    renderBucketVisual(root, bucket, {
      disabled: !this.isBucketButtonEnabled(index, bucket, this.renderedPoolBuckets[index]),
      error: kind === "error",
      selected: kind === "selected",
      scale: kind === "selected" ? BUCKET_POOL_SCALE * 1.06 : BUCKET_POOL_SCALE,
    });
    this.scheduleOnce(() => {
      if (revision !== this.visualRevision || this.renderedBuckets[index]?.instanceId !== bucketInstanceId) {
        return;
      }
      root.setPosition(0, 14, 0);
      renderBucketVisual(root, bucket, {
        disabled: !this.isBucketButtonEnabled(index, bucket, this.renderedPoolBuckets[index]),
        scale: BUCKET_POOL_SCALE,
      });
    }, kind === "error" ? 0.18 : 0.22);
  }

  private debugValidateCandidateBindings(buckets: readonly BucketState[]): void {
    if (!this.debugBindingChecksEnabled) {
      return;
    }

    const seen = new Set<string>();
    for (const bucket of buckets) {
      if (seen.has(bucket.instanceId)) {
        console.error(`[BucketPoolView] duplicate candidate bucketId=${bucket.instanceId}`);
      }
      seen.add(bucket.instanceId);
      const remaining = bucket.capacity - bucket.amount;
      if (bucket.amount === 0 && remaining === 0 && bucket.capacity > 0) {
        console.error(`[BucketPoolView] empty candidate has zero remaining bucketId=${bucket.instanceId}`);
      }
      if (bucket.amount >= bucket.capacity) {
        console.error(`[BucketPoolView] full candidate leaked into pool bucketId=${bucket.instanceId}`);
      }
      if (bucket.status !== "available") {
        console.error(`[BucketPoolView] non-candidate status leaked into pool bucketId=${bucket.instanceId} status=${bucket.status}`);
      }
    }
  }

  public debugDumpBucketVisualBindings(): readonly string[] {
    const lines: string[] = [];
    for (let index = 0; index < this.bucketButtons.length; index += 1) {
      const node = this.bucketButtons[index]?.node;
      const bucket = this.renderedBuckets[index];
      if (node === undefined) {
        continue;
      }
      lines.push(
        [
          `path=${getNodePath(node)}`,
          `active=${node.active}`,
          `source=${node.name.startsWith(GENERATED_BUCKET_PREFIX) ? "runtime" : "serialized"}`,
          `bucketId=${bucket?.instanceId ?? ""}`,
          `colorId=${bucket?.colorId ?? ""}`,
          `revision=${this.visualRevision}`,
        ].join(" "),
      );
    }
    return Object.freeze(lines);
  }
}

function setContentSize(node: Node | null | undefined, width: number, height: number): void {
  node?.getComponent(UITransform)?.setContentSize(width, height);
}

function drawRuntimeSlotArt(node: Node | null | undefined): void {
  const graphics = node?.getComponent(Graphics) ?? null;
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = SLOT_FILL_COLOR;
  graphics.strokeColor = SLOT_STROKE_COLOR;
  graphics.lineWidth = 2;
  graphics.roundRect(-58, -48, 116, 96, 14);
  graphics.fill();
  graphics.stroke();
}

function getNodePath(node: Node): string {
  const names: string[] = [];
  let current: Node | null = node;
  while (current !== null) {
    names.unshift(current.name);
    current = current.parent;
  }
  return names.join("/");
}
