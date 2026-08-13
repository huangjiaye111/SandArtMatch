import { _decorator, Button, Color, Component, Label, Sprite, UITransform } from "cc";
import type { HomeLevelData, HomeLevelStatus } from "./HomeData";

const { ccclass, property } = _decorator;

const STATUS_COLORS: Readonly<Record<HomeLevelStatus, Color>> = {
  locked: new Color(147, 141, 133, 255),
  unlocked: new Color(79, 175, 122, 255),
  completed: new Color(74, 144, 226, 255),
};

const BACKGROUND_COLORS: Readonly<Record<HomeLevelStatus, Color>> = {
  locked: new Color(224, 221, 216, 255),
  unlocked: new Color(229, 247, 237, 255),
  completed: new Color(225, 239, 255, 255),
};

@ccclass("HomeLevelNode")
export class HomeLevelNode extends Component {
  @property(Label)
  public numberLabel: Label | null = null;

  @property(Label)
  public nameLabel: Label | null = null;

  @property(Label)
  public statusLabel: Label | null = null;

  @property(Button)
  public button: Button | null = null;

  @property(Sprite)
  public backgroundSprite: Sprite | null = null;

  private data: HomeLevelData | null = null;
  private clickHandler: (() => void) | null = null;

  public setData(data: HomeLevelData): void {
    this.data = data;
    if (this.numberLabel !== null) {
      this.numberLabel.string = getLevelNumberText(data.displayName);
      this.numberLabel.color = STATUS_COLORS[data.status];
    }
    if (this.nameLabel !== null) {
      this.nameLabel.string = data.displayName;
      this.nameLabel.color = STATUS_COLORS[data.status];
    }
    if (this.statusLabel !== null) {
      this.statusLabel.string = getStatusText(data);
      this.statusLabel.color = STATUS_COLORS[data.status];
    }
    if (this.button !== null) {
      this.button.interactable = data.status !== "locked";
    }
    this.applyVisualState(data);
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

  private applyVisualState(data: HomeLevelData): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(data.isCurrent ? 132 : 116, data.isCurrent ? 132 : 116);
    const sprite = this.backgroundSprite ?? this.node.getComponent(Sprite);
    if (sprite !== null) {
      sprite.color = data.isCurrent ? new Color(255, 241, 218, 255) : BACKGROUND_COLORS[data.status];
    }
    this.node.active = true;
  }
}

function getLevelNumberText(displayName: string): string {
  const match = /\d+/.exec(displayName);
  return match?.[0] ?? displayName;
}

function getStatusText(data: HomeLevelData): string {
  if (data.status === "locked") {
    return "Locked";
  }
  if (data.status === "completed") {
    return "Done";
  }
  return data.isCurrent ? "Current" : "Ready";
}
