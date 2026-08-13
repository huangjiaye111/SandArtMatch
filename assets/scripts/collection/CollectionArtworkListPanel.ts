import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import { CollectionArtworkItem } from "./CollectionArtworkItem";
import type { CollectionArtworkListData, CollectionArtworkListViewData } from "./CollectionArtworkListData";

const { ccclass, property } = _decorator;

const PANEL_WIDTH = 750;
const PANEL_HEIGHT = 1334;

@ccclass("CollectionArtworkListPanel")
export class CollectionArtworkListPanel extends Component {
  @property(Label)
  public themeNameLabel: Label | null = null;

  @property(Label)
  public progressLabel: Label | null = null;

  @property(Button)
  public backButton: Button | null = null;

  @property(Node)
  public listRoot: Node | null = null;

  @property([CollectionArtworkItem])
  public artworkItems: CollectionArtworkItem[] = [];

  private themeId = "";
  private dataSource: CollectionArtworkListData | null = null;
  private backHandler: (() => void) | null = null;
  private readonly itemClickHandlers = new Map<CollectionArtworkItem, () => void>();

  public setThemeId(themeId: string): void {
    this.themeId = themeId;
    this.refreshArtworkList();
  }

  public setDataSource(dataSource: CollectionArtworkListData): void {
    this.dataSource = dataSource;
    this.refreshArtworkList();
  }

  public setBackHandler(handler: (() => void) | null): void {
    this.backHandler = handler;
    this.rebindBackButton();
  }

  public refreshArtworkList(): void {
    this.ensureLayout();
    if (this.dataSource === null || this.themeId.length === 0) {
      this.renderEmpty();
      return;
    }
    const viewData = this.dataSource.getViewData(this.themeId);
    this.renderHeader(viewData);
    this.renderArtworks(viewData);
  }

  protected onDestroy(): void {
    this.clearItemHandlers();
    if (this.backButton !== null) {
      this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
    }
  }

  private renderEmpty(): void {
    if (this.themeNameLabel !== null) {
      this.themeNameLabel.string = "";
    }
    if (this.progressLabel !== null) {
      this.progressLabel.string = "0/0";
    }
    for (const item of this.artworkItems) {
      item.node.active = false;
      item.setClickHandler(null);
    }
  }

  private renderHeader(viewData: CollectionArtworkListViewData): void {
    if (this.themeNameLabel !== null) {
      this.themeNameLabel.string = viewData.themeDisplayName;
    }
    if (this.progressLabel !== null) {
      this.progressLabel.string = `${viewData.progress.collectedCount}/${viewData.progress.totalArtworks}`;
    }
  }

  private renderArtworks(viewData: CollectionArtworkListViewData): void {
    const items = this.ensureItemCount(viewData.artworks.length);
    this.clearItemHandlers();
    items.forEach((item, index) => {
      const artwork = viewData.artworks[index];
      if (artwork === undefined) {
        item.node.active = false;
        return;
      }
      item.node.active = true;
      item.node.setPosition(index % 2 === 0 ? -142 : 142, 426 - Math.floor(index / 2) * 204, 0);
      item.setData(artwork);
      if (artwork.status === "locked") {
        item.setClickHandler(null);
        return;
      }
      const clickHandler = () => {
        console.log(`[CollectionArtworkListPanel] artwork clicked artworkId=${artwork.artworkId}`);
      };
      this.itemClickHandlers.set(item, clickHandler);
      item.setClickHandler(clickHandler);
    });
  }

  private ensureItemCount(count: number): CollectionArtworkItem[] {
    while (this.artworkItems.length < count) {
      this.artworkItems.push(this.createItemNode(this.artworkItems.length));
    }
    return this.artworkItems;
  }

  private createItemNode(index: number): CollectionArtworkItem {
    const root = new Node(`ArtworkItem${index + 1}`);
    root.layer = this.node.layer;
    root.addComponent(UITransform).setContentSize(248, 168);
    const sprite = root.addComponent(Sprite);
    sprite.color = new Color(229, 247, 237, 255);
    this.getListRoot().addChild(root);

    const button = root.addComponent(Button);
    button.transition = Button.Transition.NONE;

    const item = root.addComponent(CollectionArtworkItem);
    item.button = button;
    item.backgroundSprite = sprite;

    const thumbnailNode = createLabelNode(root, "ThumbnailLabel", 196, 72, 0, 34, 20);
    const orderNode = createLabelNode(root, "OrderLabel", 64, 26, -70, -28, 20);
    const nameNode = createLabelNode(root, "NameLabel", 132, 28, 26, -28, 20);
    const statusNode = createLabelNode(root, "StatusLabel", 118, 26, 0, -62, 18);
    item.thumbnailLabel = thumbnailNode.getComponent(Label);
    item.orderLabel = orderNode.getComponent(Label);
    item.nameLabel = nameNode.getComponent(Label);
    item.statusLabel = statusNode.getComponent(Label);
    return item;
  }

  private ensureLayout(): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    const listRootTransform = this.getListRoot().getComponent(UITransform) ?? this.getListRoot().addComponent(UITransform);
    listRootTransform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    this.rebindBackButton();
  }

  private getListRoot(): Node {
    if (this.listRoot !== null) {
      return this.listRoot;
    }
    let root = this.node.getChildByName("ArtworkListRoot");
    if (root === null) {
      root = new Node("ArtworkListRoot");
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
    for (const item of this.itemClickHandlers.keys()) {
      item.setClickHandler(null);
    }
    this.itemClickHandlers.clear();
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
  label.color = new Color(72, 62, 55, 255);
  parent.addChild(node);
  return node;
}
