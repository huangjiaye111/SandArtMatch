import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import type { AdService } from "../services/AdService";
import type { ShopData, ShopItemData, ShopViewData } from "./ShopData";
import { ShopItemNode } from "./ShopItemNode";

const { ccclass, property } = _decorator;

const PANEL_WIDTH = 750;
const PANEL_HEIGHT = 1334;
const TEXT_COLOR = new Color(72, 62, 55, 255);

@ccclass("ShopPanel")
export class ShopPanel extends Component {
  @property(Label)
  public staminaLabel: Label | null = null;

  @property(Label)
  public coinsLabel: Label | null = null;

  @property(Label)
  public refreshTimeLabel: Label | null = null;

  @property(Button)
  public refreshButton: Button | null = null;

  @property(Button)
  public backButton: Button | null = null;

  @property(Node)
  public itemListRoot: Node | null = null;

  @property([ShopItemNode])
  public itemNodes: ShopItemNode[] = [];

  private dataSource: ShopData | null = null;
  private adService: AdService | null = null;
  private backHandler: (() => void) | null = null;
  private readonly itemClickHandlers = new Map<ShopItemNode, () => void>();

  public setDataSource(dataSource: ShopData): void {
    this.dataSource = dataSource;
    this.refreshShopView();
  }

  public setAdService(adService: AdService): void {
    this.adService = adService;
  }

  public setBackHandler(handler: (() => void) | null): void {
    this.backHandler = handler;
    this.rebindButtons();
  }

  public refreshShopView(): void {
    this.ensureLayout();
    if (this.dataSource === null) {
      this.renderEmpty();
      return;
    }
    const viewData = this.dataSource.getViewData();
    this.renderResources(viewData);
    this.renderRefreshState(viewData);
    this.renderItems(viewData);
  }

  protected onDestroy(): void {
    this.clearItemHandlers();
    if (this.refreshButton !== null) {
      this.refreshButton.node.off(Button.EventType.CLICK, this.onRefreshClick, this);
    }
    if (this.backButton !== null) {
      this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
    }
  }

  private renderEmpty(): void {
    if (this.staminaLabel !== null) {
      this.staminaLabel.string = "0";
    }
    if (this.coinsLabel !== null) {
      this.coinsLabel.string = "0";
    }
    if (this.refreshTimeLabel !== null) {
      this.refreshTimeLabel.string = "Refresh in 0s";
    }
    for (const item of this.itemNodes) {
      item.node.active = false;
      item.setClickHandler(null);
    }
    if (this.refreshButton !== null) {
      this.refreshButton.interactable = false;
    }
  }

  private renderResources(viewData: ShopViewData): void {
    if (this.staminaLabel !== null) {
      this.staminaLabel.string = `${viewData.currentStamina}`;
    }
    if (this.coinsLabel !== null) {
      this.coinsLabel.string = `${viewData.currentCoins}`;
    }
  }

  private renderRefreshState(viewData: ShopViewData): void {
    if (this.refreshTimeLabel !== null) {
      this.refreshTimeLabel.string = `Refresh in ${viewData.refreshTimeRemaining}s`;
    }
    if (this.refreshButton !== null) {
      this.refreshButton.interactable = viewData.canRefresh;
    }
  }

  private renderItems(viewData: ShopViewData): void {
    const nodes = this.ensureItemNodeCount(viewData.items.length);
    this.clearItemHandlers();
    nodes.forEach((node, index) => {
      const item = viewData.items[index];
      if (item === undefined) {
        node.node.active = false;
        return;
      }
      node.node.active = true;
      node.node.setPosition(0, 320 - index * 154, 0);
      node.setData(item);
      const clickHandler = () => void this.claimItem(node, item);
      this.itemClickHandlers.set(node, clickHandler);
      node.setClickHandler(clickHandler);
    });
  }

  private async claimItem(node: ShopItemNode, item: ShopItemData): Promise<void> {
    if (this.dataSource === null || this.adService === null) {
      node.setFeedback("Ad unavailable");
      return;
    }
    node.setClaiming(true);
    const result = await this.dataSource.claimItem(item.id, this.adService);
    node.setClaiming(false);
    if (result.success) {
      node.setFeedback(`Received +${item.rewardAmount}`);
      this.renderResources(this.dataSource.getViewData());
      return;
    }
    node.setFeedback("Ad failed");
  }

  private ensureItemNodeCount(count: number): ShopItemNode[] {
    while (this.itemNodes.length < count) {
      this.itemNodes.push(this.createItemNode(this.itemNodes.length));
    }
    return this.itemNodes;
  }

  private createItemNode(index: number): ShopItemNode {
    const root = new Node(`ShopItemNode${index + 1}`);
    root.layer = this.node.layer;
    root.addComponent(UITransform).setContentSize(560, 132);
    const sprite = root.addComponent(Sprite);
    sprite.color = new Color(229, 247, 237, 255);
    this.getItemListRoot().addChild(root);

    const buyButton = root.addComponent(Button);
    buyButton.transition = Button.Transition.NONE;

    const itemNode = root.addComponent(ShopItemNode);
    itemNode.buyButton = buyButton;
    itemNode.backgroundSprite = sprite;
    itemNode.nameLabel = createLabelNode(root, "NameLabel", 210, 30, -144, 36, 22).getComponent(Label);
    itemNode.descriptionLabel = createLabelNode(root, "DescriptionLabel", 300, 30, -98, 2, 18).getComponent(Label);
    itemNode.rewardLabel = createLabelNode(root, "RewardLabel", 92, 30, 152, 34, 22).getComponent(Label);
    itemNode.costLabel = createLabelNode(root, "CostLabel", 120, 28, 158, -6, 18).getComponent(Label);
    itemNode.feedbackLabel = createLabelNode(root, "FeedbackLabel", 180, 26, 118, -42, 16).getComponent(Label);
    return itemNode;
  }

  private ensureLayout(): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    const listTransform = this.getItemListRoot().getComponent(UITransform) ?? this.getItemListRoot().addComponent(UITransform);
    listTransform.setContentSize(PANEL_WIDTH, 620);
    this.rebindButtons();
  }

  private getItemListRoot(): Node {
    if (this.itemListRoot !== null) {
      return this.itemListRoot;
    }
    let root = this.node.getChildByName("ShopItemListRoot");
    if (root === null) {
      root = new Node("ShopItemListRoot");
      root.layer = this.node.layer;
      root.setPosition(0, 0, 0);
      this.node.addChild(root);
    }
    this.itemListRoot = root;
    return root;
  }

  private rebindButtons(): void {
    if (this.refreshButton !== null) {
      this.refreshButton.node.off(Button.EventType.CLICK, this.onRefreshClick, this);
      this.refreshButton.node.on(Button.EventType.CLICK, this.onRefreshClick, this);
    }
    if (this.backButton !== null) {
      this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
      this.backButton.node.on(Button.EventType.CLICK, this.onBackClick, this);
      this.backButton.interactable = true;
    }
  }

  private onRefreshClick(): void {
    this.dataSource?.refreshShop();
    this.refreshShopView();
  }

  private onBackClick(): void {
    this.backHandler?.();
  }

  private clearItemHandlers(): void {
    for (const node of this.itemClickHandlers.keys()) {
      node.setClickHandler(null);
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
  label.color = TEXT_COLOR;
  parent.addChild(node);
  return node;
}
