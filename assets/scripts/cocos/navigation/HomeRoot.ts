import {
  _decorator,
  Button,
  Color,
  Component,
  error,
  Graphics,
  Label,
  Mask,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from "cc";
import { BUILT_IN_LEVEL_CATALOG, getDisplayLevelText } from "../../domain/config/LevelCatalog";
import { getHomeSelectionState, getLevelUnlockStates, type GameProgress, type LevelUnlockState } from "../../domain/progress/GameProgress";
import { getRuntimeGameNavigator, getRuntimeResourceStore, getRuntimeSettingsData } from "./RuntimeGameServices";

const { ccclass, property } = _decorator;

const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;
const HOME_RESOURCE_PATHS = Object.freeze({
  background: "home/ui_home_bg",
  logo: "home/ui_home_logo",
  cardFrame: "home/ui_home_level_card_frame",
  buttonPrimary: "home/ui_home_button_primary",
  settings: "home/ui_home_icon_settings",
  arrowRight: "home/ui_home_arrow_right",
  dotActive: "home/ui_home_page_dot_active",
  dotInactive: "home/ui_home_page_dot_inactive",
  playIcon: "home/ui_home_icon_play",
  preview001: "home/level-001-preview",
});

const TEXT_BROWN = new Color(73, 55, 47, 255);
const TEXT_CREAM = new Color(255, 248, 232, 255);
const TEXT_MUTED = new Color(121, 88, 66, 230);
const STATUS_GREEN = new Color(63, 178, 102, 255);
const STATUS_ORANGE = new Color(242, 163, 74, 255);
const STATUS_LOCKED = new Color(122, 116, 108, 255);
const DISABLED_TINT = new Color(166, 154, 136, 150);
const WHITE = new Color(255, 255, 255, 255);
const CARD_WIDTH = 530;
const CARD_HEIGHT = 650;
const SELECTED_FRAME_OUTSET = 10;
const ARTWORK_MASK_WIDTH = 388;
const ARTWORK_MASK_HEIGHT = 248;
const ARTWORK_PREVIEW_WIDTH = 368;
const ARTWORK_PREVIEW_HEIGHT = 248;
const PLAY_WIDTH = 460;
const PLAY_HEIGHT = 82;
const PLAY_ICON_SIZE = 32;
const HOME_STAMINA_TEXT = "体力";
const HOME_COINS_TEXT = "金币";
const HOME_COLLECTION_TEXT = "图鉴";
const HOME_SHOP_TEXT = "商店";

interface HomeFrames {
  readonly background: SpriteFrame;
  readonly logo: SpriteFrame;
  readonly cardFrame: SpriteFrame;
  readonly buttonPrimary: SpriteFrame;
  readonly settings: SpriteFrame;
  readonly arrowRight: SpriteFrame;
  readonly dotActive: SpriteFrame | null;
  readonly dotInactive: SpriteFrame | null;
  readonly playIcon: SpriteFrame;
  readonly preview001: SpriteFrame;
}

interface HomeNodes {
  readonly rootOpacity: UIOpacity;
  readonly header: Node;
  readonly logo: Sprite;
  readonly staminaLabel: Label;
  readonly coinsLabel: Label;
  readonly settingsButton: Button;
  readonly settingsIcon: Sprite;
  readonly section: Node;
  readonly leftArrowButton: Button;
  readonly leftArrowIcon: Sprite;
  readonly rightArrowButton: Button;
  readonly rightArrowIcon: Sprite;
  readonly cardRoot: Node;
  readonly cardFrame: Sprite;
  readonly artworkPreview: Sprite;
  readonly titleLabel: Label;
  readonly statusIcon: Label;
  readonly statusLabel: Label;
  readonly pageIndicatorRoot: Node;
  readonly playButton: Button;
  readonly playBackground: Sprite;
  readonly playLabel: Label;
  readonly playIcon: Sprite;
  readonly collectionButton: Button;
  readonly collectionLabel: Label;
  readonly shopButton: Button;
  readonly shopLabel: Label;
  readonly placeholderLabel: Label;
}

@ccclass("HomeRoot")
export class HomeRoot extends Component {
  @property(Label)
  public playLabel: Label | null = null;

  @property(Button)
  public playButton: Button | null = null;

  @property(Button)
  public continueButton: Button | null = null;

  @property(Button)
  public levelSelectButton: Button | null = null;

  @property(Button)
  public settingsButton: Button | null = null;

  @property(Node)
  public levelSelectionPanel: Node | null = null;

  @property(SpriteFrame)
  public backgroundFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public logoFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public cardFrameAsset: SpriteFrame | null = null;

  @property(SpriteFrame)
  public buttonPrimaryFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public settingsFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public arrowRightFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public dotActiveFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public dotInactiveFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public playIconFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  public preview001Frame: SpriteFrame | null = null;

  private frames: HomeFrames | null = null;
  private nodes: HomeNodes | null = null;
  private readonly catalog = BUILT_IN_LEVEL_CATALOG;
  private selectedIndex = 0;
  private isNavigating = false;
  private settingsOpen = false;
  private playHandler: (() => void) | null = null;
  private settingsHandler: (() => void) | null = null;
  private leftHandler: (() => void) | null = null;
  private rightHandler: (() => void) | null = null;
  private collectionHandler: (() => void) | null = null;
  private shopHandler: (() => void) | null = null;
  private readonly pressHandlers = new Map<Node, readonly (() => void)[]>();

  protected onLoad(): void {
    this.node.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.hideLegacyNodes();
    this.nodes = this.ensureHomeLayout();
    void this.loadFrames();
  }

  protected onEnable(): void {
    this.bindButtons();
    this.refresh();
    this.playEntranceTween();
  }

  protected onDisable(): void {
    this.clearButtons();
    Tween.stopAllByTarget(this.node);
    if (this.nodes !== null) {
      Tween.stopAllByTarget(this.nodes.logo.node);
      Tween.stopAllByTarget(this.nodes.cardRoot);
      Tween.stopAllByTarget(this.nodes.playButton.node);
    }
  }

  protected onDestroy(): void {
    this.clearButtons();
  }

  public refresh(): void {
    const progress = getRuntimeGameNavigator().loadProgress();
    this.selectedIndex = this.resolveSelectedIndex(progress);
    this.renderSelectedLevel(progress, false);
    this.renderResourceLabels();
  }

  private async loadFrames(): Promise<void> {
    try {
      this.frames = await loadHomeFrames(this);
      this.applyFrames();
      this.renderSelectedLevel(getRuntimeGameNavigator().loadProgress(), false);
    } catch (reason: unknown) {
      error("[HomeRoot] Home art asset load failed", reason);
    }
  }

  private ensureHomeLayout(): HomeNodes {
    const rootOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    rootOpacity.opacity = 0;
    this.node.removeAllChildren();

    const background = createNode(this.node, "Background", DESIGN_WIDTH, DESIGN_HEIGHT, 0, 0);
    const backgroundSpriteNode = createNode(background, "BackgroundSprite", DESIGN_WIDTH, DESIGN_HEIGHT, 0, 0);
    const backgroundSprite = ensureSprite(backgroundSpriteNode);
    backgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const header = createNode(this.node, "Header", DESIGN_WIDTH, 230, 0, 494);
    const logoNode = createNode(header, "Logo", 500, 333, 0, 10);
    const logo = ensureSprite(logoNode);
    logo.sizeMode = Sprite.SizeMode.CUSTOM;

    const resourceBar = createNode(this.node, "ResourceBar", 430, 54, -106, 560);
    const staminaButtonNode = createPillNode(resourceBar, "StaminaEntry", 196, 46, -108, 0, new Color(255, 244, 214, 238));
    const staminaLabel = createTextLabel(staminaButtonNode, "StaminaLabel", 168, 30, 0, 0, 20, TEXT_BROWN, false);
    staminaLabel.string = HOME_STAMINA_TEXT;
    const coinsButtonNode = createPillNode(resourceBar, "CoinsEntry", 196, 46, 108, 0, new Color(255, 244, 214, 238));
    const coinsLabel = createTextLabel(coinsButtonNode, "CoinsLabel", 168, 30, 0, 0, 20, TEXT_BROWN, false);
    coinsLabel.string = HOME_COINS_TEXT;

    const settingsNode = createNode(header, "SettingsButton", 86, 86, 302, 58);
    const settingsButton = ensureButton(settingsNode);
    const settingsIconNode = createNode(settingsNode, "SettingsIcon", 70, 70, 0, 0);
    const settingsIcon = ensureSprite(settingsIconNode);
    settingsIcon.sizeMode = Sprite.SizeMode.CUSTOM;

    const section = createNode(this.node, "FeaturedLevelSection", DESIGN_WIDTH, 760, 0, 38);
    const leftArrowNode = createNode(section, "LeftArrowButton", 86, 86, -318, 44);
    const leftArrowButton = ensureButton(leftArrowNode);
    const leftArrowIconNode = createNode(leftArrowNode, "ArrowIcon", 68, 68, 0, 0);
    leftArrowIconNode.setScale(-1, 1, 1);
    const leftArrowIcon = ensureSprite(leftArrowIconNode);
    leftArrowIcon.sizeMode = Sprite.SizeMode.CUSTOM;

    const rightArrowNode = createNode(section, "RightArrowButton", 86, 86, 318, 44);
    const rightArrowButton = ensureButton(rightArrowNode);
    const rightArrowIconNode = createNode(rightArrowNode, "ArrowIcon", 68, 68, 0, 0);
    const rightArrowIcon = ensureSprite(rightArrowIconNode);
    rightArrowIcon.sizeMode = Sprite.SizeMode.CUSTOM;

    const cardRoot = createNode(section, "LevelCardRoot", CARD_WIDTH, CARD_HEIGHT, 0, 44);
    const cardShadow = createNode(cardRoot, "CardShadow", CARD_WIDTH - 28, CARD_HEIGHT - 28, 8, -12);
    cardShadow.addComponent(UIOpacity).opacity = 48;
    const selectedFrame = createNode(
      cardRoot,
      "SelectedFrame",
      CARD_WIDTH + SELECTED_FRAME_OUTSET,
      CARD_HEIGHT + SELECTED_FRAME_OUTSET,
      0,
      0,
    );
    drawSelectedFrame(selectedFrame, CARD_WIDTH + SELECTED_FRAME_OUTSET, CARD_HEIGHT + SELECTED_FRAME_OUTSET);
    const cardFrameNode = createNode(cardRoot, "CardFrame", CARD_WIDTH, CARD_HEIGHT, 0, 0);
    const cardFrame = ensureSprite(cardFrameNode);
    cardFrame.sizeMode = Sprite.SizeMode.CUSTOM;
    const artworkMask = createNode(cardRoot, "ArtworkMask", ARTWORK_MASK_WIDTH, ARTWORK_MASK_HEIGHT, 0, 64);
    const artworkMaskComponent = artworkMask.addComponent(Mask);
    artworkMaskComponent.type = Mask.Type.GRAPHICS_RECT;
    const artworkNode = createNode(artworkMask, "ArtworkPreview", ARTWORK_PREVIEW_WIDTH, ARTWORK_PREVIEW_HEIGHT, 0, 0);
    const artworkPreview = ensureSprite(artworkNode);
    artworkPreview.sizeMode = Sprite.SizeMode.CUSTOM;

    const titleNode = createNode(cardRoot, "LevelTitleLabel", 380, 44, 0, -176);
    const titleLabel = titleNode.addComponent(Label);
    styleLabel(titleLabel, 28, 34, TEXT_BROWN, true);
    const statusRoot = createNode(cardRoot, "StatusRoot", 250, 32, 0, -208);
    const statusIconNode = createNode(statusRoot, "StatusIcon", 24, 24, -74, 0);
    const statusIcon = statusIconNode.addComponent(Label);
    styleLabel(statusIcon, 18, 22, STATUS_GREEN, false);
    const statusLabelNode = createNode(statusRoot, "StatusLabel", 160, 26, 24, 0);
    const statusLabel = statusLabelNode.addComponent(Label);
    styleLabel(statusLabel, 17, 22, TEXT_BROWN, false);

    const pageIndicatorRoot = createNode(section, "PageIndicatorRoot", 220, 24, 0, -304);

    const playNode = createNode(this.node, "PlayButton", PLAY_WIDTH, PLAY_HEIGHT, 0, -374);
    const playButton = ensureButton(playNode);
    const playBackgroundNode = createNode(playNode, "ButtonBackground", PLAY_WIDTH, PLAY_HEIGHT, 0, 0);
    const playBackground = ensureSprite(playBackgroundNode);
    playBackground.sizeMode = Sprite.SizeMode.CUSTOM;
    const playLabelNode = createNode(playNode, "PlayLabel", 150, 44, -24, 1);
    const playLabel = playLabelNode.addComponent(Label);
    playLabel.string = "Play";
    styleLabel(playLabel, 34, 40, TEXT_CREAM, true);
    const playIconNode = createNode(playNode, "PlayIcon", PLAY_ICON_SIZE, PLAY_ICON_SIZE, 84, 0);
    const playIcon = ensureSprite(playIconNode);
    playIcon.sizeMode = Sprite.SizeMode.CUSTOM;

    const navRoot = createNode(this.node, "HomeEntryBar", 650, 72, 0, -500);
    const collectionButton = createTextButton(navRoot, "CollectionButton", HOME_COLLECTION_TEXT, -110, 0);
    const collectionLabel = collectionButton.getComponentInChildren(Label) ?? createTextLabel(collectionButton.node, "CollectionLabel", 128, 24, 0, 0, 18, TEXT_BROWN, false);
    const shopButton = createTextButton(navRoot, "ShopButton", HOME_SHOP_TEXT, 110, 0);
    const shopLabel = shopButton.getComponentInChildren(Label) ?? createTextLabel(shopButton.node, "ShopLabel", 128, 24, 0, 0, 18, TEXT_BROWN, false);
    const placeholderLabel = createTextLabel(this.node, "HomePlaceholderLabel", 520, 34, 0, -570, 18, TEXT_MUTED, false);
    placeholderLabel.string = "";

    this.playButton = playButton;
    this.playLabel = playLabel;
    this.settingsButton = settingsButton;
    this.continueButton = null;
    this.levelSelectButton = null;
    this.levelSelectionPanel = pageIndicatorRoot;

    return {
      rootOpacity,
      header,
      logo,
      staminaLabel,
      coinsLabel,
      settingsButton,
      settingsIcon,
      section,
      leftArrowButton,
      leftArrowIcon,
      rightArrowButton,
      rightArrowIcon,
      cardRoot,
      cardFrame,
      artworkPreview,
      titleLabel,
      statusIcon,
      statusLabel,
      pageIndicatorRoot,
      playButton,
      playBackground,
      playLabel,
      playIcon,
      collectionButton,
      collectionLabel,
      shopButton,
      shopLabel,
      placeholderLabel,
    };
  }

  private applyFrames(): void {
    if (this.frames === null || this.nodes === null) {
      return;
    }
    const backgroundSprite = this.node.getChildByPath("Background/BackgroundSprite")?.getComponent(Sprite) ?? null;
    if (backgroundSprite !== null) {
      backgroundSprite.spriteFrame = this.frames.background;
      setNodeSize(backgroundSprite.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    }
    this.nodes.logo.spriteFrame = this.frames.logo;
    this.nodes.settingsIcon.spriteFrame = this.frames.settings;
    this.nodes.leftArrowIcon.spriteFrame = this.frames.arrowRight;
    this.nodes.rightArrowIcon.spriteFrame = this.frames.arrowRight;
    this.nodes.cardFrame.spriteFrame = this.frames.cardFrame;
    this.nodes.artworkPreview.spriteFrame = this.frames.preview001;
    this.nodes.playBackground.spriteFrame = this.frames.buttonPrimary;
    this.nodes.playIcon.spriteFrame = this.frames.playIcon;
    setNodeSize(this.nodes.logo.node, 500, 333);
    setNodeSize(this.nodes.settingsIcon.node, 70, 70);
    setNodeSize(this.nodes.leftArrowIcon.node, 68, 68);
    setNodeSize(this.nodes.rightArrowIcon.node, 68, 68);
    setNodeSize(this.nodes.cardFrame.node, CARD_WIDTH, CARD_HEIGHT);
    this.nodes.artworkPreview.node.setScale(1, 1, 1);
    setNodeSize(this.nodes.artworkPreview.node, ARTWORK_PREVIEW_WIDTH, ARTWORK_PREVIEW_HEIGHT);
    setNodeSize(this.nodes.playBackground.node, PLAY_WIDTH, PLAY_HEIGHT);
    setNodeSize(this.nodes.playIcon.node, PLAY_ICON_SIZE, PLAY_ICON_SIZE);
    this.renderResourceLabels();
  }

  private bindButtons(): void {
    this.clearButtons();
    if (this.nodes === null) {
      return;
    }
    this.leftHandler = () => this.changeSelectedIndex(-1);
    this.rightHandler = () => this.changeSelectedIndex(1);
    this.playHandler = () => this.playSelectedLevel();
    this.settingsHandler = () => this.openSettings();
    this.collectionHandler = () => this.showHomePlaceholder("图鉴入口已准备");
    this.shopHandler = () => this.showHomePlaceholder("商店暂未开放");
    bindClick(this.nodes.leftArrowButton, this.leftHandler, this);
    bindClick(this.nodes.rightArrowButton, this.rightHandler, this);
    bindClick(this.nodes.playButton, this.playHandler, this);
    bindClick(this.nodes.settingsButton, this.settingsHandler, this);
    bindClick(this.nodes.collectionButton, this.collectionHandler, this);
    bindClick(this.nodes.shopButton, this.shopHandler, this);
    this.bindPressTween(this.nodes.leftArrowButton.node);
    this.bindPressTween(this.nodes.rightArrowButton.node);
    this.bindPressTween(this.nodes.playButton.node);
    this.bindPressTween(this.nodes.settingsButton.node);
    this.bindPressTween(this.nodes.collectionButton.node);
    this.bindPressTween(this.nodes.shopButton.node);
  }

  private clearButtons(): void {
    if (this.nodes !== null) {
      unbindClick(this.nodes.leftArrowButton, this.leftHandler, this);
      unbindClick(this.nodes.rightArrowButton, this.rightHandler, this);
      unbindClick(this.nodes.playButton, this.playHandler, this);
      unbindClick(this.nodes.settingsButton, this.settingsHandler, this);
      unbindClick(this.nodes.collectionButton, this.collectionHandler, this);
      unbindClick(this.nodes.shopButton, this.shopHandler, this);
    }
    for (const [node, handlers] of this.pressHandlers) {
      if (node.isValid) {
        node.off(Node.EventType.TOUCH_START, handlers[0], this);
        node.off(Node.EventType.TOUCH_END, handlers[1], this);
        node.off(Node.EventType.TOUCH_CANCEL, handlers[1], this);
      }
    }
    this.pressHandlers.clear();
    this.leftHandler = null;
    this.rightHandler = null;
    this.playHandler = null;
    this.settingsHandler = null;
    this.collectionHandler = null;
    this.shopHandler = null;
  }

  private bindPressTween(node: Node): void {
    const press = () => {
      const button = node.getComponent(Button);
      if (button === null || !button.interactable) {
        return;
      }
      Tween.stopAllByTarget(node);
      tween(node).to(0.08, { scale: new Vec3(0.95, 0.95, 1) }).start();
    };
    const release = () => {
      Tween.stopAllByTarget(node);
      tween(node).to(0.12, { scale: Vec3.ONE }).start();
    };
    node.on(Node.EventType.TOUCH_START, press, this);
    node.on(Node.EventType.TOUCH_END, release, this);
    node.on(Node.EventType.TOUCH_CANCEL, release, this);
    this.pressHandlers.set(node, [press, release]);
  }

  private changeSelectedIndex(delta: number): void {
    const nextIndex = this.selectedIndex + delta;
    if (nextIndex < 0 || nextIndex >= this.catalog.length) {
      return;
    }
    this.selectedIndex = nextIndex;
    this.renderSelectedLevel(getRuntimeGameNavigator().loadProgress(), true);
  }

  private playSelectedLevel(): void {
    if (this.isNavigating) {
      return;
    }
    const entry = this.catalog[this.selectedIndex];
    const state = getLevelUnlockStates(getRuntimeGameNavigator().loadProgress())[this.selectedIndex];
    if (entry === undefined || state === undefined || !state.unlocked) {
      return;
    }
    this.isNavigating = true;
    this.updateButtonStates(state);
    void getRuntimeGameNavigator().startLevel(entry.levelId).then((result) => {
      if (!result.accepted) {
        error("[HomeRoot] Play navigation rejected", result);
        this.isNavigating = false;
        this.updateButtonStates(state);
      }
    }).catch((reason: unknown) => {
      error("[HomeRoot] Play navigation failed", reason);
      this.isNavigating = false;
      this.updateButtonStates(state);
    });
  }

  private openSettings(): void {
    if (this.settingsOpen) {
      return;
    }
    this.settingsOpen = true;
    const settings = getRuntimeSettingsData().toggle("sound");
    if (this.nodes !== null) {
      this.nodes.statusLabel.string = `Sound ${settings.soundEnabled ? "On" : "Off"}  Vibration ${settings.vibrationEnabled ? "On" : "Off"}`;
      this.nodes.statusLabel.color = TEXT_BROWN;
    }
    this.scheduleOnce(() => {
      this.settingsOpen = false;
      this.refresh();
    }, 0.2);
  }

  private renderResourceLabels(): void {
    if (this.nodes === null) {
      return;
    }
    const resourcesStore = getRuntimeResourceStore();
    this.nodes.staminaLabel.string = `${HOME_STAMINA_TEXT} ${resourcesStore.getCurrentStamina()}`;
    this.nodes.coinsLabel.string = `${HOME_COINS_TEXT} ${resourcesStore.getCurrentCoins()}`;
    this.nodes.collectionLabel.string = HOME_COLLECTION_TEXT;
    this.nodes.shopLabel.string = HOME_SHOP_TEXT;
  }

  private showHomePlaceholder(message: string): void {
    if (this.nodes === null) {
      return;
    }
    this.nodes.placeholderLabel.string = message;
    this.scheduleOnce(() => {
      if (this.nodes !== null) {
        this.nodes.placeholderLabel.string = "";
      }
    }, 1.6);
  }

  private renderSelectedLevel(progress: GameProgress, animate: boolean): void {
    if (this.nodes === null) {
      return;
    }
    const entry = this.catalog[this.selectedIndex];
    const state = getLevelUnlockStates(progress)[this.selectedIndex];
    if (entry === undefined || state === undefined) {
      return;
    }
    this.nodes.titleLabel.string = getDisplayLevelText(entry);
    this.nodes.statusIcon.string = state.completed ? "✓" : state.unlocked ? "" : "X";
    this.nodes.statusLabel.string = state.completed ? "Completed" : state.unlocked ? "Not Completed" : "Locked";
    this.nodes.statusIcon.string = state.completed ? "\u2713" : state.unlocked ? "" : "X";
    this.nodes.statusIcon.color = state.completed ? STATUS_GREEN : state.unlocked ? STATUS_ORANGE : STATUS_LOCKED;
    this.nodes.statusLabel.color = state.unlocked ? TEXT_BROWN : TEXT_MUTED;
    this.nodes.artworkPreview.color = state.unlocked ? WHITE : DISABLED_TINT;
    this.renderPageDots();
    this.updateButtonStates(state);
    this.updateResourceButtonStates();
    if (animate) {
      this.playCardSwitchTween();
    }
  }

  private renderPageDots(): void {
    if (this.nodes === null || this.frames === null) {
      return;
    }
    const root = this.nodes.pageIndicatorRoot;
    root.removeAllChildren();
    const count = this.catalog.length;
    const spacing = 34;
    const startX = -((count - 1) * spacing) / 2;
    for (let index = 0; index < count; index += 1) {
      const active = index === this.selectedIndex;
      const dot = createNode(root, `PageDot${index + 1}`, 22, 22, startX + index * spacing, 0);
      applyDotVisual(dot, active ? this.frames.dotActive : this.frames.dotInactive, active);
    }
  }

  private updateButtonStates(state: LevelUnlockState): void {
    if (this.nodes === null) {
      return;
    }
    const leftEnabled = this.selectedIndex > 0;
    const rightEnabled = this.selectedIndex < this.catalog.length - 1;
    const playEnabled = state.unlocked && !this.isNavigating;
    setButtonEnabled(this.nodes.leftArrowButton, this.nodes.leftArrowIcon.node, leftEnabled);
    setButtonEnabled(this.nodes.rightArrowButton, this.nodes.rightArrowIcon.node, rightEnabled);
    setButtonEnabled(this.nodes.playButton, this.nodes.playButton.node, playEnabled);
    this.nodes.playLabel.color = playEnabled ? TEXT_CREAM : new Color(238, 226, 206, 175);
    this.nodes.playIcon.color = playEnabled ? WHITE : DISABLED_TINT;
  }

  private updateResourceButtonStates(): void {
    if (this.nodes === null) {
      return;
    }
    setButtonEnabled(this.nodes.collectionButton, this.nodes.collectionButton.node, true);
    setButtonEnabled(this.nodes.shopButton, this.nodes.shopButton.node, true);
  }

  private resolveSelectedIndex(progress: GameProgress): number {
    const selection = getHomeSelectionState(progress);
    const index = this.catalog.findIndex((entry) => entry.levelId === selection.selectedLevelId);
    return index >= 0 ? index : 0;
  }

  private hideLegacyNodes(): void {
    for (const child of [...this.node.children]) {
      child.active = false;
    }
  }

  private playEntranceTween(): void {
    if (this.nodes === null) {
      return;
    }
    Tween.stopAllByTarget(this.node);
    Tween.stopAllByTarget(this.nodes.logo.node);
    Tween.stopAllByTarget(this.nodes.cardRoot);
    Tween.stopAllByTarget(this.nodes.playButton.node);
    this.nodes.rootOpacity.opacity = 0;
    this.nodes.logo.node.setPosition(0, 38, 0);
    this.nodes.cardRoot.setPosition(0, 20, 0);
    this.nodes.playButton.node.setScale(0.9, 0.9, 1);
    tween(this.nodes.rootOpacity).to(0.24, { opacity: 255 }).start();
    tween(this.nodes.logo.node).to(0.28, { position: new Vec3(0, 10, 0) }).start();
    tween(this.nodes.cardRoot).to(0.34, { position: new Vec3(0, 44, 0) }).start();
    tween(this.nodes.playButton.node).to(0.22, { scale: Vec3.ONE }).start();
  }

  private playCardSwitchTween(): void {
    if (this.nodes === null) {
      return;
    }
    const opacity = this.nodes.cardRoot.getComponent(UIOpacity) ?? this.nodes.cardRoot.addComponent(UIOpacity);
    Tween.stopAllByTarget(this.nodes.cardRoot);
    Tween.stopAllByTarget(opacity);
    opacity.opacity = 150;
    this.nodes.cardRoot.setPosition(this.selectedIndex === 0 ? -12 : 12, 44, 0);
    tween(opacity).to(0.16, { opacity: 255 }).start();
    tween(this.nodes.cardRoot).to(0.16, { position: new Vec3(0, 44, 0) }).start();
  }
}

async function loadHomeFrames(bound: HomeRoot): Promise<HomeFrames> {
  return Object.freeze({
    background: bound.backgroundFrame ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.background),
    logo: bound.logoFrame ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.logo),
    cardFrame: bound.cardFrameAsset ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.cardFrame),
    buttonPrimary: bound.buttonPrimaryFrame ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.buttonPrimary),
    settings: bound.settingsFrame ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.settings),
    arrowRight: bound.arrowRightFrame ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.arrowRight),
    dotActive: bound.dotActiveFrame ?? await loadOptionalSpriteFrame(HOME_RESOURCE_PATHS.dotActive),
    dotInactive: bound.dotInactiveFrame ?? await loadOptionalSpriteFrame(HOME_RESOURCE_PATHS.dotInactive),
    playIcon: bound.playIconFrame ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.playIcon),
    preview001: bound.preview001Frame ?? await loadSpriteFrame(HOME_RESOURCE_PATHS.preview001),
  });
}

async function loadOptionalSpriteFrame(path: string): Promise<SpriteFrame | null> {
  try {
    return await loadSpriteFrame(path);
  } catch {
    return null;
  }
}

async function loadSpriteFrame(path: string): Promise<SpriteFrame> {
  const candidates = [
    path,
    `${path}.png`,
    `${path}/spriteFrame`,
    `${path}.png/spriteFrame`,
  ];
  for (const candidate of candidates) {
    const frame = await tryLoadSpriteFrame(candidate);
    if (frame !== null) {
      return frame;
    }
  }

  throw new Error(`Missing SpriteFrame ${path}`);
}

async function tryLoadSpriteFrame(path: string): Promise<SpriteFrame | null> {
  return new Promise((resolve) => {
    (resources as any).load(path, SpriteFrame, (loadError: unknown, asset: SpriteFrame | null) => {
      if (loadError !== null || asset === null) {
        resolve(null);
        return;
      }
      resolve(asset);
    });
  });
}

function applyDotVisual(node: Node, frame: SpriteFrame | null, active: boolean): void {
  if (frame !== null) {
    const sprite = ensureSprite(node);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    setNodeSize(node, active ? 18 : 16, active ? 18 : 16);
    return;
  }
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = active ? new Color(85, 191, 162, 255) : new Color(121, 88, 66, 120);
  graphics.circle(0, 0, active ? 10 : 8);
  graphics.fill();
}

function drawSelectedFrame(node: Node, width: number, height: number): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.lineWidth = 3;
  graphics.strokeColor = new Color(72, 199, 166, 120);
  graphics.roundRect(-width / 2, -height / 2, width, height, 14);
  graphics.stroke();
}

function setNodeSize(node: Node, width: number, height: number): void {
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
}

function createNode(parent: Node, name: string, width: number, height: number, x: number, y: number): Node {
  const node = new Node(name);
  node.layer = parent.layer;
  parent.addChild(node);
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(width, height);
  return node;
}

function ensureSprite(node: Node): Sprite {
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  sprite.color = WHITE;
  return sprite;
}

function ensureButton(node: Node): Button {
  const button = node.getComponent(Button) ?? node.addComponent(Button);
  button.transition = Button.Transition.NONE;
  button.interactable = true;
  return button;
}

function createTextButton(parent: Node, name: string, text: string, x: number, y: number): Button {
  const node = createNode(parent, name, 184, 56, x, y);
  const button = ensureButton(node);
  const background = createNode(node, "Background", 184, 56, 0, 0);
  const graphics = background.getComponent(Graphics) ?? background.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = new Color(255, 244, 214, 220);
  graphics.strokeColor = new Color(176, 151, 116, 180);
  graphics.lineWidth = 2;
  graphics.roundRect(-92, -28, 184, 56, 18);
  graphics.fill();
  graphics.stroke();
  const labelNode = createTextLabel(node, `${name}Label`, 160, 28, 0, 0, 18, TEXT_BROWN, false);
  labelNode.string = text;
  return button;
}

function createPillNode(parent: Node, name: string, width: number, height: number, x: number, y: number, fillColor: Color): Node {
  const node = createNode(parent, name, width, height, x, y);
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = fillColor;
  graphics.strokeColor = new Color(176, 151, 116, 160);
  graphics.lineWidth = 2;
  graphics.roundRect(-width / 2, -height / 2, width, height, 18);
  graphics.fill();
  graphics.stroke();
  return node;
}

function createTextLabel(parent: Node, name: string, width: number, height: number, x: number, y: number, fontSize: number, color: Color, outline: boolean): Label {
  const node = createNode(parent, name, width, height, x, y);
  const label = node.addComponent(Label);
  label.string = "";
  styleLabel(label, fontSize, fontSize + 4, color, outline);
  return label;
}

function styleLabel(label: Label, fontSize: number, lineHeight: number, color: Color, outline: boolean): void {
  label.fontSize = fontSize;
  label.lineHeight = lineHeight;
  label.color = color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.enableOutline = outline;
  label.outlineColor = new Color(90, 61, 35, 150);
  label.outlineWidth = outline ? 3 : 0;
  label.enableShadow = true;
  label.shadowColor = new Color(84, 58, 39, 90);
  label.shadowOffset.set(1, -2);
  label.shadowBlur = 1;
}

function bindClick(button: Button, handler: () => void, target: Component): void {
  button.node.on(Button.EventType.CLICK, handler, target);
}

function unbindClick(button: Button, handler: (() => void) | null, target: Component): void {
  if (handler !== null && button.node.isValid) {
    button.node.off(Button.EventType.CLICK, handler, target);
  }
}

function setButtonEnabled(button: Button, visualNode: Node, enabled: boolean): void {
  button.interactable = enabled;
  const opacity = visualNode.getComponent(UIOpacity) ?? visualNode.addComponent(UIOpacity);
  opacity.opacity = enabled ? 255 : 116;
}
