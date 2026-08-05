import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import type { BattlePresentationEvent } from "./BattleViewContract";
import type { BattleUiActions } from "./BattleViewContract";

const { ccclass, property } = _decorator;

const TEXT_COLOR = new Color(38, 48, 45, 255);
const BUTTON_TEXT_COLOR = new Color(255, 255, 255, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 210);
const BUTTON_OUTLINE_COLOR = new Color(38, 48, 45, 135);
const SHADOW_COLOR = new Color(38, 48, 45, 90);
const UTILITY_NORMAL_COLOR = new Color(47, 183, 164, 255);
const UTILITY_PRESSED_COLOR = new Color(34, 141, 130, 255);

@ccclass("ToolbarView")
export class ToolbarView extends Component {
  @property(Label)
  public levelLabel: Label | null = null;

  @property(Button)
  public settingsButton: Button | null = null;

  @property(Button)
  public homeButton: Button | null = null;

  @property(Node)
  public resultRoot: Node | null = null;

  @property(Label)
  public resultLabel: Label | null = null;

  private actions: BattleUiActions | null = null;
  private settingsHandler: (() => void) | null = null;
  private toolbarHomeHandler: (() => void) | null = null;
  private restartHandler: (() => void) | null = null;
  private nextHandler: (() => void) | null = null;
  private homeHandler: (() => void) | null = null;

  public setActions(actions: BattleUiActions): void {
    this.actions = actions;
    this.applyToolbarLayout();
    this.ensureToolbarHomeButton();
    this.ensureResultRestartButton();
    this.ensureResultNextButton();
    this.ensureResultHomeButton();
    this.rebindButtons();
  }

  public clearActions(): void {
    this.actions = null;
    this.unscheduleAllCallbacks();
    this.clearButtonHandlers();
  }

  public setLevelText(text: string): void {
    if (this.levelLabel !== null) {
      this.levelLabel.string = text;
      styleLabel(this.levelLabel, 26, 32, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  public showWin(canStartNext = false): void {
    this.setResult("Victory!", "win");
    this.setNextVisible(canStartNext);
  }

  public showLose(reason?: string): void {
    this.setResult(reason === undefined || reason.length === 0 ? "没有可吸收或可合并的操作" : reason, "deadlock");
    this.setNextVisible(false);
  }

  public showFeedback(message: string): void {
    if (this.levelLabel !== null) {
      this.levelLabel.string = message.length === 0 ? "Ready" : message;
    }
  }

  public playFeedback(events: readonly BattlePresentationEvent[]): void {
    for (const event of events) {
      if (event.type === "invalidClick") {
        this.showFeedback(event.message);
      } else if (event.type === "victory") {
        this.flashResultPanel();
      } else if (event.type === "deadlock") {
        this.flashResultPanel();
      }
    }
  }

  public hideResult(): void {
    if (this.resultRoot !== null) {
      this.resultRoot.active = false;
    }
    this.setNextVisible(false);
    this.setResultIcon("win");
    if (this.resultLabel !== null) {
      this.resultLabel.string = "";
      styleLabel(this.resultLabel, 42, 50, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  public clear(): void {
    this.applyToolbarLayout();
    this.setLevelText("Level 1");
    this.hideResult();
  }

  protected onDestroy(): void {
    this.clearActions();
  }

  private rebindButtons(): void {
    this.applyToolbarLayout();
    this.ensureToolbarHomeButton();
    this.ensureResultRestartButton();
    this.ensureResultNextButton();
    this.ensureResultHomeButton();
    this.clearButtonHandlers();
    const settingsButton = this.getSettingsButton();
    if (settingsButton !== null) {
      this.settingsHandler = () => {
        this.flashButton(settingsButton, "pressed");
        this.showFeedback("Settings");
      };
      settingsButton.node.on(Button.EventType.CLICK, this.settingsHandler, this);
    }
    const toolbarHomeButton = this.getToolbarHomeButton();
    if (toolbarHomeButton !== null) {
      this.toolbarHomeHandler = () => {
        this.flashButton(toolbarHomeButton, "pressed", "Home");
        this.actions?.home();
      };
      toolbarHomeButton.node.on(Button.EventType.CLICK, this.toolbarHomeHandler, this);
    }
    const restartButton = this.getRestartButton();
    if (restartButton !== null) {
      this.restartHandler = () => {
        this.flashButton(restartButton, "pressed", "Replay");
        this.actions?.restart();
      };
      restartButton.node.on(Button.EventType.CLICK, this.restartHandler, this);
    }
    const nextButton = this.getNextButton();
    if (nextButton !== null) {
      this.nextHandler = () => {
        this.flashButton(nextButton, "pressed", "Next");
        this.actions?.next();
      };
      nextButton.node.on(Button.EventType.CLICK, this.nextHandler, this);
    }
    const homeButton = this.getHomeButton();
    if (homeButton !== null) {
      this.homeHandler = () => {
        this.flashButton(homeButton, "pressed", "Home");
        this.actions?.home();
      };
      homeButton.node.on(Button.EventType.CLICK, this.homeHandler, this);
    }
  }

  private clearButtonHandlers(): void {
    this.removeButtonHandler(this.getSettingsButton(), this.settingsHandler);
    this.removeButtonHandler(this.getToolbarHomeButton(), this.toolbarHomeHandler);
    this.removeButtonHandler(this.getRestartButton(), this.restartHandler);
    this.removeButtonHandler(this.getNextButton(), this.nextHandler);
    this.removeButtonHandler(this.getHomeButton(), this.homeHandler);
    this.settingsHandler = null;
    this.toolbarHomeHandler = null;
    this.restartHandler = null;
    this.nextHandler = null;
    this.homeHandler = null;
  }

  private removeButtonHandler(button: Button | null, handler: (() => void) | null): void {
    const node = button?.node ?? null;
    if (button?.isValid === true && node?.isValid === true && handler !== null) {
      node.off(Button.EventType.CLICK, handler, this);
    }
  }

  private setResult(text: string, icon: "win" | "deadlock"): void {
    if (this.resultRoot !== null) {
      this.resultRoot.active = true;
      this.resultRoot.setScale(0.96, 0.96, 1);
      this.scheduleOnce(() => {
        if (this.isValid && this.resultRoot !== null && this.resultRoot.isValid) {
          this.resultRoot.setScale(1, 1, 1);
        }
      }, 0.08);
    }
    this.setResultIcon(icon);
    if (this.resultLabel !== null) {
      this.resultLabel.string = text;
      styleLabel(this.resultLabel, 42, 50, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  private applyToolbarLayout(): void {
    const settingsButton = this.getSettingsButton();
    this.levelLabel?.node.setPosition(-245, 0, 0);
    settingsButton?.node.setPosition(234, 0, 0);
    styleUtilityButton(settingsButton, "Settings");
    const toolbarHomeButton = this.getToolbarHomeButton();
    toolbarHomeButton?.node.setPosition(112, 0, 0);
    styleUtilityButton(toolbarHomeButton, "Home");
    const restartButton = this.getRestartButton();
    if (restartButton !== null) {
      restartButton.node.setPosition(0, -120, 0);
      styleUtilityButton(restartButton, "Replay");
    }
    const nextButton = this.getNextButton();
    if (nextButton !== null) {
      nextButton.node.setPosition(-100, -120, 0);
      styleUtilityButton(nextButton, "Next");
    }
    const homeButton = this.getHomeButton();
    if (homeButton !== null) {
      homeButton.node.setPosition(100, -120, 0);
      styleUtilityButton(homeButton, "Home");
    }
    if (this.levelLabel !== null) {
      setContentSize(this.levelLabel.node, 160, 46);
      styleLabel(this.levelLabel, 26, 32, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
  }

  private getSettingsButton(): Button | null {
    if (this.settingsButton !== null) {
      return this.settingsButton;
    }
    return this.node.getChildByName("SettingsButton")?.getComponent(Button) ?? null;
  }

  private getToolbarHomeButton(): Button | null {
    if (this.homeButton !== null) {
      return this.homeButton;
    }
    return this.node.getChildByName("HomeButton")?.getComponent(Button) ?? null;
  }

  private ensureToolbarHomeButton(): Button | null {
    const existing = this.getToolbarHomeButton();
    if (existing !== null) {
      return existing;
    }
    const buttonNode = createResultButtonNode("HomeButton");
    this.node.addChild(buttonNode);
    return buttonNode.getComponent(Button);
  }

  private getRestartButton(): Button | null {
    if (this.resultRoot === null || !this.resultRoot.isValid) {
      return null;
    }
    return this.resultRoot.getChildByName("RestartButton")?.getComponent(Button) ?? null;
  }

  private getNextButton(): Button | null {
    if (this.resultRoot === null || !this.resultRoot.isValid) {
      return null;
    }
    return this.resultRoot.getChildByName("NextButton")?.getComponent(Button) ?? null;
  }

  private getHomeButton(): Button | null {
    if (this.resultRoot === null || !this.resultRoot.isValid) {
      return null;
    }
    return this.resultRoot.getChildByName("HomeButton")?.getComponent(Button) ?? null;
  }

  private ensureResultRestartButton(): Button | null {
    if (this.resultRoot === null) {
      return null;
    }
    const existing = this.getRestartButton();
    if (existing !== null) {
      this.ensureRestartButtonLayout(existing);
      return existing;
    }
    const buttonNode = createResultButtonNode("RestartButton");
    this.resultRoot.addChild(buttonNode);
    this.ensureRestartButtonLayout(buttonNode.getComponent(Button));
    return buttonNode.getComponent(Button);
  }

  private ensureResultNextButton(): Button | null {
    if (this.resultRoot === null) {
      return null;
    }
    const existing = this.getNextButton();
    if (existing !== null) {
      this.ensureResultButtonLayout(existing, "Next");
      return existing;
    }
    const buttonNode = createResultButtonNode("NextButton");
    this.resultRoot.addChild(buttonNode);
    this.ensureResultButtonLayout(buttonNode.getComponent(Button), "Next");
    return buttonNode.getComponent(Button);
  }

  private ensureResultHomeButton(): Button | null {
    if (this.resultRoot === null) {
      return null;
    }
    const existing = this.getHomeButton();
    if (existing !== null) {
      this.ensureResultButtonLayout(existing, "Home");
      return existing;
    }
    const buttonNode = createResultButtonNode("HomeButton");
    this.resultRoot.addChild(buttonNode);
    this.ensureResultButtonLayout(buttonNode.getComponent(Button), "Home");
    return buttonNode.getComponent(Button);
  }

  private ensureRestartButtonLayout(button: Button | null): void {
    this.ensureResultButtonLayout(button, "Replay");
  }

  private ensureResultButtonLayout(button: Button | null, labelText: string): void {
    if (button === null) {
      return;
    }
    const node = button.node;
    setContentSize(node, 156, 60);
    const background = node.getChildByName("Background") ?? null;
    if (background !== null) {
      setContentSize(background, 156, 60);
    } else if (node.getComponent(Sprite) !== null) {
      setContentSize(node, 156, 60);
    }
    const label = node.getChildByName("Label")?.getComponent(Label) ?? null;
    if (label !== null) {
      label.string = labelText;
      label.node.setPosition(0, 0, 0);
      setContentSize(label.node, 120, 32);
      styleLabel(label, 24, 30, BUTTON_TEXT_COLOR, BUTTON_OUTLINE_COLOR);
    }
  }

  private setNextVisible(visible: boolean): void {
    const nextButton = this.getNextButton();
    if (nextButton !== null) {
      nextButton.node.active = visible;
      nextButton.interactable = visible;
    }
    const restartButton = this.getRestartButton();
    if (restartButton !== null) {
      restartButton.node.setPosition(visible ? 0 : -86, -120, 0);
    }
    const homeButton = this.getHomeButton();
    if (homeButton !== null) {
      homeButton.node.setPosition(visible ? 100 : 86, -120, 0);
    }
  }

  private flashButton(button: Button | null, kind: "pressed" | "error", fallbackText = "Settings"): void {
    if (button === null || !button.node.isValid) {
      return;
    }
    const background = button.node.getChildByName("Background");
    const sprite = background?.getComponent(Sprite) ?? null;
    if (sprite !== null) {
      sprite.color = kind === "error" ? new Color(239, 106, 91, 255) : UTILITY_PRESSED_COLOR;
    }
    button.node.setScale(0.95, 0.95, 1);
    this.scheduleOnce(() => {
      if (!this.isValid || !button.node.isValid) {
        return;
      }
      button.node.setScale(1, 1, 1);
      styleUtilityButton(button, fallbackText);
    }, kind === "error" ? 0.16 : 0.12);
  }

  private flashResultPanel(): void {
    if (this.resultRoot === null || !this.resultRoot.active) {
      return;
    }
    this.resultRoot.setScale(0.96, 0.96, 1);
    this.scheduleOnce(() => {
      if (this.isValid && this.resultRoot !== null && this.resultRoot.isValid) {
        this.resultRoot.setScale(1, 1, 1);
      }
    }, 0.1);
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
  const width = 142;
  setContentSize(button.node, width, 68);

  const background = button.node.getChildByName("Background");
  setContentSize(background ?? null, width, 68);
  const backgroundSprite = background?.getComponent(Sprite) ?? null;
  const nodeSprite = background === null ? button.node.getComponent(Sprite) ?? null : null;
  if (backgroundSprite !== null) {
    backgroundSprite.color = UTILITY_NORMAL_COLOR;
  } else if (nodeSprite !== null) {
    nodeSprite.color = UTILITY_NORMAL_COLOR;
  }

  const icon = button.node.getChildByName("Icon");
  if (icon !== null) {
    setContentSize(icon, 28, 28);
    icon.setPosition(-42, 1, 0);
  }

  const label = button.node.getChildByName("Label")?.getComponent(Label) ?? null;
  if (label !== null) {
    label.string = label.string.length === 0 ? fallbackText : label.string;
    label.node.setPosition(18, 0, 0);
    setContentSize(label.node, 104, 36);
    styleLabel(label, 22, 30, BUTTON_TEXT_COLOR, BUTTON_OUTLINE_COLOR);
  }
}

function setContentSize(node: Node | null, width: number, height: number): void {
  node?.getComponent(UITransform)?.setContentSize(width, height);
}

function createResultButtonNode(name: string): Node {
  const buttonNode = new Node(name);
  buttonNode.addComponent(UITransform);
  buttonNode.addComponent(Sprite);
  buttonNode.addComponent(Button);

  const background = new Node("Background");
  background.addComponent(UITransform);
  background.addComponent(Sprite);
  buttonNode.addChild(background);

  const labelNode = new Node("Label");
  labelNode.addComponent(UITransform);
  labelNode.addComponent(Label);
  buttonNode.addChild(labelNode);
  return buttonNode;
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
