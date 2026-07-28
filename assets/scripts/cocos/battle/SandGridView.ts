import { _decorator, Component, Label } from "cc";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";

const { ccclass, property } = _decorator;

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
    }
    if (this.detailLabel !== null) {
      this.detailLabel.string = `${grid.width} x ${grid.height} / ${sandCount} sand\n${formatGridRows(grid)}`;
    }
  }

  public clear(): void {
    if (this.titleLabel !== null) {
      this.titleLabel.string = "Sand Area";
    }
    if (this.detailLabel !== null) {
      this.detailLabel.string = "";
    }
  }
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
