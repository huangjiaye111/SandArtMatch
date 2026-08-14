import type { LevelCatalogEntry } from "../../domain/config/LevelCatalog";
import type { ThemeConfig } from "../../theme/ThemeTypes";

export interface BattleThemePresentationModel {
  readonly levelId: string;
  readonly artworkId: string;
  readonly themeId: string;
  readonly themeDisplayName: string;
  readonly backgroundAssetKey: string | null;
  readonly frameAssetKey: string | null;
  readonly decorationAssetKey: string | null;
  readonly assetBindings: readonly BattleThemeAssetBindingPresentationModel[];
  readonly placeholderBackgroundColor: string;
  readonly placeholderFrameColor: string;
}

export type BattleThemeAssetBindingSlot = "background" | "frame" | "decoration";

export interface BattleThemeAssetBindingPresentationModel {
  readonly slot: BattleThemeAssetBindingSlot;
  readonly spriteFrameKey: string | null;
  readonly fallbackColor: string;
  readonly required: boolean;
}

const DEFAULT_PLACEHOLDER_BACKGROUND_COLOR = "#F4F6F2";
const DEFAULT_PLACEHOLDER_FRAME_COLOR = "#B59E73";

export function createBattleThemePresentationModel(
  theme: ThemeConfig,
  level: LevelCatalogEntry,
): BattleThemePresentationModel {
  const placeholderBackgroundColor = theme.placeholderBackgroundColor ?? DEFAULT_PLACEHOLDER_BACKGROUND_COLOR;
  const placeholderFrameColor = theme.placeholderFrameColor ?? DEFAULT_PLACEHOLDER_FRAME_COLOR;
  return Object.freeze({
    levelId: level.levelId,
    artworkId: level.artworkId,
    themeId: theme.id,
    themeDisplayName: theme.displayName,
    backgroundAssetKey: theme.battleBackgroundKey ?? null,
    frameAssetKey: theme.battleFrameKey ?? null,
    decorationAssetKey: theme.battleDecorationKey ?? null,
    assetBindings: Object.freeze([
      createAssetBinding("background", theme.battleBackgroundKey ?? null, placeholderBackgroundColor),
      createAssetBinding("frame", theme.battleFrameKey ?? null, placeholderFrameColor),
      createAssetBinding("decoration", theme.battleDecorationKey ?? null, placeholderFrameColor),
    ]),
    placeholderBackgroundColor,
    placeholderFrameColor,
  });
}

function createAssetBinding(
  slot: BattleThemeAssetBindingSlot,
  spriteFrameKey: string | null,
  fallbackColor: string,
): BattleThemeAssetBindingPresentationModel {
  return Object.freeze({
    slot,
    spriteFrameKey,
    fallbackColor,
    required: false,
  });
}


export type BattleToolPresentationAction = "hint" | "shuffle" | "removePoolBucket" | "removeCarrierBucket";

export interface BattleToolEntryPresentationModel {
  readonly action: BattleToolPresentationAction;
  readonly label: string;
  readonly iconAssetKey: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly featureGate: string;
  readonly themeId: string;
}

export function createBattleToolEntryPresentationModels(
  theme: BattleThemePresentationModel,
): readonly BattleToolEntryPresentationModel[] {
  return Object.freeze([
    createToolEntry("removePoolBucket", "下方桶", theme),
    createToolEntry("removeCarrierBucket", "传送桶", theme),
  ]);
}

function createToolEntry(
  action: BattleToolPresentationAction,
  label: string,
  theme: BattleThemePresentationModel,
): BattleToolEntryPresentationModel {
  return Object.freeze({
    action,
    label,
    iconAssetKey: `battle.tool.${action}`,
    visible: true,
    enabled: true,
    featureGate: "",
    themeId: theme.themeId,
  });
}
