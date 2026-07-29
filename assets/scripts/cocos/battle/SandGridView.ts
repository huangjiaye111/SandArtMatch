import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from "cc";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";

const { ccclass, property } = _decorator;

const EMPTY_CELL_COLOR = new Color(231, 235, 227, 255);
const EMPTY_CELL_STROKE_COLOR = new Color(184, 192, 186, 210);
const CELL_GAP = 4;
const MAX_GRID_WIDTH = 520;
const MAX_GRID_HEIGHT = 360;

const COLOR_TINTS: Record<number, Color> = {
  1: new Color(242, 124, 138, 255),
  2: new Color(77, 182, 232, 255),
  3: new Color(246, 216, 74, 255),
  4: new Color(88, 200, 137, 255),
  5: new Color(155, 123, 234, 255),
  6: new Color(244, 154, 63, 255),
  7: new Color(217, 76, 100, 255),
  8: new Color(110, 207, 201, 255),
  9: new Color(88, 105, 216, 255),
  10: new Color(242, 232, 201, 255),
  11: new Color(154, 106, 69, 255),
  12: new Color(70, 80, 90, 255),
};

@ccclass("SandGridView")
export class SandGridView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property(Label)
  public detailLabel: Label | null = null;

  private readonly cellNodes: Node[] = [];
  private cellLayer: Node | null = null;

  public renderSandGrid(grid: SandGridSnapshot): void {
    this.hideDebugLabels();
    this.ensureCellLayer();
    this.ensureCellCount(grid.cells.length);
    this.layoutCells(grid);
  }

  public clear(): void {
    this.hideDebugLabels();
    this.ensureCellLayer();
    for (const cellNode of this.cellNodes) {
      cellNode.active = false;
    }
  }

  private hideDebugLabels(): void {
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = false;
      this.titleLabel.string = "";
    }
    if (this.detailLabel !== null) {
      this.detailLabel.node.active = false;
      this.detailLabel.string = "";
    }
  }

  private ensureCellLayer(): void {
    if (this.cellLayer !== null && this.cellLayer.isValid) {
      return;
    }

    const existingLayer = this.node.getChildByName("SandCellLayer");
    this.cellLayer = existingLayer ?? new Node("SandCellLayer");
    if (existingLayer === null) {
      this.node.addChild(this.cellLayer);
    }
    this.cellLayer.setPosition(0, -10, 0);
    this.cellLayer.getComponent(UITransform) ?? this.cellLayer.addComponent(UITransform);
  }

  private ensureCellCount(count: number): void {
    while (this.cellNodes.length < count) {
      const cellNode = new Node(`SandCell${String(this.cellNodes.length + 1).padStart(2, "0")}`);
      cellNode.addComponent(UITransform);
      cellNode.addComponent(Graphics);
      this.cellLayer?.addChild(cellNode);
      this.cellNodes.push(cellNode);
    }
  }

  private layoutCells(grid: SandGridSnapshot): void {
    if (grid.width <= 0 || grid.height <= 0) {
      return;
    }

    const cellSize = Math.floor(
      Math.min(
        (MAX_GRID_WIDTH - CELL_GAP * (grid.width - 1)) / grid.width,
        (MAX_GRID_HEIGHT - CELL_GAP * (grid.height - 1)) / grid.height,
      ),
    );
    const totalWidth = grid.width * cellSize + (grid.width - 1) * CELL_GAP;
    const totalHeight = grid.height * cellSize + (grid.height - 1) * CELL_GAP;
    this.cellLayer?.getComponent(UITransform)?.setContentSize(totalWidth, totalHeight);

    for (let index = 0; index < this.cellNodes.length; index += 1) {
      const cellNode = this.cellNodes[index];
      if (index >= grid.cells.length) {
        cellNode.active = false;
        continue;
      }

      const x = index % grid.width;
      const y = Math.floor(index / grid.width);
      cellNode.active = true;
      cellNode.setPosition(
        -totalWidth / 2 + cellSize / 2 + x * (cellSize + CELL_GAP),
        totalHeight / 2 - cellSize / 2 - y * (cellSize + CELL_GAP),
        0,
      );
      cellNode.getComponent(UITransform)?.setContentSize(cellSize, cellSize);
      drawCell(cellNode.getComponent(Graphics), grid.cells[index], cellSize);
    }
  }
}

function drawCell(graphics: Graphics | null, colorId: number | null, size: number): void {
  if (graphics === null) {
    return;
  }

  graphics.clear();
  const halfSize = size / 2;
  graphics.fillColor = colorId === null ? EMPTY_CELL_COLOR : COLOR_TINTS[colorId] ?? new Color(230, 230, 230, 255);
  graphics.roundRect(-halfSize, -halfSize, size, size, Math.max(6, size * 0.12));
  graphics.fill();

  graphics.strokeColor = colorId === null ? EMPTY_CELL_STROKE_COLOR : getHighlightColor(colorId);
  graphics.lineWidth = colorId === null ? 2 : 3;
  graphics.roundRect(-halfSize + 1, -halfSize + 1, size - 2, size - 2, Math.max(6, size * 0.12));
  graphics.stroke();

  if (colorId !== null) {
    graphics.fillColor = getHighlightColor(colorId);
    graphics.roundRect(-halfSize + 6, halfSize - size * 0.25, size - 12, Math.max(3, size * 0.08), 4);
    graphics.fill();
  }
}

function getHighlightColor(colorId: number | null): Color {
  switch (colorId) {
    case 1:
      return new Color(255, 164, 173, 230);
    case 2:
      return new Color(130, 210, 255, 230);
    case 3:
      return new Color(255, 233, 120, 230);
    case 4:
      return new Color(139, 227, 176, 230);
    case 5:
      return new Color(188, 167, 255, 230);
    case 6:
      return new Color(255, 192, 113, 230);
    default:
      return new Color(255, 255, 255, 210);
  }
}
