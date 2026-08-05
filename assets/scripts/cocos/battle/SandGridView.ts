import { _decorator, Color, Component, Graphics, Label, Mask, Node, Sprite, SpriteFrame, Texture2D, UITransform, Vec3 } from "cc";
import type { BattlePresentationEvent } from "./BattleViewContract";
import type { AbsorbAllocation } from "../../domain/battle/Settlement";
import type { GravityMoveTrace } from "../../domain/core/Gravity";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";
import {
  createSandCanvasRenderModel,
  findCanvasCell,
  getSandCanvasCellPixelPaint,
  getSandCanvasCellVariation,
  getSandCanvasPaletteEntry,
  summarizeAbsorption,
  type SandCanvasRenderModel,
} from "./SandCanvasModel";
import { PresentationGridBuffers } from "./GravityMotionModel";
import { BATTLE_PRESENTATION_CONFIG } from "./BattlePresentationConfig";

const { ccclass, property } = _decorator;

const TRAY_COLOR = new Color(244, 246, 242, 255);
const EMPTY_CELL_RGB = Object.freeze({ r: 216, g: 226, b: 220, a: 255 });
const EXPOSED_STROKE_COLOR = new Color(72, 167, 248, 230);
const ABSORB_TRAIL_COLOR = new Color(255, 255, 255, 210);
const FRAME_INNER_WIDTH = BATTLE_PRESENTATION_CONFIG.sandCanvasInnerWidth;
const FRAME_INNER_HEIGHT = BATTLE_PRESENTATION_CONFIG.sandCanvasInnerHeight;
const MAX_GRID_WIDTH = FRAME_INNER_WIDTH;
const MAX_GRID_HEIGHT = FRAME_INNER_HEIGHT;
const ABSORB_TRAIL_LIMIT = 48;

@ccclass("SandGridView")
export class SandGridView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property(Label)
  public detailLabel: Label | null = null;

  @property
  public debugLabelsEnabled = false;

  @property
  public presentationDebugLogging = BATTLE_PRESENTATION_CONFIG.presentationDebugLogging;

  private backgroundLayer: Node | null = null;
  private sandLayer: Node | null = null;
  private gravityOverlayLayer: Node | null = null;
  private feedbackLayer: Node | null = null;
  private viewport: Node | null = null;
  private currentModel: SandCanvasRenderModel | null = null;
  private currentGridSnapshot: SandGridSnapshot | null = null;
  private sandTexture: Texture2D | null = null;
  private sandSpriteFrame: SpriteFrame | null = null;
  private sandPixels: Uint8Array | null = null;
  private sandPixelWidth = 0;
  private sandPixelHeight = 0;
  private gravityTaskRevision = 0;
  private gravityTaskActive = false;
  private uploadCount = 0;
  private presentationGridUpdateCount = 0;
  private lastUploadMs = 0;
  private uploadIntervalTotalMs = 0;
  private uploadIntervalMaxMs = 0;
  private uploadIntervalSamples = 0;
  private pixelWriteTotalMs = 0;
  private uploadTotalMs = 0;
  private statsWindowStartMs = 0;
  private readonly presentationGrid = new PresentationGridBuffers();

  public renderSandGrid(grid: SandGridSnapshot): void {
    if (this.gravityTaskActive) {
      return;
    }
    this.renderSandGridInternal(grid);
  }

  private renderSandGridInternal(grid: SandGridSnapshot): void {
    this.hideDebugLabels();
    this.ensureLayers();
    this.unscheduleAllCallbacks();
    this.clearFeedback();
    this.currentModel = createSandCanvasRenderModel(grid, {
      maxWidth: MAX_GRID_WIDTH,
      maxHeight: MAX_GRID_HEIGHT,
      innerWidth: FRAME_INNER_WIDTH,
      innerHeight: FRAME_INNER_HEIGHT,
    });
    this.currentGridSnapshot = cloneGridSnapshot(grid);
    this.presentationGrid.reset(this.currentGridSnapshot);
    this.drawCanvas(this.currentModel);
  }

  public playFeedback(events: readonly BattlePresentationEvent[]): void {
    if (this.currentModel === null) {
      return;
    }

    for (const event of events) {
      if (event.type === "exposedSandHighlighted") {
        this.drawExposedHighlight(event.cells);
      } else if (event.type === "sandAbsorbed") {
        this.drawAbsorbFeedback(event.allocations);
      } else if (event.type === "sandGravitySettled") {
      } else if (event.type === "sandCanvasRedrawn") {
        this.renderSandGrid(event.grid);
      }
    }
  }

  public clear(): void {
    this.hideDebugLabels();
    this.ensureLayers();
    this.gravityTaskRevision += 1;
    this.gravityTaskActive = false;
    this.unscheduleAllCallbacks();
    this.currentModel = null;
    this.currentGridSnapshot = null;
    this.clearGraphics(this.backgroundLayer);
    this.clearGraphics(this.sandLayer);
    this.clearSprite(this.gravityOverlayLayer);
    this.clearFeedback();
  }

  private hideDebugLabels(): void {
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = this.debugLabelsEnabled;
      this.titleLabel.string = this.debugLabelsEnabled ? this.titleLabel.string : "";
    }
    if (this.detailLabel !== null) {
      this.detailLabel.node.active = this.debugLabelsEnabled;
      this.detailLabel.string = this.debugLabelsEnabled ? this.detailLabel.string : "";
    }
  }

  private ensureLayers(): void {
    if (this.viewport !== null && this.backgroundLayer !== null && this.sandLayer !== null && this.gravityOverlayLayer !== null && this.feedbackLayer !== null) {
      return;
    }

    this.viewport = this.ensureViewport();
    this.applyFrameGeometry();
    this.backgroundLayer = this.ensureGraphicsLayer("SandBackground", 0);
    this.sandLayer = this.ensureSpriteLayer("SandLayer", 1);
    this.gravityOverlayLayer = this.ensureSpriteLayer("GravityOverlay", 2);
    this.feedbackLayer = this.ensureGraphicsLayer("FeedbackLayer", 3);
    this.node.getChildByName("SandFrame")?.setSiblingIndex(10);
  }

  private ensureViewport(): Node {
    const existing = this.node.getChildByName("SandViewport");
    const viewport = existing ?? new Node("SandViewport");
    if (existing === null) {
      this.node.addChild(viewport);
    }
    viewport.active = true;
    viewport.setPosition(0, -10, 0);
    viewport.setSiblingIndex(0);
    (viewport.getComponent(UITransform) ?? viewport.addComponent(UITransform)).setContentSize(FRAME_INNER_WIDTH, FRAME_INNER_HEIGHT);
    const mask = viewport.getComponent(Mask) ?? viewport.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    return viewport;
  }

  public cancelFeedback(): void {
    this.unscheduleAllCallbacks();
    this.clearFeedback();
  }

  public getCellWorldPosition(cell: Pick<{ readonly x: number; readonly y: number; readonly index: number }, "x" | "y" | "index">): Vec3 | null {
    const model = this.currentModel;
    const viewport = this.viewport;
    const transform = viewport?.getComponent(UITransform) ?? null;
    if (model === null || viewport === null || transform === null) {
      return null;
    }
    const rect = findCanvasCell(model, cell);
    if (rect === null) {
      return null;
    }
    return transform.convertToWorldSpaceAR(new Vec3(rect.centerX, rect.centerY, 0));
  }

  public getCellWorldPositionByIndex(index: number): Vec3 | null {
    const snapshot = this.currentGridSnapshot;
    if (snapshot === null || index < 0 || index >= snapshot.cells.length) {
      return null;
    }
    return this.getCellWorldPosition({
      index,
      x: index % snapshot.width,
      y: Math.floor(index / snapshot.width),
    });
  }

  public clearAbsorbedCells(cells: readonly { readonly index: number; readonly x: number; readonly y: number }[]): void {
    const snapshot = this.currentGridSnapshot;
    if (snapshot === null || cells.length === 0) {
      return;
    }
    const nextCells = [...snapshot.cells];
    for (const cell of cells) {
      if (cell.index >= 0 && cell.index < nextCells.length) {
        nextCells[cell.index] = null;
      }
    }
    const nextSnapshot = cloneGridSnapshot({
      width: snapshot.width,
      height: snapshot.height,
      cells: nextCells,
    });
    this.currentGridSnapshot = nextSnapshot;
    this.applySimulationCellChanges(cells.map((cell) => cell.index), []);
  }

  public clearAbsorbedCellIndices(indices: readonly number[]): void {
    const snapshot = this.currentGridSnapshot;
    if (snapshot === null || indices.length === 0) {
      return;
    }
    void snapshot;
    this.applySimulationCellChanges(indices, []);
  }

  public beginSettlementTimeline(): number {
    const taskRevision = this.gravityTaskRevision + 1;
    this.gravityTaskRevision = taskRevision;
    this.gravityTaskActive = true;
    this.clearFeedback();
    this.clearSprite(this.gravityOverlayLayer);
    return taskRevision;
  }

  public isSettlementTimelineCurrent(revision: number): boolean {
    return revision === this.gravityTaskRevision;
  }

  public applyGravityIterations(movesByIteration: readonly (readonly GravityMoveTrace[])[]): void {
    if (this.currentGridSnapshot === null || movesByIteration.length === 0) {
      return;
    }
    this.applySimulationCellChanges([], movesByIteration);
  }

  public applySimulationCellChanges(
    absorbedCellIndices: readonly number[],
    movesByIteration: readonly (readonly GravityMoveTrace[])[],
    simulationTick: number | null = null,
  ): void {
    if (this.currentGridSnapshot === null) {
      return;
    }
    if (absorbedCellIndices.length === 0 && movesByIteration.length === 0) {
      return;
    }
    const dirtyIndices: number[] = [];
    for (const index of absorbedCellIndices) {
      dirtyIndices.push(index);
    }
    this.presentationGrid.clearCellIndices(absorbedCellIndices);
    for (const moves of movesByIteration) {
      for (const move of moves) {
        dirtyIndices.push(move.fromY * this.presentationGrid.width + move.fromX);
        dirtyIndices.push(move.toY * this.presentationGrid.width + move.toX);
      }
      this.presentationGrid.applyGravityIteration(moves);
    }
    this.currentGridSnapshot = this.presentationGrid.toSnapshot();
    this.presentationGridUpdateCount += 1;
    this.updateSandTextureDirtyCells(dirtyIndices, simulationTick);
  }

  public finishSettlementTimeline(finalGrid: SandGridSnapshot): void {
    this.gravityTaskActive = false;
    this.renderSandGridInternal(finalGrid);
  }

  public cancelGravityMotion(): void {
    this.gravityTaskRevision += 1;
    this.gravityTaskActive = false;
    this.unscheduleAllCallbacks();
    this.clearSprite(this.gravityOverlayLayer);
  }

  private ensureGraphicsLayer(name: string, siblingIndex: number): Node {
    const parent = this.viewport ?? this.ensureViewport();
    const existing = parent.getChildByName(name);
    const layer = existing ?? new Node(name);
    if (existing === null) {
      parent.addChild(layer);
    }
    layer.active = true;
    layer.setPosition(0, 0, 0);
    layer.setSiblingIndex(siblingIndex);
    layer.getComponent(UITransform) ?? layer.addComponent(UITransform);
    layer.getComponent(Graphics) ?? layer.addComponent(Graphics);
    return layer;
  }

  private ensureSpriteLayer(name: string, siblingIndex: number): Node {
    const parent = this.viewport ?? this.ensureViewport();
    const existing = parent.getChildByName(name);
    const layer = existing ?? new Node(name);
    if (existing === null) {
      parent.addChild(layer);
    }
    layer.active = true;
    layer.setPosition(0, 0, 0);
    layer.setSiblingIndex(siblingIndex);
    layer.getComponent(UITransform) ?? layer.addComponent(UITransform);
    layer.getComponent(Sprite) ?? layer.addComponent(Sprite);
    return layer;
  }

  private drawCanvas(model: SandCanvasRenderModel, cellValues: Int16Array | null = null): void {
    const background = this.backgroundLayer?.getComponent(Graphics) ?? null;
    const sand = this.sandLayer?.getComponent(Sprite) ?? null;
    if (background === null || sand === null) {
      return;
    }

    this.setLayerSize(model);
    background.clear();
    background.fillColor = TRAY_COLOR;
    background.roundRect(-model.innerWidth / 2, -model.innerHeight / 2, model.innerWidth, model.innerHeight, 12);
    background.fill();

    this.updateSandTexture(model, cellValues);
    sand.spriteFrame = this.sandSpriteFrame;
    sand.sizeMode = Sprite.SizeMode.CUSTOM;
  }

  private setLayerSize(model: SandCanvasRenderModel): void {
    for (const layer of [this.backgroundLayer, this.sandLayer, this.gravityOverlayLayer, this.feedbackLayer]) {
      layer?.getComponent(UITransform)?.setContentSize(model.innerWidth, model.innerHeight);
      layer?.setPosition(0, 0, 0);
    }
    this.sandLayer?.getComponent(UITransform)?.setContentSize(model.totalWidth, model.totalHeight);
    this.sandLayer?.setPosition(
      -model.innerWidth / 2 + model.offsetX + model.totalWidth / 2,
      model.innerHeight / 2 - model.offsetY - model.totalHeight / 2,
      0,
    );
  }

  private updateSandTexture(model: SandCanvasRenderModel, cellValues: Int16Array | null = null): void {
    const pixelWidth = model.totalWidth;
    const pixelHeight = model.totalHeight;
    const pixels = this.ensureSandPixels(pixelWidth, pixelHeight);
    const writeStartMs = nowMs();
    for (let index = 0; index < pixelWidth * pixelHeight; index += 1) {
      const offset = index * 4;
      pixels[offset] = EMPTY_CELL_RGB.r;
      pixels[offset + 1] = EMPTY_CELL_RGB.g;
      pixels[offset + 2] = EMPTY_CELL_RGB.b;
      pixels[offset + 3] = EMPTY_CELL_RGB.a;
    }
    for (const cell of model.cells) {
      const colorId = cellValues === null ? cell.colorId : cellValues[cell.index] || null;
      this.paintCellPixels(model, pixels, cell.index, colorId);
    }
    this.pixelWriteTotalMs += nowMs() - writeStartMs;

    if (this.sandTexture === null || this.sandTexture.width !== pixelWidth || this.sandTexture.height !== pixelHeight) {
      this.sandTexture?.destroy();
      this.sandSpriteFrame?.destroy();
      this.sandTexture = new Texture2D("SandCanvasTexture");
      this.sandTexture.create(pixelWidth, pixelHeight, Texture2D.PixelFormat.RGBA8888);
      this.sandTexture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
      this.sandSpriteFrame = new SpriteFrame();
      this.sandSpriteFrame.texture = this.sandTexture;
    }
    this.uploadPixels(pixels, null);
  }

  private updateSandTextureDirtyCells(dirtyIndices: readonly number[], simulationTick: number | null): void {
    const model = this.currentModel;
    const pixels = this.sandPixels;
    if (model === null || pixels === null || this.sandTexture === null || dirtyIndices.length === 0) {
      return;
    }
    const writeStartMs = nowMs();
    const painted = new Set<number>();
    for (const index of dirtyIndices) {
      if (painted.has(index)) {
        continue;
      }
      painted.add(index);
      this.paintCellPixels(model, pixels, index, this.presentationGrid.valueAtIndex(index) || null);
    }
    this.pixelWriteTotalMs += nowMs() - writeStartMs;
    this.uploadPixels(pixels, simulationTick);
  }

  private paintCellPixels(
    model: SandCanvasRenderModel,
    pixels: Uint8Array,
    cellIndex: number,
    colorId: number | null,
  ): void {
    const cell = model.cells[cellIndex];
    if (cell === undefined) {
      return;
    }
    const left = cell.x * model.cellSize;
    const top = cell.y * model.cellSize;
    const color = colorId === null ? null : colorFromHexToBytes(getSandCanvasPaletteEntry(colorId).fill, cell.x, cell.y);
    for (let yy = 0; yy < model.cellSize; yy += 1) {
      for (let xx = 0; xx < model.cellSize; xx += 1) {
        const offset = ((top + yy) * model.totalWidth + left + xx) * 4;
        if (color === null) {
          pixels[offset] = EMPTY_CELL_RGB.r;
          pixels[offset + 1] = EMPTY_CELL_RGB.g;
          pixels[offset + 2] = EMPTY_CELL_RGB.b;
          pixels[offset + 3] = EMPTY_CELL_RGB.a;
          continue;
        }
        const paint = getSandCanvasCellPixelPaint(cell.x, cell.y, xx, yy);
        pixels[offset] = clampByte(color.r + paint.brightnessDelta);
        pixels[offset + 1] = clampByte(color.g + paint.brightnessDelta);
        pixels[offset + 2] = clampByte(color.b + paint.brightnessDelta);
        pixels[offset + 3] = paint.alpha;
      }
    }
  }

  private uploadPixels(pixels: Uint8Array, simulationTick: number | null): void {
    if (this.sandTexture === null) {
      return;
    }
    const uploadStartMs = nowMs();
    this.sandTexture.uploadData(pixels);
    const uploadEndMs = nowMs();
    this.recordUploadStats(uploadStartMs, uploadEndMs, simulationTick);
  }

  private recordUploadStats(uploadStartMs: number, uploadEndMs: number, simulationTick: number | null): void {
    this.uploadCount += 1;
    this.uploadTotalMs += uploadEndMs - uploadStartMs;
    if (this.statsWindowStartMs <= 0) {
      this.statsWindowStartMs = uploadEndMs;
    }
    if (this.lastUploadMs > 0) {
      const interval = uploadStartMs - this.lastUploadMs;
      this.uploadIntervalTotalMs += interval;
      this.uploadIntervalMaxMs = Math.max(this.uploadIntervalMaxMs, interval);
      this.uploadIntervalSamples += 1;
    }
    this.lastUploadMs = uploadStartMs;
    if (!this.presentationDebugLogging) {
      return;
    }
    const windowMs = Math.max(1, uploadEndMs - this.statsWindowStartMs);
    if (windowMs >= 1000) {
      const uploadsPerSecond = this.uploadCount / (windowMs / 1000);
      const averageInterval = this.uploadIntervalSamples === 0 ? 0 : this.uploadIntervalTotalMs / this.uploadIntervalSamples;
      console.log(
        `[SandGridView] uploads=${uploadsPerSecond.toFixed(1)}/s avgInterval=${averageInterval.toFixed(1)}ms ` +
        `maxInterval=${this.uploadIntervalMaxMs.toFixed(1)}ms gridUpdates=${this.presentationGridUpdateCount} ` +
        `pixelWrite=${this.pixelWriteTotalMs.toFixed(2)}ms upload=${this.uploadTotalMs.toFixed(2)}ms tick=${simulationTick ?? "snapshot"}`,
      );
      this.uploadCount = 0;
      this.presentationGridUpdateCount = 0;
      this.uploadIntervalTotalMs = 0;
      this.uploadIntervalMaxMs = 0;
      this.uploadIntervalSamples = 0;
      this.pixelWriteTotalMs = 0;
      this.uploadTotalMs = 0;
      this.statsWindowStartMs = uploadEndMs;
    }
  }

  private drawExposedHighlight(cells: readonly { readonly x: number; readonly y: number; readonly index: number }[]): void {
    const graphics = this.feedbackLayer?.getComponent(Graphics) ?? null;
    const model = this.currentModel;
    if (graphics === null || model === null || cells.length === 0) {
      return;
    }

    graphics.clear();
    graphics.lineWidth = Math.max(2, model.cellSize * 0.12);
    for (const cell of cells) {
      const rect = findCanvasCell(model, cell);
      if (rect === null || rect.colorId === null) {
        continue;
      }
      const palette = getSandCanvasPaletteEntry(rect.colorId);
      graphics.fillColor = colorFromHex(palette.highlight, 74);
      graphics.strokeColor = colorFromHex(palette.highlight, 236);
      const size = rect.size + Math.max(2, model.cellSize * 0.16);
      graphics.roundRect(rect.centerX - size / 2, rect.centerY - size / 2, size, size, Math.max(2, size * 0.18));
      graphics.fill();
      graphics.stroke();
    }
    this.scheduleFeedbackClear(0.18);
  }

  private drawAbsorbFeedback(allocations: readonly AbsorbAllocation[]): void {
    const graphics = this.feedbackLayer?.getComponent(Graphics) ?? null;
    const model = this.currentModel;
    if (graphics === null || model === null || allocations.length === 0) {
      return;
    }

    const summary = summarizeAbsorption(allocations);
    if (summary.absorbedCount === 0) {
      return;
    }

    graphics.clear();
    graphics.strokeColor = ABSORB_TRAIL_COLOR;
    graphics.lineWidth = Math.max(2, model.cellSize * 0.16);
    const target = new Vec3(0, -model.totalHeight / 2 - 70, 0);
    for (const cell of summary.sourceCells.slice(0, ABSORB_TRAIL_LIMIT)) {
      const rect = findCanvasCell(model, cell);
      if (rect === null) {
        continue;
      }
      graphics.moveTo(rect.centerX, rect.centerY);
      graphics.quadraticCurveTo(rect.centerX * 0.35, rect.centerY - 44, target.x, target.y);
      graphics.stroke();
    }
    this.scheduleFeedbackClear(0.32);
  }

  private ensureSandPixels(pixelWidth: number, pixelHeight: number): Uint8Array {
    if (
      this.sandPixels === null ||
      this.sandPixelWidth !== pixelWidth ||
      this.sandPixelHeight !== pixelHeight
    ) {
      this.sandPixelWidth = pixelWidth;
      this.sandPixelHeight = pixelHeight;
      this.sandPixels = new Uint8Array(pixelWidth * pixelHeight * 4);
    }
    return this.sandPixels;
  }

  private scheduleFeedbackClear(delay: number): void {
    this.scheduleOnce(() => this.clearFeedback(), delay);
  }

  private clearFeedback(): void {
    this.clearGraphics(this.feedbackLayer);
  }

  private clearGraphics(layer: Node | null): void {
    layer?.getComponent(Graphics)?.clear();
  }

  private clearSprite(layer: Node | null): void {
    const sprite = layer?.getComponent(Sprite) ?? null;
    if (sprite !== null) {
      sprite.spriteFrame = null;
    }
  }

  private applyFrameGeometry(): void {
    this.node.getComponent(UITransform)?.setContentSize(660, 660);
    const frame = this.node.getChildByName("SandFrame");
    frame?.setPosition(0, -10, 0);
    frame?.getComponent(UITransform)?.setContentSize(620, 620);
  }
}

function colorFromHexToBytes(hex: string, x: number, y: number): Readonly<{ r: number; g: number; b: number; a: number }> {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const value = Number.parseInt(normalized, 16);
  const variation = getSandCanvasCellVariation(x, y);
  return Object.freeze({
    r: clampByte(((value >> 16) & 255) + variation),
    g: clampByte(((value >> 8) & 255) + variation),
    b: clampByte((value & 255) + variation),
    a: 255,
  });
}

function colorFromHex(hex: string, alpha = 255): Color {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const value = Number.parseInt(normalized, 16);
  return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function cloneGridSnapshot(grid: SandGridSnapshot): SandGridSnapshot {
  return Object.freeze({
    width: grid.width,
    height: grid.height,
    cells: Object.freeze([...grid.cells]),
  });
}

function nowMs(): number {
  return Date.now();
}
