import { _decorator, BlockInputEvents, Button, Color, Component, Graphics, Label, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, tween } from "cc";
import type { BattlePresentationEvent, BattleUiActions } from "./BattleViewContract";

const { ccclass, property } = _decorator;

const TEXT_COLOR = new Color(38, 48, 45, 255);
const BUTTON_TEXT_COLOR = new Color(255, 255, 255, 255);
const TEXT_OUTLINE_COLOR = new Color(255, 255, 255, 210);
const BUTTON_OUTLINE_COLOR = new Color(38, 48, 45, 135);
const SHADOW_COLOR = new Color(38, 48, 45, 90);
const UTILITY_NORMAL_COLOR = new Color(47, 183, 164, 255);
const UTILITY_PRESSED_COLOR = new Color(34, 141, 130, 255);
const RESULT_PANEL_FILL = new Color(255, 250, 236, 246);
const RESULT_PANEL_STROKE = new Color(181, 158, 115, 210);
const RESULT_OVERLAY = new Color(24, 31, 29, 90);
const RESULT_FAIL = new Color(242, 124, 138, 255);

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
  private resultOpacity: UIOpacity | null = null;

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
    this.setResult(reason === undefined || reason.length === 0 ? "No moves left" : reason, "deadlock");
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
      } else if (event.type === "victory" || event.type === "deadlock") {
        this.flashResultPanel();
      }
    }
  }

  public hideResult(): void {
    if (this.resultRoot !== null) {
      this.resultRoot.active = false;
      this.resultRoot.setScale(1, 1, 1);
    }
    this.setResultOpacity(0);
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
    if (toolbarHomeButton !== null && toolbarHomeButton.node.active) {
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
      this.resultRoot.setScale(0.94, 0.94, 1);
      Tween.stopAllByTarget(this.resultRoot);
      tween(this.resultRoot).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
    }
    this.setResultOpacity(255);
    this.setResultIcon(icon);
    if (this.resultLabel !== null) {
      this.resultLabel.string = text;
      styleLabel(this.resultLabel, 42, 50, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
    this.ensureResultBackdrop(icon);
  }

  private applyToolbarLayout(): void {
    const settingsButton = this.getSettingsButton();
    this.levelLabel?.node.setPosition(-200, 0, 0);
    settingsButton?.node.setPosition(228, 0, 0);
    styleUtilityButton(settingsButton, "Settings");
    const toolbarHomeButton = this.getToolbarHomeButton();
    if (toolbarHomeButton !== null) {
      toolbarHomeButton.node.active = false;
      toolbarHomeButton.interactable = false;
    }
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
      setContentSize(this.levelLabel.node, 260, 46);
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
      this.ensureResultButtonLayout(existing, "Replay");
      return existing;
    }
    const buttonNode = createResultButtonNode("RestartButton");
    this.resultRoot.addChild(buttonNode);
    this.ensureResultButtonLayout(buttonNode.getComponent(Button), "Replay");
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

  private ensureResultButtonLayout(button: Button | null, labelText: string): void {
    if (button === null) {
      return;
    }
    const node = button.node;
    setContentSize(node, 188, 70);
    const background = ensureButtonBackground(node, 188, 70);
    drawButtonBackground(background, 188, 70, 24, UTILITY_NORMAL_COLOR, new Color(24, 31, 29, 110));
    const label = node.getChildByName("Label")?.getComponent(Label) ?? null;
    if (label !== null) {
      label.string = labelText;
      label.node.setPosition(0, 0, 0);
      setContentSize(label.node, 148, 36);
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
    const graphics = background?.getComponent(Graphics) ?? null;
    if (graphics !== null) {
      drawButtonBackground(
        graphics,
        background?.getComponent(UITransform)?.contentSize.width ?? 142,
        background?.getComponent(UITransform)?.contentSize.height ?? 68,
        22,
        kind === "error" ? RESULT_FAIL : UTILITY_PRESSED_COLOR,
        new Color(24, 31, 29, 110),
      );
    } else {
      const sprite = background?.getComponent(Sprite) ?? null;
      if (sprite !== null) {
        sprite.color = kind === "error" ? RESULT_FAIL : UTILITY_PRESSED_COLOR;
      }
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
    Tween.stopAllByTarget(this.resultRoot);
    tween(this.resultRoot).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
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

  private ensureResultBackdrop(icon: "win" | "deadlock"): void {
    if (this.resultRoot === null) {
      return;
    }
    const dimLayer = ensureNode(this.resultRoot, "ResultDimLayer", 750, 1334);
    dimLayer.setPosition(0, -40, 0);
    dimLayer.addComponent(BlockInputEvents);
    const dimGraphics = dimLayer.getComponent(Graphics);
    if (dimGraphics !== null) {
      dimGraphics.clear();
      dimGraphics.fillColor = RESULT_OVERLAY;
      dimGraphics.rect(-375, -667, 750, 1334);
      dimGraphics.fill();
    }

    const panel = this.resultRoot.getChildByName("Background")?.getComponent(Graphics) ?? null;
    if (panel !== null) {
      panel.clear();
      panel.fillColor = RESULT_PANEL_FILL;
      panel.strokeColor = RESULT_PANEL_STROKE;
      panel.lineWidth = 4;
      panel.roundRect(-310, -228, 620, 460, 36);
      panel.fill();
      panel.stroke();
      panel.fillColor = new Color(255, 255, 255, 110);
      panel.roundRect(-274, 162, 548, 14, 7);
      panel.fill();
      panel.fillColor = icon === "win" ? new Color(245, 184, 75, 76) : new Color(242, 124, 138, 76);
      panel.roundRect(-274, 146, 548, 10, 5);
      panel.fill();
    }

    const label = this.resultLabel;
    if (label !== null) {
      label.node.setPosition(0, 8, 0);
      setContentSize(label.node, 500, 92);
    }
    const iconRoot = this.resultRoot.getChildByName("ResultIcon");
    iconRoot?.setPosition(0, 126, 0);
    const restartButton = this.getRestartButton();
    const nextButton = this.getNextButton();
    const homeButton = this.getHomeButton();
    restartButton?.node.setPosition(nextButton !== null && nextButton.node.active ? -108 : -94, -136, 0);
    nextButton?.node.setPosition(0, -136, 0);
    homeButton?.node.setPosition(nextButton !== null && nextButton.node.active ? 108 : 94, -136, 0);
    this.setResultOpacity(255);
  }

  private setResultOpacity(value: number): void {
    if (this.resultRoot === null) {
      return;
    }
    const opacity = this.resultOpacity ?? this.resultRoot.getComponent(UIOpacity) ?? this.resultRoot.addComponent(UIOpacity);
    this.resultOpacity = opacity;
    opacity.opacity = value;
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
  const backgroundGraphics = background?.getComponent(Graphics) ?? null;
  if (backgroundGraphics !== null) {
    drawButtonBackground(backgroundGraphics, width, 68, 22, UTILITY_NORMAL_COLOR, new Color(24, 31, 29, 110));
  } else {
    const backgroundSprite = background?.getComponent(Sprite) ?? null;
    const nodeSprite = background === null ? button.node.getComponent(Sprite) ?? null : null;
    if (backgroundSprite !== null) {
      backgroundSprite.color = UTILITY_NORMAL_COLOR;
    } else if (nodeSprite !== null) {
      nodeSprite.color = UTILITY_NORMAL_COLOR;
    }
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

function ensureNode(parent: Node, name: string, width: number, height: number): Node {
  let node = parent.getChildByName(name);
  if (node === null) {
    node = new Node(name);
    node.addComponent(UITransform);
    node.addComponent(Graphics);
    parent.addChild(node);
  }
  setContentSize(node, width, height);
  node.active = true;
  node.setSiblingIndex(0);
  return node;
}

function ensureButtonBackground(node: Node, width: number, height: number): Graphics {
  let background = node.getChildByName("Background");
  if (background === null) {
    background = new Node("Background");
    background.addComponent(UITransform);
    background.addComponent(Graphics);
    node.addChild(background);
  }
  background.setSiblingIndex(0);
  background.setPosition(0, 0, 0);
  setContentSize(background, width, height);
  return background.getComponent(Graphics) ?? background.addComponent(Graphics);
}

function drawButtonBackground(graphics: Graphics | null, width: number, height: number, radius: number, fill: Color, stroke: Color): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = fill;
  graphics.strokeColor = stroke;
  graphics.lineWidth = 3;
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  graphics.stroke();
  graphics.fillColor = new Color(255, 255, 255, 48);
  graphics.roundRect(-width / 2 + 16, height / 2 - 20, width - 32, 8, 4);
  graphics.fill();
}

function createResultButtonNode(name: string): Node {
  const buttonNode = new Node(name);
  buttonNode.addComponent(UITransform);
  buttonNode.addComponent(Sprite);
  buttonNode.addComponent(Button);

  const background = new Node("Background");
  background.addComponent(UITransform);
  background.addComponent(Sprite);
  background.addComponent(Graphics);
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
