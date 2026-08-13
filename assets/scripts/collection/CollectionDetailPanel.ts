import { _decorator, Button, Color, Component, Label, Node, Sprite, UITransform } from "cc";
import type { CollectionDetailData, CollectionDetailViewData } from "./CollectionDetailData";

const { ccclass, property } = _decorator;

const PANEL_WIDTH = 750;
const PANEL_HEIGHT = 1334;
const IMAGE_COLOR = new Color(225, 239, 255, 255);
const ERROR_COLOR = new Color(224, 221, 216, 255);
const TEXT_COLOR = new Color(72, 62, 55, 255);

@ccclass("CollectionDetailPanel")
export class CollectionDetailPanel extends Component {
  @property(Button)
  public closeButton: Button | null = null;

  @property(Button)
  public shareButton: Button | null = null;

  @property(Label)
  public orderLabel: Label | null = null;

  @property(Label)
  public nameLabel: Label | null = null;

  @property(Label)
  public imagePlaceholderLabel: Label | null = null;

  @property(Sprite)
  public imagePlaceholderSprite: Sprite | null = null;

  @property(Label)
  public certificateTitleLabel: Label | null = null;

  @property(Label)
  public certificateImageKeyLabel: Label | null = null;

  @property(Sprite)
  public certificateBackgroundSprite: Sprite | null = null;

  @property(Label)
  public rewardHintLabel: Label | null = null;

  @property(Label)
  public errorLabel: Label | null = null;

  private artworkId = "";
  private dataSource: CollectionDetailData | null = null;
  private closeHandler: (() => void) | null = null;

  public setArtworkId(artworkId: string): void {
    this.artworkId = artworkId;
    this.refreshDetail();
  }

  public setDataSource(dataSource: CollectionDetailData): void {
    this.dataSource = dataSource;
    this.refreshDetail();
  }

  public setCloseHandler(handler: (() => void) | null): void {
    this.closeHandler = handler;
    this.rebindButtons();
  }

  public refreshDetail(): void {
    this.ensureLayout();
    if (this.dataSource === null || this.artworkId.length === 0) {
      this.renderError("No artwork selected");
      return;
    }

    const viewData = this.dataSource.getViewData(this.artworkId);
    if (viewData === null || !viewData.canView) {
      this.renderError("Artwork is not available");
      return;
    }
    this.renderDetail(viewData);
  }

  protected onDestroy(): void {
    if (this.closeButton !== null) {
      this.closeButton.node.off(Button.EventType.CLICK, this.onCloseClick, this);
    }
    if (this.shareButton !== null) {
      this.shareButton.node.off(Button.EventType.CLICK, this.onShareClick, this);
    }
  }

  private renderDetail(viewData: CollectionDetailViewData): void {
    if (this.errorLabel !== null) {
      this.errorLabel.string = "";
    }
    if (this.orderLabel !== null) {
      this.orderLabel.string = viewData.formattedOrder;
    }
    if (this.nameLabel !== null) {
      this.nameLabel.string = viewData.displayName;
    }
    if (this.imagePlaceholderLabel !== null) {
      this.imagePlaceholderLabel.string = viewData.fullImageKey ?? viewData.displayName;
    }
    if (this.imagePlaceholderSprite !== null) {
      this.imagePlaceholderSprite.color = IMAGE_COLOR;
    }
    if (this.certificateTitleLabel !== null) {
      this.certificateTitleLabel.string = viewData.themeDisplayName;
    }
    if (this.certificateImageKeyLabel !== null) {
      this.certificateImageKeyLabel.string = viewData.certificateImageKey ?? "Certificate placeholder";
    }
    if (this.certificateBackgroundSprite !== null) {
      this.certificateBackgroundSprite.color = colorFromHex(viewData.certificatePlaceholderColor, ERROR_COLOR);
    }
    if (this.rewardHintLabel !== null) {
      this.rewardHintLabel.string = viewData.rewardHint;
    }
    if (this.shareButton !== null) {
      this.shareButton.interactable = true;
    }
  }

  private renderError(message: string): void {
    if (this.errorLabel !== null) {
      this.errorLabel.string = message;
    }
    if (this.orderLabel !== null) {
      this.orderLabel.string = "";
    }
    if (this.nameLabel !== null) {
      this.nameLabel.string = "";
    }
    if (this.imagePlaceholderLabel !== null) {
      this.imagePlaceholderLabel.string = "";
    }
    if (this.imagePlaceholderSprite !== null) {
      this.imagePlaceholderSprite.color = ERROR_COLOR;
    }
    if (this.certificateTitleLabel !== null) {
      this.certificateTitleLabel.string = "";
    }
    if (this.certificateImageKeyLabel !== null) {
      this.certificateImageKeyLabel.string = "";
    }
    if (this.certificateBackgroundSprite !== null) {
      this.certificateBackgroundSprite.color = ERROR_COLOR;
    }
    if (this.rewardHintLabel !== null) {
      this.rewardHintLabel.string = "";
    }
    if (this.shareButton !== null) {
      this.shareButton.interactable = false;
    }
  }

  private ensureLayout(): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    this.ensureFallbackNodes();
    this.rebindButtons();
  }

  private ensureFallbackNodes(): void {
    if (this.imagePlaceholderSprite === null) {
      const imageNode = this.getOrCreateChild("ArtworkImagePlaceholder", 520, 420, 0, 268);
      this.imagePlaceholderSprite = imageNode.getComponent(Sprite) ?? imageNode.addComponent(Sprite);
      this.imagePlaceholderSprite.color = IMAGE_COLOR;
      this.imagePlaceholderLabel = this.imagePlaceholderLabel ?? createLabelNode(imageNode, "ImageLabel", 440, 60, 0, 0, 24).getComponent(Label);
    }
    if (this.certificateBackgroundSprite === null) {
      const certificateNode = this.getOrCreateChild("CertificatePlaceholder", 560, 260, 0, -220);
      this.certificateBackgroundSprite = certificateNode.getComponent(Sprite) ?? certificateNode.addComponent(Sprite);
      this.certificateBackgroundSprite.color = ERROR_COLOR;
      this.certificateTitleLabel = this.certificateTitleLabel ?? createLabelNode(certificateNode, "CertificateTitleLabel", 420, 48, 0, 52, 26).getComponent(Label);
      this.certificateImageKeyLabel = this.certificateImageKeyLabel ?? createLabelNode(certificateNode, "CertificateKeyLabel", 420, 40, 0, -22, 20).getComponent(Label);
    }
  }

  private getOrCreateChild(name: string, width: number, height: number, x: number, y: number): Node {
    let child = this.node.getChildByName(name);
    if (child === null) {
      child = new Node(name);
      child.layer = this.node.layer;
      this.node.addChild(child);
    }
    child.setPosition(x, y, 0);
    const transform = child.getComponent(UITransform) ?? child.addComponent(UITransform);
    transform.setContentSize(width, height);
    return child;
  }

  private rebindButtons(): void {
    if (this.closeButton !== null) {
      this.closeButton.node.off(Button.EventType.CLICK, this.onCloseClick, this);
      this.closeButton.node.on(Button.EventType.CLICK, this.onCloseClick, this);
      this.closeButton.interactable = true;
    }
    if (this.shareButton !== null) {
      this.shareButton.node.off(Button.EventType.CLICK, this.onShareClick, this);
      this.shareButton.node.on(Button.EventType.CLICK, this.onShareClick, this);
    }
  }

  private onCloseClick(): void {
    this.closeHandler?.();
  }

  private onShareClick(): void {
    if (this.artworkId.length === 0) {
      return;
    }
    console.log(`[CollectionDetailPanel] share clicked artworkId=${this.artworkId}`);
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

function colorFromHex(hex: string, fallback: Color): Color {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return fallback.clone();
  }
  const value = Number.parseInt(normalized, 16);
  return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, 255);
}
