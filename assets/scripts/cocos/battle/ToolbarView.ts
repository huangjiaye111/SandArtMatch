import { _decorator, Button, Component, Label, Node } from "cc";
import type { BattleUiActions } from "./BattleViewContract";

const { ccclass, property } = _decorator;

@ccclass("ToolbarView")
export class ToolbarView extends Component {
  @property(Label)
  public levelLabel: Label | null = null;

  @property(Button)
  public undoButton: Button | null = null;

  @property(Button)
  public settingsButton: Button | null = null;

  @property(Node)
  public resultRoot: Node | null = null;

  @property(Label)
  public resultLabel: Label | null = null;

  private actions: BattleUiActions | null = null;
  private undoHandler: (() => void) | null = null;
  private settingsHandler: (() => void) | null = null;

  public setActions(actions: BattleUiActions): void {
    this.actions = actions;
    this.rebindButtons();
  }

  public setLevelText(text: string): void {
    if (this.levelLabel !== null) {
      this.levelLabel.string = text;
    }
  }

  public setUndoEnabled(enabled: boolean): void {
    if (this.undoButton !== null) {
      this.undoButton.interactable = enabled;
    }
  }

  public showWin(): void {
    this.setResult("Win");
  }

  public showLose(reason?: string): void {
    this.setResult(reason === undefined || reason.length === 0 ? "Lose" : `Lose: ${reason}`);
  }

  public showFeedback(message: string): void {
    if (this.levelLabel !== null) {
      this.levelLabel.string = message.length === 0 ? "Ready" : message;
    }
  }

  public hideResult(): void {
    if (this.resultRoot !== null) {
      this.resultRoot.active = false;
    }
    if (this.resultLabel !== null) {
      this.resultLabel.string = "";
    }
  }

  public clear(): void {
    this.setLevelText("Level 1");
    this.setUndoEnabled(true);
    this.hideResult();
  }

  protected onDestroy(): void {
    this.clearButtonHandlers();
  }

  private rebindButtons(): void {
    this.clearButtonHandlers();
    if (this.undoButton !== null) {
      this.undoHandler = () => this.actions?.undo();
      this.undoButton.node.on(Button.EventType.CLICK, this.undoHandler, this);
    }

    if (this.settingsButton !== null) {
      this.settingsHandler = () => undefined;
      this.settingsButton.node.on(Button.EventType.CLICK, this.settingsHandler, this);
    }
  }

  private clearButtonHandlers(): void {
    if (this.undoButton !== null && this.undoHandler !== null) {
      this.undoButton.node.off(Button.EventType.CLICK, this.undoHandler, this);
    }
    if (this.settingsButton !== null && this.settingsHandler !== null) {
      this.settingsButton.node.off(Button.EventType.CLICK, this.settingsHandler, this);
    }
    this.undoHandler = null;
    this.settingsHandler = null;
  }

  private setResult(text: string): void {
    if (this.resultRoot !== null) {
      this.resultRoot.active = true;
    }
    if (this.resultLabel !== null) {
      this.resultLabel.string = text;
    }
  }
}
