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
      this.detailLabel.string = `${grid.width} x ${grid.height} / ${sandCount} sand`;
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
