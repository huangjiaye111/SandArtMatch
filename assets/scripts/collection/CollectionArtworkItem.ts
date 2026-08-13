import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import type { CollectionArtworkListItemData } from "./CollectionArtworkListData";

const { ccclass, property } = _decorator;

const STATUS_COLORS: Readonly<Record<CollectionArtworkListItemData["status"], Color>> = {
  collected: new Color(74, 144, 226, 255),
  unlocked: new Color(79, 175, 122, 255),
  locked: new Color(147, 141, 133, 255),
};

const BACKGROUND_COLORS: Readonly<Record<CollectionArtworkListItemData["status"], Color>> = {
  collected: new Color(225, 239, 255, 255),
  unlocked: new Color(229, 247, 237, 255),
  locked: new Color(224, 221, 216, 255),
};

@ccclass("CollectionArtworkItem")
export class CollectionArtworkItem extends Component {
  @property(Label)
  public orderLabel: Label | null = null;

  @property(Label)
  public nameLabel: Label | null = null;

  @property(Label)
  public statusLabel: Label | null = null;

  @property(Label)
  public thumbnailLabel: Label | null = null;

  @property(Button)
  public button: Button | null = null;

  @property(Sprite)
  public backgroundSprite: Sprite | null = null;

  private data: CollectionArtworkListItemData | null = null;
  private clickHandler: (() => void) | null = null;

  public setData(data: CollectionArtworkListItemData): void {
    this.data = data;
    if (this.orderLabel !== null) {
      this.orderLabel.string = `#${data.order}`;
      this.orderLabel.color = STATUS_COLORS[data.status];
    }
    if (this.nameLabel !== null) {
      this.nameLabel.string = data.displayName;
      this.nameLabel.color = STATUS_COLORS[data.status];
    }
    if (this.statusLabel !== null) {
      this.statusLabel.string = getStatusText(data.status);
      this.statusLabel.color = STATUS_COLORS[data.status];
    }
    if (this.thumbnailLabel !== null) {
      this.thumbnailLabel.string = data.thumbnailKey ?? "占位图";
      this.thumbnailLabel.color = STATUS_COLORS[data.status];
    }
    if (this.button !== null) {
      this.button.interactable = data.status !== "locked";
    }
    this.applyVisualState(data.status);
  }

  public setClickHandler(handler: (() => void) | null): void {
    this.unbindClick();
    this.clickHandler = handler;
    if (this.button !== null && this.clickHandler !== null) {
      this.button.node.on(Button.EventType.CLICK, this.onClick, this);
    }
  }

  protected onDestroy(): void {
    this.unbindClick();
  }

  private onClick(): void {
    if (this.data?.status === "locked") {
      return;
    }
    this.clickHandler?.();
  }

  private unbindClick(): void {
    if (this.button !== null) {
      this.button.node.off(Button.EventType.CLICK, this.onClick, this);
    }
    this.clickHandler = null;
  }

  private applyVisualState(status: CollectionArtworkListItemData["status"]): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(248, 168);
    const sprite = this.backgroundSprite ?? this.node.getComponent(Sprite);
    if (sprite !== null) {
      sprite.color = BACKGROUND_COLORS[status];
    }
    this.node.active = true;
  }
}

function getStatusText(status: CollectionArtworkListItemData["status"]): string {
  if (status === "collected") {
    return "已收集";
  }
  if (status === "unlocked") {
    return "已解锁";
  }
  return "🔒";
}
