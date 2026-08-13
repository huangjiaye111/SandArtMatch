import { _decorator, Button, Color, Component, Label, Sprite, UITransform } from "cc";
import type { ShopItemData } from "./ShopData";

const { ccclass, property } = _decorator;

const TEXT_COLOR = new Color(72, 62, 55, 255);
const AVAILABLE_COLOR = new Color(229, 247, 237, 255);
const DISABLED_COLOR = new Color(224, 221, 216, 255);

@ccclass("ShopItemNode")
export class ShopItemNode extends Component {
  @property(Label)
  public nameLabel: Label | null = null;

  @property(Label)
  public descriptionLabel: Label | null = null;

  @property(Label)
  public rewardLabel: Label | null = null;

  @property(Label)
  public costLabel: Label | null = null;

  @property(Label)
  public feedbackLabel: Label | null = null;

  @property(Button)
  public buyButton: Button | null = null;

  @property(Sprite)
  public backgroundSprite: Sprite | null = null;

  private data: ShopItemData | null = null;
  private clickHandler: (() => void) | null = null;
  private claiming = false;

  public setData(data: ShopItemData): void {
    this.data = data;
    this.claiming = false;
    if (this.nameLabel !== null) {
      this.nameLabel.string = data.displayName;
    }
    if (this.descriptionLabel !== null) {
      this.descriptionLabel.string = data.description;
    }
    if (this.rewardLabel !== null) {
      this.rewardLabel.string = `+${data.rewardAmount}`;
    }
    if (this.costLabel !== null) {
      this.costLabel.string = data.costType === "free_ad" ? "Watch Ad" : `${data.cost}`;
    }
    if (this.feedbackLabel !== null) {
      this.feedbackLabel.string = "";
    }
    this.setClaiming(false);
    this.applyVisualState();
  }

  public setClickHandler(handler: (() => void) | null): void {
    this.unbindClick();
    this.clickHandler = handler;
    if (this.buyButton !== null && this.clickHandler !== null) {
      this.buyButton.node.on(Button.EventType.CLICK, this.onClick, this);
    }
  }

  public setClaiming(claiming: boolean): void {
    this.claiming = claiming;
    if (this.buyButton !== null) {
      this.buyButton.interactable = !claiming && (this.data?.available ?? false);
    }
    if (claiming && this.feedbackLabel !== null) {
      this.feedbackLabel.string = "Claiming...";
    }
  }

  public setFeedback(message: string): void {
    if (this.feedbackLabel !== null) {
      this.feedbackLabel.string = message;
    }
  }

  protected onDestroy(): void {
    this.unbindClick();
  }

  private onClick(): void {
    if (this.claiming || this.data?.available !== true) {
      return;
    }
    this.clickHandler?.();
  }

  private unbindClick(): void {
    if (this.buyButton !== null) {
      this.buyButton.node.off(Button.EventType.CLICK, this.onClick, this);
    }
    this.clickHandler = null;
  }

  private applyVisualState(): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(560, 132);
    const sprite = this.backgroundSprite ?? this.node.getComponent(Sprite);
    if (sprite !== null) {
      sprite.color = this.data?.available === true ? AVAILABLE_COLOR : DISABLED_COLOR;
    }
    for (const label of [this.nameLabel, this.descriptionLabel, this.rewardLabel, this.costLabel, this.feedbackLabel]) {
      if (label !== null) {
        label.color = TEXT_COLOR;
      }
    }
    this.node.active = true;
  }
}
