import { Color, Label, Node, Sprite, UITransform } from "cc";
import type { BucketState } from "../../domain/bucket/Bucket";

const BODY_COLOR = new Color(255, 255, 255, 255);
const DISABLED_BODY_COLOR = new Color(215, 215, 215, 255);
const SELECTED_BODY_COLOR = new Color(232, 246, 255, 255);
const MERGE_READY_BODY_COLOR = new Color(255, 246, 220, 255);
const ERROR_BODY_COLOR = new Color(255, 224, 221, 255);
const EMPTY_FILL_COLOR = new Color(255, 255, 255, 0);
const FULL_BADGE_COLOR = new Color(255, 255, 255, 255);
const TEXT_COLOR = new Color(38, 48, 45, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 210);
const SHADOW_COLOR = new Color(38, 48, 45, 90);
const BODY_SIZE = Object.freeze({ width: 118, height: 110 });
const ROOT_SIZE = Object.freeze({ width: 118, height: 104 });
const FILL_MASK_SIZE = Object.freeze({ width: 72, height: 28 });
const FILL_SURFACE_SIZE = Object.freeze({ width: 66, height: 24 });
const FULL_BADGE_SIZE = Object.freeze({ width: 48, height: 22 });
const MIN_FILL_Y = -14;
const MAX_FILL_Y = 12;

const COLOR_TINTS: Record<number, Color> = {
  1: new Color(242, 124, 138, 255),
  2: new Color(77, 182, 232, 255),
  3: new Color(246, 216, 74, 255),
  4: new Color(88, 200, 137, 255),
  5: new Color(155, 123, 234, 255),
  6: new Color(244, 154, 63, 255),
};

export interface BucketVisualRenderOptions {
  disabled?: boolean;
  selected?: boolean;
  mergeReady?: boolean;
  error?: boolean;
  scale?: number;
}

export function renderBucketVisual(
  root: Node | null,
  bucket: BucketState | undefined,
  options: BucketVisualRenderOptions = {},
): void {
  if (root === null) {
    return;
  }

  root.active = bucket !== undefined;
  root.setScale(options.scale ?? 1, options.scale ?? 1, 1);
  normalizeBucketVisualGeometry(root);

  const body = root.getChildByName("Body")?.getComponent(Sprite) ?? null;
  const fillSurface = root.getChildByPath("FillMask/FillSurface")?.getComponent(Sprite) ?? null;
  const fillSurfaceNode = fillSurface?.node ?? null;
  const fullBadge = root.getChildByName("FullBadge") ?? null;

  if (body !== null) {
    body.color = getBodyColor(options);
  }

  if (bucket === undefined) {
    if (fillSurfaceNode !== null) {
      fillSurfaceNode.active = false;
    }
    if (fillSurface !== null) {
      fillSurface.color = EMPTY_FILL_COLOR;
    }
    if (fullBadge !== null) {
      fullBadge.active = false;
    }
    return;
  }

  const fillRatio = Math.max(0, Math.min(1, bucket.amount / bucket.capacity));
  if (fillSurfaceNode !== null) {
    fillSurfaceNode.active = fillRatio > 0;
    fillSurfaceNode.setPosition(0, MIN_FILL_Y + fillRatio * (MAX_FILL_Y - MIN_FILL_Y), 0);
  }
  if (fillSurface !== null) {
    fillSurface.color = COLOR_TINTS[bucket.colorId] ?? new Color(230, 230, 230, 255);
  }
  if (fullBadge !== null) {
    fullBadge.active = fillRatio >= 1;
    const badgeSprite = fullBadge.getComponent(Sprite);
    if (badgeSprite !== null) {
      badgeSprite.color = FULL_BADGE_COLOR;
    }
  }
}

function getBodyColor(options: BucketVisualRenderOptions): Color {
  if (options.error) {
    return ERROR_BODY_COLOR;
  }
  if (options.disabled) {
    return DISABLED_BODY_COLOR;
  }
  if (options.selected) {
    return SELECTED_BODY_COLOR;
  }
  if (options.mergeReady) {
    return MERGE_READY_BODY_COLOR;
  }
  return BODY_COLOR;
}

export function clearBucketVisual(root: Node | null): void {
  renderBucketVisual(root, undefined);
}

function normalizeBucketVisualGeometry(root: Node): void {
  setContentSize(root, ROOT_SIZE.width, ROOT_SIZE.height);
  setContentSize(root.getChildByName("Body") ?? null, BODY_SIZE.width, BODY_SIZE.height);

  const fillMask = root.getChildByName("FillMask");
  if (fillMask !== null) {
    fillMask.setPosition(0, 10, 0);
    setContentSize(fillMask, FILL_MASK_SIZE.width, FILL_MASK_SIZE.height);
  }

  const fillSurfaceNode = root.getChildByPath("FillMask/FillSurface");
  if (fillSurfaceNode !== null) {
    setContentSize(fillSurfaceNode, FILL_SURFACE_SIZE.width, FILL_SURFACE_SIZE.height);
  }

  const fullBadge = root.getChildByName("FullBadge");
  if (fullBadge !== null) {
    fullBadge.setPosition(0, 33, 0);
    setContentSize(fullBadge, FULL_BADGE_SIZE.width, FULL_BADGE_SIZE.height);
    const label = fullBadge.getComponent(Label);
    if (label !== null) {
      styleSmallLabel(label);
    }
  }
}

function setContentSize(node: Node | null, width: number, height: number): void {
  const transform = node?.getComponent(UITransform) ?? null;
  transform?.setContentSize(width, height);
}

function styleSmallLabel(label: Label): void {
  label.color = TEXT_COLOR;
  label.fontSize = 14;
  label.lineHeight = 18;
  label.enableOutline = true;
  label.outlineColor = TEXT_OUTLINE_COLOR;
  label.outlineWidth = 2;
  label.enableShadow = true;
  label.shadowColor = SHADOW_COLOR;
  label.shadowOffset.set(1, -1);
  label.shadowBlur = 1;
}
