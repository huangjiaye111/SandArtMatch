import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import type { CollectionChapterListItemData, CollectionChapterStatus } from "./CollectionChapterListData";

const { ccclass, property } = _decorator;

const STATUS_COLORS: Readonly<Record<CollectionChapterStatus, Color>> = {
  available: new Color(79, 175, 122, 255),
  "in-progress": new Color(242, 163, 74, 255),
  completed: new Color(66, 158, 108, 255),
  locked: new Color(147, 141, 133, 255),
};

const BACKGROUND_COLORS: Readonly<Record<CollectionChapterStatus, Color>> = {
  available: new Color(229, 247, 237, 255),
  "in-progress": new Color(255, 241, 218, 255),
  completed: new Color(220, 244, 232, 255),
  locked: new Color(224, 221, 216, 255),
};

@ccclass("CollectionChapterItem")
export class CollectionChapterItem extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property(Label)
  public progressLabel: Label | null = null;

  @property(Label)
  public statusLabel: Label | null = null;

  @property(Button)
  public button: Button | null = null;

  @property(Sprite)
  public backgroundSprite: Sprite | null = null;

  private data: CollectionChapterListItemData | null = null;
  private clickHandler: (() => void) | null = null;
  private isLocked = false;

  public setData(data: CollectionChapterListItemData): void {
    this.data = data;
    this.isLocked = data.status === "locked";
    if (this.titleLabel !== null) {
      this.titleLabel.string = data.themeDisplayName;
      this.titleLabel.color = STATUS_COLORS[data.status];
    }
    if (this.progressLabel !== null) {
      this.progressLabel.string = `${data.collectedCount}/${data.totalArtworks}`;
      this.progressLabel.color = STATUS_COLORS[data.status];
    }
    if (this.statusLabel !== null) {
      this.statusLabel.string = data.status;
      this.statusLabel.color = STATUS_COLORS[data.status];
    }
    if (this.button !== null) {
      this.button.interactable = !this.isLocked;
    }
    this.applyVisualState();
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
    if (this.isLocked) {
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

  private applyVisualState(): void {
    const background = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    background.setContentSize(260, 132);
    const sprite = this.backgroundSprite ?? this.node.getComponent(Sprite);
    if (sprite !== null && this.data !== null) {
      sprite.color = BACKGROUND_COLORS[this.data.status];
    }
    this.node.active = true;
  }
}
