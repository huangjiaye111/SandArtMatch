import { _decorator, Color, Component, Label } from "cc";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";

const { ccclass, property } = _decorator;

const TEXT_COLOR = new Color(38, 48, 45, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 220);
const SHADOW_COLOR = new Color(38, 48, 45, 80);

@ccclass("SandGridView")
export class SandGridView extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property(Label)
  public detailLabel: Label | null = null;

  public renderSandGrid(grid: SandGridSnapshot): void {
    const sandCount = grid.cells.filter((cell) => cell !== null).length;
    if (this.titleLabel !== null) {
      this.titleLabel.string = "Sand Area";
      styleLabel(this.titleLabel, 28, 34);
    }
    if (this.detailLabel !== null) {
      this.detailLabel.string = `${grid.width} x ${grid.height} / ${sandCount} sand\n${formatGridRows(grid)}`;
      styleLabel(this.detailLabel, 22, 27);
    }
  }

  public clear(): void {
    if (this.titleLabel !== null) {
      this.titleLabel.string = "Sand Area";
      styleLabel(this.titleLabel, 28, 34);
    }
    if (this.detailLabel !== null) {
      this.detailLabel.string = "";
      styleLabel(this.detailLabel, 22, 27);
    }
  }
}

function styleLabel(label: Label, fontSize: number, lineHeight: number): void {
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

function formatGridRows(grid: SandGridSnapshot): string {
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < grid.width; x += 1) {
      const cell = grid.cells[y * grid.width + x];
      row.push(cell === null ? "." : String(cell));
    }
    rows.push(row.join(" "));
  }
  return rows.join("\n");
}
