import { _decorator, Button, Color, Component, error, Label, Node, Sprite, UITransform } from "cc";
import { BUILT_IN_LEVEL_CATALOG, getDisplayLevelText, getFirstLevelEntry, type LevelCatalogEntry } from "../../domain/config/LevelCatalog";
import { getHomeSelectionState, getLevelUnlockStates, type GameProgress, type LevelUnlockState } from "../../domain/progress/GameProgress";
import { getRuntimeGameNavigator } from "./RuntimeGameServices";

const { ccclass, property } = _decorator;

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

  protected onLoad(): void {
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
    this.renderLevelItems(progress);
  }

  private bindButtons(): void {
    this.clearButtons();
    const navigator = getRuntimeGameNavigator();
    this.renderLevelItems(navigator.loadProgress());
    this.playHandler = this.createNavigationHandler("Play", () => navigator.startLevel(this.selectedLevelId));
    this.bindButton("PlayButton", this.playButton, this.playHandler);
    this.settingsHandler = () => {
      this.refresh();
    };
    this.bindButton("SettingsButton", this.settingsButton, this.settingsHandler);
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
    for (const child of [...panel.children]) {
      if (child.name === "LevelTitle" || child.name === "LevelItemRoot" || child.name === "CompletedMark") {
        panel.removeChild(child);
        child.destroy();
      }
    }
    const states = getLevelUnlockStates(progress);
    const itemRoot = new Node("LevelItemRoot");
    itemRoot.addComponent(UITransform).setContentSize(240, 140);
    panel.addChild(itemRoot);
    itemRoot.setPosition(0, -12, 0);
    for (let index = 0; index < BUILT_IN_LEVEL_CATALOG.length; index += 1) {
      const entry = BUILT_IN_LEVEL_CATALOG[index];
      const state = states[index];
      if (state === undefined) {
        continue;
      }
      const item = this.createLevelItem(entry, state);
      itemRoot.addChild(item);
      item.setPosition(index * 250 - ((BUILT_IN_LEVEL_CATALOG.length - 1) * 125), 0, 0);
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
  }

  private createLevelSelectionPanel(): Node {
    const panel = new Node("LevelSelectionPanel");
    panel.addComponent(UITransform).setContentSize(620, 220);
    panel.setPosition(0, -70, 0);
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
      const sprite = item.getComponent(Sprite);
      if (sprite !== null) {
        sprite.color = entry.levelId === selectedLevelId ? new Color(248, 186, 73, 255) : new Color(47, 183, 164, 255);
      }
    }
  }

  private createLevelItem(entry: LevelCatalogEntry, state: LevelUnlockState): Node {
    const item = new Node(`LevelItem${entry.displayNumber}`);
    item.addComponent(UITransform).setContentSize(220, 112);
    item.addComponent(Sprite).color = entry.levelId === this.selectedLevelId
      ? new Color(248, 186, 73, 255)
      : new Color(47, 183, 164, 255);
    const button = item.addComponent(Button);
    button.interactable = state.unlocked;
    const labelNode = new Node("Label");
    labelNode.addComponent(UITransform).setContentSize(190, 40);
    const label = labelNode.addComponent(Label);
    label.string = getDisplayLevelText(entry);
    label.fontSize = 26;
    label.lineHeight = 32;
    item.addChild(labelNode);
    if (state.completed) {
      const completed = new Node("CompletedMark");
      completed.addComponent(UITransform).setContentSize(190, 24);
      const completedLabel = completed.addComponent(Label);
      completedLabel.string = "Completed";
      completedLabel.fontSize = 16;
      completedLabel.lineHeight = 20;
      completed.setPosition(0, -34, 0);
      item.addChild(completed);
    }
    return item;
  }
}
