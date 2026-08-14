import { _decorator, BlockInputEvents, Button, Color, Component, Graphics, Label, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, tween } from "cc";
import type { BattleLosePresentationOptions, BattlePresentationEvent, BattleUiActions, BattleWinPresentationOptions } from "./BattleViewContract";
import { createBattleResultPresentationModel, type BattleResultPresentationModel } from "./BattleResultPresentationModel";
import type { BattleToolEntryPresentationModel } from "./BattleThemePresentationModel";
import { getRuntimeSettingsData } from "../navigation/RuntimeGameServices";

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
const RESULT_DETAIL_COLOR = new Color(111, 90, 56, 255);
const DISABLED_BUTTON_COLOR = new Color(141, 150, 142, 220);
const AUX_BUTTON_COLOR = new Color(244, 166, 80, 255);
const TOOL_RING_COLOR = new Color(255, 205, 48, 255);
const TOOL_HINT_COLOR = new Color(118, 213, 91, 255);
const TOOL_SHUFFLE_COLOR = new Color(245, 83, 178, 255);
const TOOL_POOL_REMOVE_COLOR = new Color(112, 205, 88, 255);
const TOOL_CARRIER_REMOVE_COLOR = new Color(75, 184, 233, 255);
const TOOL_ICON_COLOR = new Color(255, 255, 255, 255);

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
  private resultActionButtons: Map<string, Button> = new Map();
  private resultAuxActionButtons: Map<string, Button> = new Map();
  private readonly auxActionHandlers = new Map<Button, () => void>();
  private readonly toolActionHandlers = new Map<Button, () => void>();

  public setActions(actions: BattleUiActions): void {
    this.actions = actions;
    this.applyToolbarLayout();
    this.ensureToolbarHomeButton();
    this.ensureResultRestartButton();
    this.ensureResultNextButton();
    this.ensureResultHomeButton();
    this.rebindButtons();
  }

  public setBattleToolEntries(entries: readonly BattleToolEntryPresentationModel[]): void {
    this.setToolEntryButtons(entries);
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

  public showWin(canStartNext = false, presentation: BattleWinPresentationOptions = {}): void {
    const model = createBattleResultPresentationModel({
      phase: "Won",
      canStartNext,
      rewardAmount: presentation.rewardAmount,
      artworkTitle: presentation.artworkTitle,
      canShare: presentation.canShare,
    });
    if (model !== null) {
      this.setResult(model);
    }
  }

  public showLose(reason?: string, presentation: BattleLosePresentationOptions = {}): void {
    const model = createBattleResultPresentationModel({
      phase: "Failed",
      reason,
      staminaCost: presentation.staminaCost,
      canRevive: presentation.canRevive,
    });
    if (model !== null) {
      this.setResult(model);
    }
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
    this.setResultIcon("victory");
    this.setResultActionButtons([]);
    this.setResultAuxActionButtons([]);
    this.setResultArtworkText("");
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
        const settings = getRuntimeSettingsData().toggle("vibration");
        this.showFeedback(`Sound ${settings.soundEnabled ? "On" : "Off"}  Vibration ${settings.vibrationEnabled ? "On" : "Off"}`);
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

  private setResult(model: BattleResultPresentationModel): void {
    if (this.resultRoot !== null) {
      this.resultRoot.active = true;
      this.resultRoot.setScale(0.94, 0.94, 1);
      Tween.stopAllByTarget(this.resultRoot);
      tween(this.resultRoot).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
    }
    this.setResultOpacity(255);
    this.setResultIcon(model.state);
    this.setNextVisible(model.canStartNext);
    this.setResultActionButtons(model.actions);
    this.setResultAuxActionButtons(model.auxActions);
    if (this.resultLabel !== null) {
      this.resultLabel.string = model.title;
      styleLabel(this.resultLabel, 42, 50, TEXT_COLOR, TEXT_OUTLINE_COLOR);
    }
    this.setResultArtworkText(model.artworkText);
    this.setResultDetailText(model.detailText);
    this.ensureResultBackdrop(model.state);
  }

  private setResultActionButtons(actions: readonly { readonly action: string; readonly label: string; readonly visible: boolean; readonly enabled: boolean; }[]): void {
    const buttons = new Map<string, Button>();
    for (const action of actions) {
      const button = this.ensureResultActionButton(action.action, action.label);
      if (button !== null) {
        button.node.active = action.visible;
        button.interactable = action.enabled;
        buttons.set(action.action, button);
      }
    }
    this.resultActionButtons = buttons;
    this.layoutResultActionButtons(actions);
  }

  private setResultAuxActionButtons(actions: readonly { readonly action: string; readonly label: string; readonly visible: boolean; readonly enabled: boolean; }[]): void {
    this.clearAuxActionHandlers();
    const buttons = new Map<string, Button>();
    for (const action of actions) {
      const button = this.ensureResultAuxActionButton(action.action, action.label);
      if (button === null) {
        continue;
      }
      button.node.active = action.visible;
      button.interactable = action.enabled;
      styleSmallButton(button, action.label, action.enabled ? AUX_BUTTON_COLOR : DISABLED_BUTTON_COLOR);
      if (action.visible) {
        const handler = () => {
          this.flashSmallButton(button, action.enabled ? "pressed" : "error", action.label, action.enabled ? AUX_BUTTON_COLOR : DISABLED_BUTTON_COLOR);
          if (action.action === "revive" && action.enabled) {
            this.actions?.revive();
          } else {
            this.showFeedback(`${action.label} is a presentation hook`);
          }
        };
        this.auxActionHandlers.set(button, handler);
        button.node.on(Button.EventType.CLICK, handler, this);
      }
      buttons.set(action.action, button);
    }
    this.resultAuxActionButtons = buttons;
    this.layoutResultAuxActionButtons(actions);
  }

  private setResultArtworkText(text: string): void {
    const label = this.ensureResultArtworkLabel();
    if (label === null) {
      return;
    }
    label.string = text;
    label.node.active = text.length > 0;
    styleLabel(label, 24, 30, RESULT_DETAIL_COLOR, TEXT_OUTLINE_COLOR);
  }

  private setResultDetailText(text: string): void {
    const detailLabel = this.ensureResultDetailLabel();
    if (detailLabel === null) {
      return;
    }
    detailLabel.string = text;
    detailLabel.node.active = text.length > 0;
    styleLabel(detailLabel, 26, 34, RESULT_DETAIL_COLOR, TEXT_OUTLINE_COLOR);
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

  private setToolEntryButtons(entries: readonly BattleToolEntryPresentationModel[]): void {
    this.clearToolActionHandlers();
    const root = this.ensureToolEntryRoot();
    const buttons = new Map<string, Button>();
    let visibleIndex = 0;
    for (const entry of entries) {
      const button = this.ensureToolEntryButton(root, entry.action, entry.label);
      if (button === null) {
        continue;
      }
      button.node.active = entry.visible;
      button.interactable = entry.enabled;
      if (entry.visible) {
        button.node.setPosition(-64 + visibleIndex * 128, 0, 0);
        visibleIndex += 1;
      }
      styleToolButton(button, entry.action, entry.label, entry.enabled);
      const handler = () => {
        this.flashToolButton(button, entry.action, entry.label, entry.enabled, entry.enabled ? "pressed" : "error");
        if (entry.enabled) {
          this.actions?.useTool(entry.action);
        } else {
          this.showFeedback(entry.featureGate.length > 0 ? `${entry.label} locked` : `${entry.label} unavailable`);
        }
      };
      this.toolActionHandlers.set(button, handler);
      button.node.on(Button.EventType.CLICK, handler, this);
      buttons.set(entry.action, button);
    }
    root.active = visibleIndex > 0;
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

  private getResultDetailLabel(): Label | null {
    if (this.resultRoot === null || !this.resultRoot.isValid) {
      return null;
    }
    return this.resultRoot.getChildByName("ResultDetailLabel")?.getComponent(Label) ?? null;
  }

  private ensureResultDetailLabel(): Label | null {
    if (this.resultRoot === null) {
      return null;
    }
    const existing = this.getResultDetailLabel();
    if (existing !== null) {
      return existing;
    }
    const labelNode = new Node("ResultDetailLabel");
    labelNode.addComponent(UITransform).setContentSize(420, 42);
    const label = labelNode.addComponent(Label);
    this.resultRoot.addChild(labelNode);
    return label;
  }

  private ensureResultArtworkLabel(): Label | null {
    if (this.resultRoot === null) {
      return null;
    }
    const existing = this.resultRoot.getChildByName("ResultArtworkLabel")?.getComponent(Label) ?? null;
    if (existing !== null) {
      return existing;
    }
    const labelNode = new Node("ResultArtworkLabel");
    labelNode.addComponent(UITransform).setContentSize(460, 34);
    const label = labelNode.addComponent(Label);
    this.resultRoot.addChild(labelNode);
    return label;
  }

  private ensureResultActionButton(action: string, labelText: string): Button | null {
    if (this.resultRoot === null) {
      return null;
    }
    const existing = this.resultRoot.getChildByName(getResultActionNodeName(action))?.getComponent(Button) ?? null;
    if (existing !== null) {
      this.ensureResultButtonLayout(existing, labelText);
      return existing;
    }
    const buttonNode = createResultButtonNode(getResultActionNodeName(action));
    this.resultRoot.addChild(buttonNode);
    this.ensureResultButtonLayout(buttonNode.getComponent(Button), labelText);
    return buttonNode.getComponent(Button);
  }

  private layoutResultActionButtons(actions: readonly { readonly action: string; readonly label: string; readonly visible: boolean; readonly enabled: boolean; }[]): void {
    const visibleButtons = actions.filter((action) => action.visible);
    const spacing = visibleButtons.length <= 1 ? 0 : 108;
    const startX = -spacing * (visibleButtons.length - 1) / 2;
    let index = 0;
    for (const action of visibleButtons) {
      const button = this.resultActionButtons.get(action.action) ?? null;
      if (button === null) {
        continue;
      }
      button.node.active = true;
      button.node.setPosition(startX + index * spacing, -166, 0);
      index += 1;
    }
  }

  private ensureResultAuxActionButton(action: string, labelText: string): Button | null {
    if (this.resultRoot === null) {
      return null;
    }
    const nodeName = `${action}AuxButton`;
    const existing = this.resultRoot.getChildByName(nodeName)?.getComponent(Button) ?? null;
    if (existing !== null) {
      styleSmallButton(existing, labelText, AUX_BUTTON_COLOR);
      return existing;
    }
    const buttonNode = createResultButtonNode(nodeName);
    this.resultRoot.addChild(buttonNode);
    const button = buttonNode.getComponent(Button);
    styleSmallButton(button, labelText, AUX_BUTTON_COLOR);
    return button;
  }

  private layoutResultAuxActionButtons(actions: readonly { readonly action: string; readonly visible: boolean }[]): void {
    const visibleActions = actions.filter((action) => action.visible);
    const spacing = visibleActions.length <= 1 ? 0 : 118;
    const startX = -spacing * (visibleActions.length - 1) / 2;
    let index = 0;
    for (const action of visibleActions) {
      const button = this.resultAuxActionButtons.get(action.action) ?? null;
      if (button === null) {
        continue;
      }
      button.node.setPosition(startX + index * spacing, -104, 0);
      index += 1;
    }
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
      restartButton.node.setPosition(visible ? 0 : -86, -166, 0);
    }
    const homeButton = this.getHomeButton();
    if (homeButton !== null) {
      homeButton.node.setPosition(visible ? 100 : 86, -166, 0);
    }
  }

  private layoutResultActionButtonsFromCurrentState(): void {
    const actions = [
      { action: "replay", visible: this.getRestartButton()?.node.active === true },
      { action: "next", visible: this.getNextButton()?.node.active === true },
      { action: "home", visible: this.getHomeButton()?.node.active === true },
    ];
    this.layoutResultActionButtons(actions.map((action) => Object.freeze({
      action: action.action,
      label: "",
      visible: action.visible,
      enabled: action.visible,
    })));
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

  private flashSmallButton(button: Button | null, kind: "pressed" | "error", fallbackText: string, normalColor: Color): void {
    if (button === null || !button.node.isValid) {
      return;
    }
    styleSmallButton(button, fallbackText, kind === "error" ? RESULT_FAIL : UTILITY_PRESSED_COLOR);
    button.node.setScale(0.95, 0.95, 1);
    this.scheduleOnce(() => {
      if (!this.isValid || !button.node.isValid) {
        return;
      }
      button.node.setScale(1, 1, 1);
      styleSmallButton(button, fallbackText, normalColor);
    }, kind === "error" ? 0.16 : 0.12);
  }

  private flashToolButton(button: Button | null, action: string, fallbackText: string, enabled: boolean, kind: "pressed" | "error"): void {
    if (button === null || !button.node.isValid) {
      return;
    }
    button.node.setScale(kind === "error" ? 1.06 : 0.92, kind === "error" ? 1.06 : 0.92, 1);
    this.scheduleOnce(() => {
      if (!this.isValid || !button.node.isValid) {
        return;
      }
      button.node.setScale(1, 1, 1);
      styleToolButton(button, action, fallbackText, enabled);
    }, kind === "error" ? 0.16 : 0.12);
  }

  private setResultIcon(state: BattleResultPresentationModel["state"]): void {
    const iconRoot = this.resultRoot?.getChildByName("ResultIcon") ?? null;
    const victoryIcon = iconRoot?.getChildByName("VictoryIcon") ?? null;
    const deadlockIcon = iconRoot?.getChildByName("DeadlockIcon") ?? null;
    if (victoryIcon !== null) {
      victoryIcon.active = state === "victory";
    }
    if (deadlockIcon !== null) {
      deadlockIcon.active = state === "deadlock";
    }
  }

  private ensureResultBackdrop(state: BattleResultPresentationModel["state"]): void {
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
      panel.fillColor = state === "victory" ? new Color(245, 184, 75, 76) : new Color(242, 124, 138, 76);
      panel.roundRect(-274, 146, 548, 10, 5);
      panel.fill();
    }

    const label = this.resultLabel;
    if (label !== null) {
      label.node.setPosition(0, 52, 0);
      setContentSize(label.node, 500, 92);
    }
    this.resultRoot.getChildByName("ResultArtworkLabel")?.setPosition(0, 0, 0);
    this.resultRoot.getChildByName("ResultDetailLabel")?.setPosition(0, -44, 0);
    const iconRoot = this.resultRoot.getChildByName("ResultIcon");
    iconRoot?.setPosition(0, 148, 0);
    this.layoutResultActionButtonsFromCurrentState();
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

  private clearAuxActionHandlers(): void {
    for (const [button, handler] of this.auxActionHandlers) {
      this.removeButtonHandler(button, handler);
    }
    this.auxActionHandlers.clear();
  }

  private clearToolActionHandlers(): void {
    for (const [button, handler] of this.toolActionHandlers) {
      this.removeButtonHandler(button, handler);
    }
    this.toolActionHandlers.clear();
  }

  private ensureToolEntryRoot(): Node {
    const host = this.node.parent ?? this.node;
    let root = host.getChildByName("BattleToolEntryRoot") ?? this.node.getChildByName("BattleToolEntryRoot");
    if (root === null) {
      root = new Node("BattleToolEntryRoot");
      root.addComponent(UITransform).setContentSize(300, 112);
      host.addChild(root);
    } else if (root.parent !== host) {
      root.removeFromParent();
      host.addChild(root);
    }
    root.setPosition(0, -604, 0);
    root.setSiblingIndex(120);
    return root;
  }

  private ensureToolEntryButton(root: Node, action: string, labelText: string): Button | null {
    const nodeName = `${action}ToolButton`;
    const existing = root.getChildByName(nodeName)?.getComponent(Button) ?? null;
    if (existing !== null) {
      styleSmallButton(existing, labelText, DISABLED_BUTTON_COLOR);
      return existing;
    }
    const buttonNode = createResultButtonNode(nodeName);
    root.addChild(buttonNode);
    const button = buttonNode.getComponent(Button);
    styleSmallButton(button, labelText, DISABLED_BUTTON_COLOR);
    return button;
  }
}

function getResultActionNodeName(action: string): string {
  if (action === "replay") {
    return "RestartButton";
  }
  if (action === "next") {
    return "NextButton";
  }
  if (action === "home") {
    return "HomeButton";
  }
  return `${action}Button`;
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

function styleSmallButton(button: Button | null, fallbackText: string, fill: Color): void {
  if (button === null) {
    return;
  }
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.95;
  setContentSize(button.node, 112, 48);
  const background = ensureButtonBackground(button.node, 112, 48);
  drawButtonBackground(background, 112, 48, 18, fill, new Color(24, 31, 29, 88));
  const label = button.node.getChildByName("Label")?.getComponent(Label) ?? null;
  if (label !== null) {
    label.string = fallbackText;
    label.node.setPosition(0, 0, 0);
    setContentSize(label.node, 92, 28);
    styleLabel(label, 18, 24, BUTTON_TEXT_COLOR, BUTTON_OUTLINE_COLOR);
  }
}

function styleToolButton(button: Button | null, action: string, fallbackText: string, enabled: boolean): void {
  if (button === null) {
    return;
  }
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.9;
  setContentSize(button.node, 104, 104);
  const fill = !enabled
    ? DISABLED_BUTTON_COLOR
    : action === "removeCarrierBucket"
      ? TOOL_CARRIER_REMOVE_COLOR
      : action === "removePoolBucket"
        ? TOOL_POOL_REMOVE_COLOR
        : action === "shuffle"
          ? TOOL_SHUFFLE_COLOR
          : TOOL_HINT_COLOR;
  const background = ensureButtonBackground(button.node, 96, 96);
  drawToolButtonBackground(background, fill);
  const icon = ensureToolIcon(button.node);
  drawToolIcon(icon, action, enabled);
  const label = button.node.getChildByName("Label")?.getComponent(Label) ?? null;
  if (label !== null) {
    label.string = fallbackText;
    label.node.setPosition(0, -36, 0);
    setContentSize(label.node, 86, 24);
    styleLabel(label, 18, 22, BUTTON_TEXT_COLOR, BUTTON_OUTLINE_COLOR);
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

function drawToolButtonBackground(graphics: Graphics | null, fill: Color): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = TOOL_RING_COLOR;
  graphics.strokeColor = new Color(126, 82, 34, 160);
  graphics.lineWidth = 4;
  graphics.roundRect(-48, -48, 96, 96, 48);
  graphics.fill();
  graphics.stroke();
  graphics.fillColor = fill;
  graphics.roundRect(-38, -38, 76, 76, 38);
  graphics.fill();
  graphics.fillColor = new Color(255, 255, 255, 78);
  graphics.roundRect(-24, 18, 48, 10, 5);
  graphics.fill();
}

function ensureToolIcon(node: Node): Graphics {
  let icon = node.getChildByName("ToolIcon");
  if (icon === null) {
    icon = new Node("ToolIcon");
    icon.addComponent(UITransform).setContentSize(48, 48);
    icon.addComponent(Graphics);
    node.addChild(icon);
  }
  icon.setPosition(0, 4, 0);
  icon.setSiblingIndex(2);
  return icon.getComponent(Graphics) ?? icon.addComponent(Graphics);
}

function drawToolIcon(graphics: Graphics | null, action: string, enabled: boolean): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.strokeColor = enabled ? TOOL_ICON_COLOR : new Color(232, 235, 231, 230);
  graphics.fillColor = enabled ? TOOL_ICON_COLOR : new Color(232, 235, 231, 230);
  graphics.lineWidth = 5;
  if (action === "shuffle") {
    graphics.moveTo(-20, 12);
    graphics.lineTo(6, 12);
    graphics.lineTo(18, 22);
    graphics.moveTo(6, 12);
    graphics.lineTo(18, 2);
    graphics.moveTo(20, -12);
    graphics.lineTo(-6, -12);
    graphics.lineTo(-18, -22);
    graphics.moveTo(-6, -12);
    graphics.lineTo(-18, -2);
    graphics.stroke();
    return;
  }
  if (action === "removeCarrierBucket") {
    graphics.roundRect(-20, -12, 40, 24, 8);
    graphics.stroke();
    graphics.moveTo(-12, 0);
    graphics.lineTo(12, 0);
    graphics.moveTo(0, -22);
    graphics.lineTo(0, 22);
    graphics.stroke();
    return;
  }
  if (action === "removePoolBucket") {
    graphics.roundRect(-18, -18, 36, 32, 10);
    graphics.stroke();
    graphics.moveTo(-12, 20);
    graphics.lineTo(12, 20);
    graphics.moveTo(-8, 26);
    graphics.lineTo(8, 26);
    graphics.moveTo(-10, -4);
    graphics.lineTo(10, 12);
    graphics.moveTo(10, -4);
    graphics.lineTo(-10, 12);
    graphics.stroke();
    return;
  }
  graphics.circle(0, 4, 17);
  graphics.stroke();
  graphics.moveTo(0, -4);
  graphics.lineTo(0, 14);
  graphics.stroke();
  graphics.circle(0, -14, 3);
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
