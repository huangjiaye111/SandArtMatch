import { _decorator, Button, Color, Component, error, Graphics, Label, Node, resources, Sprite, SpriteFrame, UITransform } from "cc";
import { BUILT_IN_LEVEL_CATALOG, getDisplayLevelText, getFirstLevelEntry, type LevelCatalogEntry } from "../../domain/config/LevelCatalog";
import { getHomeSelectionState, getLevelUnlockStates, type GameProgress, type LevelUnlockState } from "../../domain/progress/GameProgress";
import { getRuntimeGameNavigator } from "./RuntimeGameServices";

const { ccclass, property } = _decorator;

const HOME_BG_SIZE = Object.freeze({ width: 750, height: 1334 });
const TEXT_COLOR = new Color(42, 50, 56, 255);
const TEXT_MUTED = new Color(106, 122, 116, 255);
const WHITE_OUTLINE = new Color(255, 255, 255, 210);
const SHADOW = new Color(38, 48, 45, 80);
const PANEL_FILL = new Color(255, 250, 236, 232);
const PANEL_STROKE = new Color(181, 158, 115, 205);
const PRIMARY_FILL = new Color(47, 183, 164, 255);
const PRIMARY_STROKE = new Color(24, 31, 29, 120);
const SECONDARY_FILL = new Color(232, 239, 235, 255);
const SECONDARY_STROKE = new Color(158, 171, 162, 180);
const GOLD = new Color(245, 184, 75, 255);
const TEAL = new Color(47, 183, 164, 255);
const SKY = new Color(72, 167, 248, 255);
const CORAL = new Color(242, 124, 138, 255);
const GREEN = new Color(88, 200, 137, 255);
const DISABLED = new Color(180, 188, 184, 255);

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

  private playHandler: (() => void) | null = null;
  private settingsHandler: (() => void) | null = null;
  private selectedLevelId = getFirstLevelEntry().levelId;
  private readonly levelHandlers = new Map<Node, () => void>();
  private backdropLoadStarted = false;

  protected onLoad(): void {
    this.ensureHomePresentation();
    void this.loadHomeBackdrop();
    this.refresh();
  }

  protected onEnable(): void {
    this.bindButtons();
  }

  protected onDisable(): void {
    this.clearButtons();
  }

  protected onDestroy(): void {
    this.clearButtons();
  }

  public refresh(): void {
    const navigator = getRuntimeGameNavigator();
    const progress = navigator.loadProgress();
    this.selectedLevelId = getHomeSelectionState(progress).selectedLevelId;
    if (this.continueButton !== null) {
      this.continueButton.node.active = false;
    }
    if (this.levelSelectButton !== null) {
      this.levelSelectButton.node.active = false;
    }
    if (this.playLabel !== null) {
      this.playLabel.string = "Play";
    }
    this.ensureHomePresentation();
    this.renderLevelItems(progress);
  }

  private bindButtons(): void {
    this.clearButtons();
    const navigator = getRuntimeGameNavigator();
    this.renderLevelItems(navigator.loadProgress());
    this.playHandler = this.createNavigationHandler("Play", () => navigator.startLevel(this.selectedLevelId));
    this.bindButton("PlayButton", this.playButton, this.playHandler);
    this.settingsHandler = () => this.refresh();
    this.bindButton("SettingsButton", this.settingsButton, this.settingsHandler);
  }

  private ensureHomePresentation(): void {
    this.node.getComponent(UITransform)?.setContentSize(HOME_BG_SIZE.width, HOME_BG_SIZE.height);
    this.ensureBackdropRoot().setSiblingIndex(0);
    this.ensureHeroRoot().setSiblingIndex(1);

    const title = this.node.getChildByName("Title");
    if (title !== null) {
      title.setPosition(0, 384, 0);
      title.setSiblingIndex(8);
      const label = title.getComponent(Label);
      if (label !== null) {
        label.string = "Sand Art Match";
        styleLabel(label, 46, 54, TEXT_COLOR, WHITE_OUTLINE);
      }
      setContentSize(title, 560, 72);
    }

    this.playButton?.node.setPosition(0, -500, 0);
    this.settingsButton?.node.setPosition(278, 520, 0);
    this.settingsButton?.node.setScale(0.86, 0.86, 1);
    this.stylePrimaryButton(this.playButton, 420, 96);
    this.styleSecondaryButton(this.settingsButton, 132, 58, 20);
    this.styleSecondaryButton(this.continueButton, 360, 76, 24);
    this.styleSecondaryButton(this.levelSelectButton, 360, 76, 24);
  }

  private ensureBackdropRoot(): Node {
    let root = this.node.getChildByName("HomeBackdropRoot");
    if (root === null) {
      root = new Node("HomeBackdropRoot");
      this.node.addChild(root);
      root.addComponent(UITransform);
    }
    root.active = true;
    root.setPosition(0, 0, 0);
    setContentSize(root, HOME_BG_SIZE.width, HOME_BG_SIZE.height);

    const fallback = ensureChild(root, "FallbackFill");
    fallback.setSiblingIndex(0);
    fallback.setPosition(0, 0, 0);
    setContentSize(fallback, HOME_BG_SIZE.width, HOME_BG_SIZE.height);
    fallback.getComponent(Graphics) ?? fallback.addComponent(Graphics);
    drawHomeBackdrop(fallback.getComponent(Graphics));

    const image = ensureChild(root, "LoadedBackdrop");
    image.setSiblingIndex(1);
    image.setPosition(0, 0, 0);
    setContentSize(image, HOME_BG_SIZE.width, HOME_BG_SIZE.height);
    const sprite = image.getComponent(Sprite) ?? image.addComponent(Sprite);
    if (sprite !== null) {
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.color = new Color(255, 255, 255, 255);
    }
    return root;
  }

  private ensureHeroRoot(): Node {
    let root = this.node.getChildByName("HomeHeroRoot");
    if (root === null) {
      root = new Node("HomeHeroRoot");
      this.node.addChild(root);
      root.addComponent(UITransform);
      root.addComponent(Graphics);
    }
    root.active = true;
    root.setPosition(0, 120, 0);
    setContentSize(root, 620, 330);
    drawHomeHero(root.getComponent(Graphics));
    return root;
  }

  private async loadHomeBackdrop(): Promise<void> {
    if (this.backdropLoadStarted) {
      return;
    }
    this.backdropLoadStarted = true;
    try {
      const frame = await new Promise<SpriteFrame>((resolve, reject) => {
        resources.load("home/home_workshop_bg/spriteFrame", SpriteFrame, (loadError, asset) => {
          if (loadError !== null || asset === null) {
            reject(loadError ?? new Error("Home backdrop asset is missing."));
            return;
          }
          resolve(asset);
        });
      });
      const root = this.ensureBackdropRoot();
      const sprite = root.getChildByName("LoadedBackdrop")?.getComponent(Sprite) ?? null;
      if (sprite !== null) {
        sprite.spriteFrame = frame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      }
    } catch (reason: unknown) {
      error("[HomeRoot] home backdrop load failed", reason);
    }
  }

  private createNavigationHandler(action: string, navigate: () => Promise<unknown>): () => void {
    return () => {
      void navigate().then((result) => {
        if (typeof result === "object" && result !== null && "accepted" in result && result.accepted !== true) {
          error(`[HomeRoot] ${action} navigation rejected`, result);
        }
      }).catch((reason: unknown) => {
        error(`[HomeRoot] ${action} navigation failed`, reason);
      });
    };
  }

  private bindButton(name: string, button: Button | null, handler: () => void): void {
    if (button === null) {
      error(`[HomeRoot] ${name} reference is missing.`);
      return;
    }
    button.node.on(Button.EventType.CLICK, handler, this);
  }

  private clearButtons(): void {
    this.clearLevelItemHandlers();
    const playNode = this.playButton?.node;
    if (playNode !== null && playNode.isValid && this.playHandler !== null) {
      playNode.off(Button.EventType.CLICK, this.playHandler, this);
    }
    const settingsNode = this.settingsButton?.node;
    if (settingsNode !== null && settingsNode.isValid && this.settingsHandler !== null) {
      settingsNode.off(Button.EventType.CLICK, this.settingsHandler, this);
    }
    this.playHandler = null;
    this.settingsHandler = null;
  }

  private clearLevelItemHandlers(): void {
    for (const [node, handler] of this.levelHandlers) {
      if (node.isValid) {
        node.off(Button.EventType.CLICK, handler, this);
      }
    }
    this.levelHandlers.clear();
  }

  private renderLevelItems(progress: GameProgress): void {
    const navigator = getRuntimeGameNavigator();
    this.clearLevelItemHandlers();
    const panel = this.levelSelectionPanel ?? this.node.getChildByName("LevelSelectionPanel") ?? this.createLevelSelectionPanel();
    panel.setPosition(0, -218, 0);
    setContentSize(panel, 640, 214);
    panel.setSiblingIndex(5);
    for (const child of [...panel.children]) {
      if (child.name.startsWith("Level") || child.name === "PanelFrame") {
        panel.removeChild(child);
        child.destroy();
      }
    }

    const frame = new Node("PanelFrame");
    frame.addComponent(UITransform).setContentSize(640, 214);
    frame.addComponent(Graphics);
    panel.addChild(frame);
    drawLevelPanel(frame.getComponent(Graphics));

    const titleNode = new Node("LevelPanelTitle");
    titleNode.addComponent(UITransform).setContentSize(540, 36);
    const title = titleNode.addComponent(Label);
    title.string = "Showcase Level";
    styleLabel(title, 22, 28, TEXT_COLOR, WHITE_OUTLINE);
    titleNode.setPosition(0, 68, 0);
    panel.addChild(titleNode);

    const states = getLevelUnlockStates(progress);
    const itemRoot = new Node("LevelItemRoot");
    itemRoot.addComponent(UITransform).setContentSize(560, 130);
    itemRoot.setPosition(0, -18, 0);
    panel.addChild(itemRoot);

    for (let index = 0; index < BUILT_IN_LEVEL_CATALOG.length; index += 1) {
      const entry = BUILT_IN_LEVEL_CATALOG[index];
      const state = states[index];
      if (state === undefined) {
        continue;
      }
      const item = this.createLevelItem(entry, state);
      itemRoot.addChild(item);
      item.setPosition(index * 570, 0, 0);
      const button = item.getComponent(Button);
      if (button !== null && state.unlocked) {
        const handler = () => {
          this.selectedLevelId = entry.levelId;
          const selection = navigator.selectLevel(entry.levelId);
          if (!selection.accepted) {
            return;
          }
          this.refreshLevelItemStyles(itemRoot, states, entry.levelId);
        };
        button.node.on(Button.EventType.CLICK, handler, this);
        this.levelHandlers.set(button.node, handler);
      }
    }
    this.refreshLevelItemStyles(itemRoot, states, this.selectedLevelId);
  }

  private createLevelSelectionPanel(): Node {
    const panel = new Node("LevelSelectionPanel");
    panel.addComponent(UITransform).setContentSize(640, 214);
    panel.setPosition(0, -218, 0);
    this.node.addChild(panel);
    return panel;
  }

  private refreshLevelItemStyles(root: Node, states: readonly LevelUnlockState[], selectedLevelId: string): void {
    for (let index = 0; index < root.children.length; index += 1) {
      const item = root.children[index];
      const state = states[index];
      const entry = BUILT_IN_LEVEL_CATALOG[index];
      if (state === undefined || entry === undefined) {
        continue;
      }
      const selected = entry.levelId === selectedLevelId;
      drawLevelCard(item.getComponent(Graphics), selected, state);
      styleLevelCard(item, selected, state);
    }
  }

  private createLevelItem(entry: LevelCatalogEntry, state: LevelUnlockState): Node {
    const item = new Node(`LevelItem${entry.displayNumber}`);
    item.addComponent(UITransform).setContentSize(560, 130);
    item.addComponent(Graphics);
    const button = item.addComponent(Button);
    button.interactable = state.unlocked;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.98;

    const titleNode = new Node("LevelTitle");
    titleNode.addComponent(UITransform).setContentSize(340, 42);
    const title = titleNode.addComponent(Label);
    title.string = getDisplayLevelText(entry);
    styleLabel(title, 28, 34, TEXT_COLOR, WHITE_OUTLINE);
    titleNode.setPosition(-126, 18, 0);
    item.addChild(titleNode);

    const stateNode = new Node("LevelState");
    stateNode.addComponent(UITransform).setContentSize(270, 30);
    const stateLabel = stateNode.addComponent(Label);
    stateLabel.string = state.completed ? "Completed" : state.recommended ? "Recommended" : state.unlocked ? "Ready" : "Locked";
    styleLabel(stateLabel, 16, 20, TEXT_MUTED, WHITE_OUTLINE);
    stateNode.setPosition(-126, -18, 0);
    item.addChild(stateNode);

    const noteNode = new Node("LevelNote");
    noteNode.addComponent(UITransform).setContentSize(300, 28);
    const noteLabel = noteNode.addComponent(Label);
    noteLabel.string = "Single showcase stage";
    styleLabel(noteLabel, 14, 18, TEXT_MUTED, WHITE_OUTLINE);
    noteNode.setPosition(-126, -44, 0);
    item.addChild(noteNode);

    const chip = new Node("LevelChip");
    chip.addComponent(UITransform).setContentSize(150, 34);
    chip.addComponent(Graphics);
    chip.setPosition(166, -2, 0);
    const chipLabelNode = new Node("LevelChipLabel");
    chipLabelNode.addComponent(UITransform).setContentSize(118, 24);
    const chipLabel = chipLabelNode.addComponent(Label);
    chipLabel.string = state.completed ? "Done" : state.recommended ? "Best" : state.unlocked ? "Open" : "Locked";
    styleLabel(chipLabel, 18, 22, TEXT_COLOR, WHITE_OUTLINE);
    chip.addChild(chipLabelNode);
    item.addChild(chip);

    drawLevelCard(item.getComponent(Graphics), entry.levelId === this.selectedLevelId, state);
    styleLevelCard(item, entry.levelId === this.selectedLevelId, state);
    return item;
  }

  private stylePrimaryButton(button: Button | null, width: number, height: number): void {
    if (button === null) {
      return;
    }
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    setContentSize(button.node, width, height);
    drawRoundedRect(ensureButtonBackground(button.node, width, height), width, height, 32, PRIMARY_FILL, PRIMARY_STROKE);
    const sprite = button.node.getComponent(Sprite);
    if (sprite !== null) {
      sprite.color = PRIMARY_FILL;
    }
    const label = button.node.getChildByName("Label")?.getComponent(Label) ?? this.playLabel;
    if (label !== null) {
      label.string = "Play";
      styleLabel(label, 30, 38, new Color(255, 255, 255, 255), new Color(38, 48, 45, 145));
      label.node.setPosition(0, 0, 0);
      setContentSize(label.node, width - 32, height - 18);
      label.node.setSiblingIndex(20);
    }
  }

  private styleSecondaryButton(button: Button | null, width: number, height: number, fontSize: number): void {
    if (button === null) {
      return;
    }
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    setContentSize(button.node, width, height);
    drawRoundedRect(ensureButtonBackground(button.node, width, height), width, height, 22, SECONDARY_FILL, SECONDARY_STROKE);
    const sprite = button.node.getComponent(Sprite);
    if (sprite !== null) {
      sprite.color = SECONDARY_FILL;
    }
    const icon = button.node.getChildByName("Icon");
    if (icon !== null) {
      icon.setPosition(-38, 0, 0);
      setContentSize(icon, 26, 26);
    }
    const label = button.node.getChildByName("Label")?.getComponent(Label) ?? null;
    if (label !== null) {
      styleLabel(label, fontSize, fontSize + 6, TEXT_COLOR, WHITE_OUTLINE);
      label.node.setPosition(icon === null ? 0 : 18, 0, 0);
      setContentSize(label.node, icon === null ? width - 18 : width - 54, height - 14);
      label.node.setSiblingIndex(20);
    }
  }
}

function ensureButtonBackground(node: Node, width: number, height: number): Graphics | null {
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

function ensureChild(parent: Node, name: string): Node {
  let child = parent.getChildByName(name);
  if (child === null) {
    child = new Node(name);
    child.addComponent(UITransform);
    parent.addChild(child);
  }
  return child;
}

function drawRoundedRect(graphics: Graphics | null, width: number, height: number, radius: number, fill: Color, stroke: Color): void {
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
  graphics.fillColor = new Color(255, 255, 255, 56);
  graphics.roundRect(-width / 2 + 18, height / 2 - 24, width - 36, 8, 4);
  graphics.fill();
}

function drawHomeBackdrop(graphics: Graphics | null): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = new Color(244, 246, 242, 255);
  graphics.rect(-375, -667, 750, 1334);
  graphics.fill();
  graphics.fillColor = new Color(249, 247, 235, 255);
  graphics.rect(-375, 400, 750, 267);
  graphics.fill();
  graphics.fillColor = new Color(231, 235, 227, 255);
  graphics.rect(-375, -667, 750, 506);
  graphics.fill();
  graphics.strokeColor = new Color(181, 158, 115, 50);
  graphics.lineWidth = 2;
  for (let y = -520; y <= -180; y += 68) {
    graphics.moveTo(-350, y);
    graphics.lineTo(350, y + 18);
    graphics.stroke();
  }
}

function drawHomeHero(graphics: Graphics | null): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();

  graphics.fillColor = new Color(255, 250, 236, 224);
  graphics.strokeColor = new Color(181, 158, 115, 150);
  graphics.lineWidth = 4;
  graphics.roundRect(-292, -110, 584, 224, 28);
  graphics.fill();
  graphics.stroke();
  graphics.fillColor = new Color(255, 255, 255, 90);
  graphics.roundRect(-262, 78, 524, 14, 7);
  graphics.fill();

  graphics.fillColor = new Color(238, 226, 196, 255);
  graphics.strokeColor = new Color(181, 158, 115, 190);
  graphics.lineWidth = 4;
  graphics.roundRect(-216, -42, 432, 92, 24);
  graphics.fill();
  graphics.stroke();
  graphics.fillColor = new Color(244, 236, 215, 255);
  graphics.roundRect(-188, -22, 376, 46, 18);
  graphics.fill();

  const dots = [GOLD, TEAL, SKY, CORAL];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const color = dots[(row + col) % dots.length];
      graphics.fillColor = new Color(color.r, color.g, color.b, 188);
      graphics.circle(-220 + col * 48 + ((row % 2) * 20), 34 - row * 24, 6);
      graphics.fill();
    }
  }

  const colors = [GOLD, SKY, GREEN, CORAL];
  const positions = [-156, -52, 52, 156];
  for (let index = 0; index < positions.length; index += 1) {
    const x = positions[index];
    const color = colors[index];
    graphics.fillColor = new Color(color.r, color.g, color.b, 212);
    graphics.ellipse(x, -104, 84, 24);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 220);
    graphics.ellipse(x, -86, 62, 14);
    graphics.fill();
  }
}

function drawLevelPanel(graphics: Graphics | null): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = PANEL_FILL;
  graphics.strokeColor = PANEL_STROKE;
  graphics.lineWidth = 4;
  graphics.roundRect(-320, -107, 640, 214, 34);
  graphics.fill();
  graphics.stroke();
  graphics.fillColor = new Color(255, 255, 255, 92);
  graphics.roundRect(-296, 66, 592, 16, 8);
  graphics.fill();
}

function drawLevelCard(graphics: Graphics | null, selected: boolean, state: LevelUnlockState): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = new Color(255, 250, 240, 244);
  graphics.strokeColor = selected ? GOLD : state.completed ? GREEN : state.recommended ? SKY : state.unlocked ? PANEL_STROKE : DISABLED;
  graphics.lineWidth = selected ? 5 : 3;
  graphics.roundRect(-280, -65, 560, 130, 26);
  graphics.fill();
  graphics.stroke();
  const accent = selected ? GOLD : state.completed ? GREEN : state.recommended ? SKY : DISABLED;
  graphics.fillColor = new Color(accent.r, accent.g, accent.b, 70);
  graphics.roundRect(-264, 42, 528, 8, 4);
  graphics.fill();
}

function styleLevelCard(item: Node, selected: boolean, state: LevelUnlockState): void {
  const chip = item.getChildByName("LevelChip");
  const chipGraphics = chip?.getComponent(Graphics) ?? null;
  if (chipGraphics === null) {
    return;
  }
  const fill = state.completed ? GREEN : selected ? GOLD : state.recommended ? SKY : new Color(247, 241, 224, 255);
  chipGraphics.clear();
  chipGraphics.fillColor = fill;
  chipGraphics.strokeColor = new Color(156, 138, 103, 180);
  chipGraphics.lineWidth = 2;
  chipGraphics.roundRect(-75, -17, 150, 34, 17);
  chipGraphics.fill();
  chipGraphics.stroke();
}

function styleLabel(label: Label, fontSize: number, lineHeight: number, color: Color, outlineColor: Color): void {
  label.color = color;
  label.fontSize = fontSize;
  label.lineHeight = lineHeight;
  label.enableOutline = true;
  label.outlineColor = outlineColor;
  label.outlineWidth = 2;
  label.enableShadow = true;
  label.shadowColor = SHADOW;
  label.shadowOffset.set(1, -1);
  label.shadowBlur = 1;
}

function setContentSize(node: Node | null | undefined, width: number, height: number): void {
  node?.getComponent(UITransform)?.setContentSize(width, height);
}
