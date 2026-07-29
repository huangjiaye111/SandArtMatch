import { _decorator, Button, Color, Component, Label, Node, UITransform } from "cc";
import type { BattleUiActions } from "./BattleViewContract";

const { ccclass, property } = _decorator;

const TEXT_COLOR = new Color(38, 48, 45, 255);
const BUTTON_TEXT_COLOR = new Color(255, 255, 255, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 210);
const BUTTON_OUTLINE_COLOR = new Color(38, 48, 45, 135);
const SHADOW_COLOR = new Color(38, 48, 45, 90);

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
    this.applyToolbarLayout();
    this.rebindButtons();
  }

  public clearActions(): void {
    this.actions = null;
    this.clearButtonHandlers();
    this.setUndoEnabled(false);
  }

  public setLevelText(text: string): void {
    if (this.levelLabel !== null) {
      this.levelLabel.string = text;
      styleLabel(this.levelLabel, 26, 32, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  public setUndoEnabled(enabled: boolean): void {
    this.applyToolbarLayout();
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
    this.setResultIcon("win");
    if (this.resultLabel !== null) {
      this.resultLabel.string = "";
      styleLabel(this.resultLabel, 42, 50, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  public clear(): void {
    this.applyToolbarLayout();
    this.setLevelText("Level 1");
    this.setUndoEnabled(true);
    this.hideResult();
  }

  protected onDestroy(): void {
    this.clearActions();
  }

  private rebindButtons(): void {
    this.applyToolbarLayout();
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
    this.setResultIcon(text === "Win" ? "win" : "deadlock");
    if (this.resultLabel !== null) {
      this.resultLabel.string = text;
      styleLabel(this.resultLabel, 42, 50, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  private applyToolbarLayout(): void {
    this.levelLabel?.node.setPosition(-245, 0, 0);
    this.undoButton?.node.setPosition(82, 0, 0);
    this.settingsButton?.node.setPosition(234, 0, 0);
    styleUtilityButton(this.undoButton, "Undo");
    styleUtilityButton(this.settingsButton, "Settings");
    if (this.levelLabel !== null) {
      setContentSize(this.levelLabel.node, 160, 46);
      styleLabel(this.levelLabel, 26, 32, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  private setResultIcon(state: "win" | "deadlock"): void {
    const iconRoot = this.resultRoot?.getChildByName("ResultIcon") ?? null;
    const victoryIcon = iconRoot?.getChildByName("VictoryIcon") ?? null;
    const deadlockIcon = iconRoot?.getChildByName("DeadlockIcon") ?? null;
    if (victoryIcon !== null) {
      victoryIcon.active = state === "win";
    }
    if (deadlockIcon !== null) {
      deadlockIcon.active = state === "deadlock";
    }
  }
}

function styleUtilityButton(button: Button | null, fallbackText: string): void {
  if (button === null) {
    return;
  }
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.95;
  const width = fallbackText === "Settings" ? 142 : 132;
  setContentSize(button.node, width, 68);

  const background = button.node.getChildByName("Background");
  setContentSize(background ?? null, width, 68);

  const icon = button.node.getChildByName("Icon");
  if (icon !== null) {
    setContentSize(icon, 28, 28);
    icon.setPosition(-42, 1, 0);
  }

  const label = button.node.getChildByName("Label")?.getComponent(Label) ?? null;
  if (label !== null) {
    label.string = label.string.length === 0 ? fallbackText : label.string;
    label.node.setPosition(18, 0, 0);
    setContentSize(label.node, fallbackText === "Settings" ? 104 : 88, 36);
    styleLabel(label, fallbackText === "Settings" ? 22 : 24, 30, BUTTON_TEXT_COLOR, BUTTON_OUTLINE_COLOR);
  }
}

function setContentSize(node: Node | null, width: number, height: number): void {
  node?.getComponent(UITransform)?.setContentSize(width, height);
}

function styleLabel(label: Label, fontSize: number, lineHeight: number, color: Color, outlineColor: Color): void {
  label.color = color;
  label.fontSize = fontSize;
  label.lineHeight = lineHeight;
  label.enableOutline = true;
  label.outlineColor = outlineColor;
  label.outlineWidth = 2;
  label.enableShadow = true;
  label.shadowColor = SHADOW_COLOR;
  label.shadowOffset.set(1, -1);
  label.shadowBlur = 1;
}
