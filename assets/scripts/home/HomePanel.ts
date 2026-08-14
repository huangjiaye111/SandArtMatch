import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import type { HomeAcquireEntryAction, HomeAcquireEntryData, HomeData, HomeLevelData, HomePlaceholderEntryAction, HomeViewData } from "./HomeData";
import { HomeLevelNode } from "./HomeLevelNode";
import { getRuntimeSettingsData } from "../cocos/navigation/RuntimeGameServices";

const { ccclass, property } = _decorator;

const PANEL_WIDTH = 750;
const PANEL_HEIGHT = 1334;
const TEXT_COLOR = new Color(72, 62, 55, 255);

@ccclass("HomePanel")
export class HomePanel extends Component {
  @property(Label)
  public staminaLabel: Label | null = null;

  @property(Label)
  public coinsLabel: Label | null = null;

  @property(Label)
  public staminaAcquireLabel: Label | null = null;

  @property(Label)
  public coinsAcquireLabel: Label | null = null;

  @property(Label)
  public logoLabel: Label | null = null;

  @property(Button)
  public staminaButton: Button | null = null;

  @property(Button)
  public coinsButton: Button | null = null;

  @property(Button)
  public settingsButton: Button | null = null;

  @property(Button)
  public playButton: Button | null = null;
  @property(Button)
  public collectionButton: Button | null = null;

  @property(Button)
  public shopButton: Button | null = null;

  @property(Node)
  public levelPathRoot: Node | null = null;

  @property([HomeLevelNode])
  public levelNodes: HomeLevelNode[] = [];

  private dataSource: HomeData | null = null;
  private playHandler: ((levelId: string) => void) | null = null;
  private readonly levelClickHandlers = new Map<HomeLevelNode, () => void>();
  private placeholderLabel: Label | null = null;

  public setDataSource(dataSource: HomeData): void {
    this.dataSource = dataSource;
    this.refreshHome();
  }

  public setPlayHandler(handler: ((levelId: string) => void) | null): void {
    this.playHandler = handler;
    this.rebindButtons();
  }

  public refreshHome(): void {
    this.ensureLayout();
    if (this.dataSource === null) {
      this.renderEmpty();
      return;
    }
    const viewData = this.dataSource.getViewData();
    this.renderResources(viewData);
    this.renderLevels(viewData);
    this.renderPlayState(viewData);
    this.renderPlaceholderEntries(viewData);
  }

  protected onDestroy(): void {
    this.clearLevelHandlers();
    this.unbindButton(this.staminaButton, this.onStaminaClick);
    this.unbindButton(this.coinsButton, this.onCoinsClick);
    this.unbindButton(this.settingsButton, this.onSettingsClick);
    this.unbindButton(this.playButton, this.onPlayClick);
    this.unbindButton(this.collectionButton, this.onCollectionClick);
    this.unbindButton(this.shopButton, this.onShopClick);
  }

  private renderEmpty(): void {
    if (this.staminaLabel !== null) {
      this.staminaLabel.string = "0";
    }
    if (this.coinsLabel !== null) {
      this.coinsLabel.string = "0";
    }
    this.setAcquireEntryText("stamina", null);
    this.setAcquireEntryText("coins", null);
    if (this.logoLabel !== null) {
      this.logoLabel.string = "Sand Art Match";
    }
    for (const node of this.levelNodes) {
      node.node.active = false;
      node.setClickHandler(null);
    }
    if (this.playButton !== null) {
      this.playButton.interactable = false;
    }
  }

  private renderResources(viewData: HomeViewData): void {
    if (this.staminaLabel !== null) {
      this.staminaLabel.string = getAcquireValueText(viewData, "stamina");
    }
    if (this.coinsLabel !== null) {
      this.coinsLabel.string = getAcquireValueText(viewData, "coins");
    }
    this.setAcquireEntryText("stamina", getAcquireEntry(viewData, "stamina"));
    this.setAcquireEntryText("coins", getAcquireEntry(viewData, "coins"));
    if (this.logoLabel !== null) {
      this.logoLabel.string = "Sand Art Match";
    }
  }

  private setAcquireEntryText(action: HomeAcquireEntryAction, entry: HomeAcquireEntryData | null): void {
    const label = this.ensureAcquireLabel(action);
    if (label === null) {
      return;
    }
    label.string = entry === null ? "" : entry.rewardHint;
    label.color = entry?.locked === true ? new Color(158, 106, 78, 255) : new Color(72, 124, 94, 255);
  }

  private ensureAcquireLabel(action: HomeAcquireEntryAction): Label | null {
    const existing = action === "stamina" ? this.staminaAcquireLabel : this.coinsAcquireLabel;
    if (existing !== null) {
      return existing;
    }
    const button = action === "stamina" ? this.staminaButton : this.coinsButton;
    const fallbackLabel = action === "stamina" ? this.staminaLabel : this.coinsLabel;
    const parent = button?.node ?? fallbackLabel?.node.parent ?? null;
    if (parent === null) {
      return null;
    }
    const node = createLabelNode(parent, action === "stamina" ? "StaminaAcquireLabel" : "CoinsAcquireLabel", 156, 24, 0, -28, 16);
    const label = node.getComponent(Label);
    if (action === "stamina") {
      this.staminaAcquireLabel = label;
    } else {
      this.coinsAcquireLabel = label;
    }
    return label;
  }

  private renderLevels(viewData: HomeViewData): void {
    const nodes = this.ensureLevelNodeCount(viewData.levels.length);
    this.clearLevelHandlers();
    nodes.forEach((node, index) => {
      const level = viewData.levels[index];
      if (level === undefined) {
        node.node.active = false;
        return;
      }
      node.node.active = true;
      node.node.setPosition(-260 + index * 152, 0, 0);
      node.setData(level);
      if (level.status === "locked") {
        node.setClickHandler(null);
        return;
      }
      const clickHandler = () => this.onLevelClick(level);
      this.levelClickHandlers.set(node, clickHandler);
      node.setClickHandler(clickHandler);
    });
  }

  private renderPlayState(viewData: HomeViewData): void {
    if (this.playButton !== null) {
      this.playButton.interactable = viewData.canPlay;
    }
  }

  private renderPlaceholderEntries(viewData: HomeViewData): void {
    const shopEntry = getPlaceholderEntry(viewData, "shop");
    if (this.shopButton !== null) {
      this.shopButton.node.active = shopEntry?.visible !== false;
      this.shopButton.interactable = shopEntry?.visible !== false;
    }
  }

  private onLevelClick(level: HomeLevelData): void {
    this.dataSource?.selectLevel(level.levelId);
    this.refreshHome();
  }

  private ensureLevelNodeCount(count: number): HomeLevelNode[] {
    while (this.levelNodes.length < count) {
      this.levelNodes.push(this.createLevelNode(this.levelNodes.length));
    }
    return this.levelNodes;
  }

  private createLevelNode(index: number): HomeLevelNode {
    const root = new Node(`HomeLevelNode${index + 1}`);
    root.layer = this.node.layer;
    root.addComponent(UITransform).setContentSize(116, 116);
    const sprite = root.addComponent(Sprite);
    sprite.color = new Color(229, 247, 237, 255);
    this.getLevelPathRoot().addChild(root);

    const button = root.addComponent(Button);
    button.transition = Button.Transition.NONE;

    const levelNode = root.addComponent(HomeLevelNode);
    levelNode.button = button;
    levelNode.backgroundSprite = sprite;
    levelNode.numberLabel = createLabelNode(root, "NumberLabel", 80, 32, 0, 28, 26).getComponent(Label);
    levelNode.nameLabel = createLabelNode(root, "NameLabel", 104, 28, 0, -8, 18).getComponent(Label);
    levelNode.statusLabel = createLabelNode(root, "StatusLabel", 104, 24, 0, -38, 16).getComponent(Label);
    return levelNode;
  }

  private ensureLayout(): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    const pathTransform = this.getLevelPathRoot().getComponent(UITransform) ?? this.getLevelPathRoot().addComponent(UITransform);
    pathTransform.setContentSize(PANEL_WIDTH, 180);
    this.rebindButtons();
  }

  private getLevelPathRoot(): Node {
    if (this.levelPathRoot !== null) {
      return this.levelPathRoot;
    }
    let root = this.node.getChildByName("LevelPathRoot");
    if (root === null) {
      root = new Node("LevelPathRoot");
      root.layer = this.node.layer;
      root.setPosition(0, 34, 0);
      this.node.addChild(root);
    }
    this.levelPathRoot = root;
    return root;
  }

  private rebindButtons(): void {
    this.bindButton(this.staminaButton, this.onStaminaClick);
    this.bindButton(this.coinsButton, this.onCoinsClick);
    this.bindButton(this.settingsButton, this.onSettingsClick);
    this.bindButton(this.playButton, this.onPlayClick);
    this.bindButton(this.collectionButton, this.onCollectionClick);
    this.bindButton(this.shopButton, this.onShopClick);
  }

  private bindButton(button: Button | null, handler: () => void): void {
    if (button === null) {
      return;
    }
    button.node.off(Button.EventType.CLICK, handler, this);
    button.node.on(Button.EventType.CLICK, handler, this);
  }

  private unbindButton(button: Button | null, handler: () => void): void {
    if (button !== null) {
      button.node.off(Button.EventType.CLICK, handler, this);
    }
  }

  private onStaminaClick(): void {
    const entry = this.dataSource === null ? null : getAcquireEntry(this.dataSource.getViewData(), "stamina");
    console.log(`[HomePanel] stamina entry clicked ${entry?.rewardHint ?? ""}`);
  }

  private onCoinsClick(): void {
    const entry = this.dataSource === null ? null : getAcquireEntry(this.dataSource.getViewData(), "coins");
    console.log(`[HomePanel] coins entry clicked ${entry?.rewardHint ?? ""}`);
  }

  private onSettingsClick(): void {
    const settings = getRuntimeSettingsData().toggle("sound");
    console.log(`[HomePanel] settings sound=${settings.soundEnabled ? "on" : "off"} vibration=${settings.vibrationEnabled ? "on" : "off"}`);
  }

  private onPlayClick(): void {
    const selected = this.dataSource?.getSelectedLevel() ?? null;
    if (selected === null || selected.status === "locked") {
      return;
    }
    if (this.playHandler !== null) {
      this.playHandler(selected.levelId);
      return;
    }
    console.log(`[HomePanel] play clicked levelId=${selected.levelId}`);
  }


  private onCollectionClick(): void {
    console.log("[HomePanel] collection clicked");
  }

  private onShopClick(): void {
    this.showPlaceholderMessage("shop");
  }

  private showPlaceholderMessage(action: HomePlaceholderEntryAction): void {
    const viewData = this.dataSource?.getViewData() ?? null;
    const entry = viewData === null ? null : getPlaceholderEntry(viewData, action);
    const label = this.ensurePlaceholderLabel();
    if (label !== null) {
      label.string = entry?.message ?? "Feature is not active yet";
    }
    console.log(`[HomePanel] ${action} placeholder ${entry?.featureGate ?? "missing"}`);
  }

  private ensurePlaceholderLabel(): Label | null {
    if (this.placeholderLabel !== null && this.placeholderLabel.node.isValid) {
      return this.placeholderLabel;
    }
    const node = createLabelNode(this.node, "HomePlaceholderLabel", 360, 32, 0, -618, 18);
    this.placeholderLabel = node.getComponent(Label);
    this.placeholderLabel.color = new Color(158, 106, 78, 255);
    return this.placeholderLabel;
  }

  private clearLevelHandlers(): void {
    for (const node of this.levelClickHandlers.keys()) {
      node.setClickHandler(null);
    }
    this.levelClickHandlers.clear();
  }
}

function createLabelNode(parent: Node, name: string, width: number, height: number, x: number, y: number, fontSize: number): Node {
  const node = new Node(name);
  node.layer = parent.layer;
  node.addComponent(UITransform).setContentSize(width, height);
  node.setPosition(x, y, 0);
  const label = node.addComponent(Label);
  label.string = "";
  label.fontSize = fontSize;
  label.lineHeight = fontSize + 4;
  label.color = TEXT_COLOR;
  parent.addChild(node);
  return node;
}

function getAcquireEntry(viewData: HomeViewData, action: HomeAcquireEntryAction): HomeAcquireEntryData | null {
  return viewData.acquireEntries.find((entry) => entry.action === action) ?? null;
}

function getAcquireValueText(viewData: HomeViewData, action: HomeAcquireEntryAction): string {
  const entry = getAcquireEntry(viewData, action);
  if (entry !== null) {
    return entry.valueText;
  }
  return action === "stamina" ? `${viewData.currentStamina}` : `${viewData.currentCoins}`;
}

function getPlaceholderEntry(viewData: HomeViewData, action: HomePlaceholderEntryAction) {
  return viewData.placeholderEntries.find((entry) => entry.action === action) ?? null;
}
