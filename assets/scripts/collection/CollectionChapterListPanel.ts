import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import { CollectionChapterItem } from "./CollectionChapterItem";
import type { CollectionChapterListData, CollectionChapterListViewData } from "./CollectionChapterListData";

const { ccclass, property } = _decorator;

const PANEL_WIDTH = 750;
const PANEL_HEIGHT = 1334;

@ccclass("CollectionChapterListPanel")
export class CollectionChapterListPanel extends Component {
  @property(Label)
  public progressLabel: Label | null = null;

  @property(Button)
  public backButton: Button | null = null;

  @property(Node)
  public listRoot: Node | null = null;

  @property([CollectionChapterItem])
  public chapterItems: CollectionChapterItem[] = [];

  private dataSource: CollectionChapterListData | null = null;
  private backHandler: (() => void) | null = null;
  private readonly itemClickHandlers = new Map<CollectionChapterItem, () => void>();

  public setDataSource(dataSource: CollectionChapterListData): void {
    this.dataSource = dataSource;
    this.refreshChapterList();
  }

  public setBackHandler(handler: (() => void) | null): void {
    this.backHandler = handler;
    this.rebindBackButton();
  }

  public refreshChapterList(): void {
    this.ensureLayout();
    if (this.dataSource === null) {
      this.renderEmpty();
      return;
    }
    const viewData = this.dataSource.getViewData();
    this.renderProgress(viewData);
    this.renderChapters(viewData);
  }

  protected onDestroy(): void {
    this.clearItemHandlers();
    if (this.backButton !== null) {
      this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
    }
  }

  private renderEmpty(): void {
    if (this.progressLabel !== null) {
      this.progressLabel.string = "0/0";
    }
    for (const item of this.chapterItems) {
      item.node.active = false;
      item.setClickHandler(null);
    }
  }

  private renderProgress(viewData: CollectionChapterListViewData): void {
    if (this.progressLabel !== null) {
      this.progressLabel.string = `${viewData.totalProgress.totalCollected}/${viewData.totalProgress.totalArtworks}`;
    }
  }

  private renderChapters(viewData: CollectionChapterListViewData): void {
    const items = this.ensureItemCount(viewData.chapters.length);
    this.clearItemHandlers();
    items.forEach((item, index) => {
      const chapter = viewData.chapters[index];
      if (chapter === undefined) {
        item.node.active = false;
        return;
      }
      item.node.active = true;
      item.node.setPosition(index % 2 === 0 ? -142 : 142, 368 - Math.floor(index / 2) * 162, 0);
      item.setData(chapter);
      const clickHandler = () => {
        if (chapter.status === "locked") {
          return;
        }
        console.log(`[CollectionChapterListPanel] chapter clicked themeId=${chapter.themeId}`);
      };
      this.itemClickHandlers.set(item, clickHandler);
      item.setClickHandler(clickHandler);
    });
  }

  private ensureItemCount(count: number): CollectionChapterItem[] {
    while (this.chapterItems.length < count) {
      this.chapterItems.push(this.createItemNode(this.chapterItems.length));
    }
    return this.chapterItems;
  }

  private createItemNode(index: number): CollectionChapterItem {
    const root = new Node(`ChapterItem${index + 1}`);
    root.layer = this.node.layer;
    const transform = root.addComponent(UITransform);
    transform.setContentSize(260, 132);
    const sprite = root.addComponent(Sprite);
    sprite.color = new Color(229, 247, 237, 255);
    this.getListRoot().addChild(root);

    const button = root.addComponent(Button);
    button.transition = Button.Transition.NONE;

    const item = root.addComponent(CollectionChapterItem);
    item.button = button;
    item.backgroundSprite = sprite;

    const titleNode = createLabelNode(root, "TitleLabel", 180, 34, 0, 24);
    const progressNode = createLabelNode(root, "ProgressLabel", 120, 30, -54, -18);
    const statusNode = createLabelNode(root, "StatusLabel", 120, 30, 54, -18);
    item.titleLabel = titleNode.getComponent(Label);
    item.progressLabel = progressNode.getComponent(Label);
    item.statusLabel = statusNode.getComponent(Label);
    return item;
  }

  private renderEmptyBackground(): void {
    const root = this.getListRoot();
    const transform = root.getComponent(UITransform) ?? root.addComponent(UITransform);
    transform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
  }

  private ensureLayout(): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    this.renderEmptyBackground();
    this.rebindBackButton();
  }

  private getListRoot(): Node {
    if (this.listRoot !== null) {
      return this.listRoot;
    }
    let root = this.node.getChildByName("ListRoot");
    if (root === null) {
      root = new Node("ListRoot");
      root.layer = this.node.layer;
      this.node.addChild(root);
    }
    this.listRoot = root;
    return root;
  }

  private rebindBackButton(): void {
    if (this.backButton === null) {
      return;
    }
    this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
    this.backButton.node.on(Button.EventType.CLICK, this.onBackClick, this);
    this.backButton.interactable = true;
  }

  private onBackClick(): void {
    this.backHandler?.();
  }

  private clearItemHandlers(): void {
    for (const [item, handler] of this.itemClickHandlers.entries()) {
      item.setClickHandler(null);
      if (item.button !== null) {
        item.button.node.off(Button.EventType.CLICK, handler, item);
      }
    }
    this.itemClickHandlers.clear();
  }
}

function createLabelNode(parent: Node, name: string, width: number, height: number, x: number, y: number): Node {
  const node = new Node(name);
  node.layer = parent.layer;
  node.addComponent(UITransform).setContentSize(width, height);
  node.setPosition(x, y, 0);
  const label = node.addComponent(Label);
  label.string = "";
  label.fontSize = 22;
  label.lineHeight = 26;
  label.color = new Color(72, 62, 55, 255);
  parent.addChild(node);
  return node;
}
