import { Color, Graphics, Label, Node, Sprite, UIOpacity, UITransform } from "cc";
import type { BucketState } from "../../domain/bucket/Bucket";
import { createBucketVisualModel } from "./BucketVisualModel";

const DISABLED_BODY_COLOR = new Color(215, 215, 215, 255);
const ERROR_BODY_COLOR = new Color(255, 224, 221, 255);
const EMPTY_FILL_COLOR = new Color(255, 255, 255, 0);
const FULL_BADGE_COLOR = new Color(255, 255, 255, 255);
const TEXT_COLOR = new Color(38, 48, 45, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 210);
const SHADOW_COLOR = new Color(38, 48, 45, 90);
const BODY_SIZE = Object.freeze({ width: 112, height: 116 });
const ROOT_SIZE = Object.freeze({ width: 120, height: 128 });
const FILL_MASK_SIZE = Object.freeze({ width: 68, height: 46 });
const FILL_SURFACE_SIZE = Object.freeze({ width: 62, height: 42 });
const FULL_BADGE_SIZE = Object.freeze({ width: 46, height: 18 });
const COLOR_BADGE_SIZE = Object.freeze({ width: 58, height: 10 });
const COLOR_RIM_SIZE = Object.freeze({ width: 86, height: 24 });
const COLOR_PANEL_SIZE = Object.freeze({ width: 88, height: 66 });
const MIN_FILL_Y = -23;
const MAX_FILL_Y = 2;

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
  root.setPosition(root.position.x, root.position.y, 0);
  (root.getComponent(UIOpacity) ?? root.addComponent(UIOpacity)).opacity = 255;
  normalizeBucketVisualGeometry(root);

  const model = createBucketVisualModel(bucket);
  const body = getBucketBodyNode(root)?.getComponent(Sprite) ?? null;
  const fillSurface = root.getChildByPath("FillMask/FillSurface")?.getComponent(Sprite) ?? null;
  const fillSurfaceNode = fillSurface?.node ?? null;
  const fullBadge = root.getChildByName("FullBadge") ?? null;
  const shadow = ensureTargetColorShape(root, "BucketShadow", -46, 94, 18);
  const shell = ensureTargetColorShape(root, "ColoredShell", -18, COLOR_PANEL_SIZE.width, COLOR_PANEL_SIZE.height);
  const colorBadge = ensureColorBadge(root);
  const colorRim = ensureTargetColorShape(root, "TargetColorRim", 15, COLOR_RIM_SIZE.width, COLOR_RIM_SIZE.height);
  const stateMark = ensureTargetColorShape(root, "StateMark", 42, 54, 16);
  orderStandardChildren(root);

  if (bucket === undefined) {
    if (body !== null) {
      body.color = DISABLED_BODY_COLOR;
    }
    clearGraphic(shadow);
    clearGraphic(shell);
    colorBadge.active = false;
    colorRim.active = false;
    stateMark.active = false;
    if (fillSurfaceNode !== null) {
      fillSurfaceNode.active = false;
      fillSurfaceNode.setScale(1, 1, 1);
    }
    if (fillSurface !== null) {
      fillSurface.color = EMPTY_FILL_COLOR;
    }
    if (fullBadge !== null) {
      fullBadge.active = false;
    }
    return;
  }

  if (body !== null) {
    body.color = options.disabled ? DISABLED_BODY_COLOR : colorFromHex(model.bodyFill, options.selected || options.mergeReady ? 180 : 140);
  }

  shadow.active = true;
  shell.active = true;
  colorBadge.active = model.colorBadgeVisible;
  colorRim.active = model.colorBadgeVisible;
  stateMark.active = options.selected === true || options.mergeReady === true || options.error === true || options.disabled === true || model.fullBadgeVisible;
  drawShadow(shadow);
  drawBucketShell(shell, model.bodyFill, options);
  drawColorBadge(colorBadge, model.colorBadgeFill);
  drawRim(colorRim, model.mouthFill);
  drawStateMark(stateMark, model.fullBadgeVisible, options);

  const fillRatio = model.fillRatio;
  if (fillSurfaceNode !== null) {
    fillSurfaceNode.active = model.fillSurfaceVisible;
    fillSurfaceNode.setPosition(0, MIN_FILL_Y + fillRatio * (MAX_FILL_Y - MIN_FILL_Y), 0);
    fillSurfaceNode.setScale(1, Math.max(0.08, fillRatio), 1);
  }
  if (fillSurface !== null) {
    fillSurface.color = COLOR_TINTS[bucket.colorId] ?? new Color(230, 230, 230, 255);
  }
  if (fullBadge !== null) {
    fullBadge.active = false;
    const badgeSprite = fullBadge.getComponent(Sprite);
    if (badgeSprite !== null) {
      badgeSprite.color = FULL_BADGE_COLOR;
    }
  }
}

export function clearBucketVisual(root: Node | null): void {
  renderBucketVisual(root, undefined);
}

function normalizeBucketVisualGeometry(root: Node): void {
  setContentSize(root, ROOT_SIZE.width, ROOT_SIZE.height);
  setContentSize(getBucketBodyNode(root), BODY_SIZE.width, BODY_SIZE.height);

  const fillMask = root.getChildByName("FillMask");
  if (fillMask !== null) {
    fillMask.setPosition(0, -14, 0);
    setContentSize(fillMask, FILL_MASK_SIZE.width, FILL_MASK_SIZE.height);
  }

  const fillSurfaceNode = root.getChildByPath("FillMask/FillSurface");
  if (fillSurfaceNode !== null) {
    setContentSize(fillSurfaceNode, FILL_SURFACE_SIZE.width, FILL_SURFACE_SIZE.height);
  }

  const fullBadge = root.getChildByName("FullBadge");
  if (fullBadge !== null) {
    fullBadge.setPosition(0, 42, 0);
    setContentSize(fullBadge, FULL_BADGE_SIZE.width, FULL_BADGE_SIZE.height);
    const label = fullBadge.getComponent(Label);
    if (label !== null) {
      styleSmallLabel(label);
    }
  }
}

function getBucketBodyNode(root: Node): Node | null {
  return root.getChildByName("BucketBody") ?? root.getChildByName("Body");
}

function ensureColorBadge(root: Node): Node {
  const existing = root.getChildByName("ColorBadge");
  const badge = existing ?? new Node("ColorBadge");
  if (existing === null) {
    root.addChild(badge);
  }
  badge.setPosition(0, -44, 0);
  setContentSize(badge, COLOR_BADGE_SIZE.width, COLOR_BADGE_SIZE.height);
  badge.getComponent(Graphics) ?? badge.addComponent(Graphics);
  return badge;
}

function ensureTargetColorShape(root: Node, name: string, y: number, width: number, height: number): Node {
  const existing = root.getChildByName(name);
  const node = existing ?? new Node(name);
  if (existing === null) {
    root.addChild(node);
  }
  node.setPosition(0, y, 0);
  setContentSize(node, width, height);
  node.getComponent(Graphics) ?? node.addComponent(Graphics);
  return node;
}

function orderStandardChildren(root: Node): void {
  root.getChildByName("BucketShadow")?.setSiblingIndex(0);
  getBucketBodyNode(root)?.setSiblingIndex(1);
  root.getChildByName("ColoredShell")?.setSiblingIndex(2);
  root.getChildByName("FillMask")?.setSiblingIndex(3);
  root.getChildByName("TargetColorRim")?.setSiblingIndex(4);
  root.getChildByName("StateMark")?.setSiblingIndex(5);
  root.getChildByName("ColorBadge")?.setSiblingIndex(6);
}

function clearGraphic(node: Node): void {
  node.getComponent(Graphics)?.clear();
}

function drawColorBadge(node: Node, fill: string): void {
  drawPill(node, fill, COLOR_BADGE_SIZE.width, COLOR_BADGE_SIZE.height, 255);
}

function drawPill(node: Node, fill: string, width: number, height: number, alpha: number): void {
  const graphics = node.getComponent(Graphics);
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = colorFromHex(fill, alpha);
  graphics.roundRect(-width / 2, -height / 2, width, height, Math.max(4, height / 2));
  graphics.fill();
}

function drawShadow(node: Node): void {
  const graphics = node.getComponent(Graphics);
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = new Color(38, 48, 45, 45);
  graphics.ellipse(0, 0, 47, 9);
  graphics.fill();
}

function drawBucketShell(node: Node, fill: string, options: BucketVisualRenderOptions): void {
  const graphics = node.getComponent(Graphics);
  if (graphics === null) {
    return;
  }
  const color = options.error ? ERROR_BODY_COLOR : options.disabled ? DISABLED_BODY_COLOR : colorFromHex(fill, 218);
  graphics.clear();
  graphics.fillColor = color;
  graphics.moveTo(-44, 32);
  graphics.lineTo(44, 32);
  graphics.lineTo(34, -38);
  graphics.quadraticCurveTo(0, -50, -34, -38);
  graphics.close();
  graphics.fill();
  graphics.strokeColor = new Color(106, 84, 54, options.disabled ? 120 : 210);
  graphics.lineWidth = 4;
  graphics.moveTo(-44, 32);
  graphics.lineTo(44, 32);
  graphics.lineTo(34, -38);
  graphics.quadraticCurveTo(0, -50, -34, -38);
  graphics.close();
  graphics.stroke();
  graphics.fillColor = new Color(255, 255, 255, 78);
  graphics.roundRect(-30, 10, 13, 42, 6);
  graphics.fill();
}

function drawRim(node: Node, fill: string): void {
  const graphics = node.getComponent(Graphics);
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = colorFromHex(fill, 235);
  graphics.ellipse(0, 0, COLOR_RIM_SIZE.width / 2, COLOR_RIM_SIZE.height / 2);
  graphics.fill();
  graphics.strokeColor = new Color(255, 248, 222, 190);
  graphics.lineWidth = 3;
  graphics.ellipse(0, 2, COLOR_RIM_SIZE.width / 2 - 4, COLOR_RIM_SIZE.height / 2 - 3);
  graphics.stroke();
}

function drawStateMark(node: Node, full: boolean, options: BucketVisualRenderOptions): void {
  const graphics = node.getComponent(Graphics);
  if (graphics === null) {
    return;
  }
  graphics.clear();
  if (!full && !options.selected && !options.mergeReady && !options.error && !options.disabled) {
    return;
  }
  if (full) {
    graphics.fillColor = new Color(255, 247, 222, 240);
    graphics.strokeColor = new Color(109, 82, 42, 220);
    graphics.lineWidth = 2;
    graphics.circle(0, 0, 11);
    graphics.fill();
    graphics.stroke();
    graphics.strokeColor = new Color(74, 142, 92, 255);
    graphics.lineWidth = 3;
    graphics.moveTo(-5, 0);
    graphics.lineTo(-1, 4);
    graphics.lineTo(6, -5);
    graphics.stroke();
    return;
  }
  if (options.mergeReady) {
    graphics.fillColor = new Color(255, 197, 72, 238);
    graphics.strokeColor = new Color(139, 86, 24, 230);
    graphics.lineWidth = 2;
    graphics.circle(0, 0, 10);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = new Color(255, 250, 218, 255);
    graphics.circle(-4, 0, 2.2);
    graphics.circle(0, 0, 2.2);
    graphics.circle(4, 0, 2.2);
    graphics.fill();
    return;
  }
  const fill = options.error
    ? new Color(255, 111, 97, 220)
    : options.disabled
      ? new Color(120, 120, 120, 150)
      : new Color(255, 247, 222, 180);
  graphics.fillColor = fill;
  graphics.roundRect(-27, -8, 54, 16, 8);
  graphics.fill();
  if (options.disabled) {
    graphics.strokeColor = new Color(74, 78, 78, 180);
    graphics.lineWidth = 2;
    graphics.moveTo(-16, -5);
    graphics.lineTo(16, 5);
    graphics.stroke();
  }
}

function colorFromHex(hex: string, alpha = 255): Color {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const value = Number.parseInt(normalized, 16);
  return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha);
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
