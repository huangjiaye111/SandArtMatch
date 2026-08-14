import type { BattlePhase } from "../../domain/battle/BattleState";

export type BattleResultState = "victory" | "deadlock";
export type BattleResultAction = "replay" | "next" | "home";
export type BattleResultAuxAction = "share" | "revive";

export interface BattleResultActionPresentationModel {
  readonly action: BattleResultAction;
  readonly label: string;
  readonly visible: boolean;
  readonly enabled: boolean;
}

export interface BattleResultAuxActionPresentationModel {
  readonly action: BattleResultAuxAction;
  readonly label: string;
  readonly visible: boolean;
  readonly enabled: boolean;
}

export interface BattleResultPresentationModel {
  readonly state: BattleResultState;
  readonly title: string;
  readonly message: string;
  readonly artworkText: string;
  readonly rewardText: string;
  readonly staminaText: string;
  readonly detailText: string;
  readonly canStartNext: boolean;
  readonly canReplay: boolean;
  readonly canGoHome: boolean;
  readonly canShare: boolean;
  readonly canRevive: boolean;
  readonly actions: readonly BattleResultActionPresentationModel[];
  readonly auxActions: readonly BattleResultAuxActionPresentationModel[];
}

export interface BattleResultArtworkPresentationModel {
  readonly artworkText: string;
  readonly shareText: string;
  readonly reviveText: string;
}

export interface BattleResultPresentationInput {
  readonly phase: BattlePhase;
  readonly canStartNext?: boolean;
  readonly rewardAmount?: number;
  readonly staminaCost?: number;
  readonly reason?: string;
  readonly artworkTitle?: string;
  readonly canShare?: boolean;
  readonly canRevive?: boolean;
}

const DEFAULT_VICTORY_TITLE = "Victory!";
const DEFAULT_DEADLOCK_TITLE = "No moves left";
const DEFAULT_VICTORY_MESSAGE = "Level cleared";
const DEFAULT_DEADLOCK_MESSAGE = "Try again";

export function createBattleResultPresentationModel(input: BattleResultPresentationInput): BattleResultPresentationModel | null {
  if (input.phase !== "Won" && input.phase !== "Failed") {
    return null;
  }

  if (input.phase === "Won") {
    const rewardAmount = normalizeAmount(input.rewardAmount ?? 0);
    const rewardText = formatRewardText(rewardAmount);
    const canStartNext = input.canStartNext === true;
    const canShare = input.canShare !== false;
    return Object.freeze({
      state: "victory",
      title: DEFAULT_VICTORY_TITLE,
      message: DEFAULT_VICTORY_MESSAGE,
      artworkText: input.artworkTitle ?? "Artwork revealed",
      rewardText,
      staminaText: "",
      detailText: formatDetailText(DEFAULT_VICTORY_MESSAGE, rewardText),
      canStartNext,
      canReplay: true,
      canGoHome: true,
      canShare,
      canRevive: false,
      actions: createActionModels({ canStartNext, canReplay: true, canGoHome: true }),
      auxActions: createAuxActionModels({ canShare, canRevive: false }),
    });
  }

  const staminaCost = normalizeAmount(input.staminaCost ?? 0);
  const staminaText = formatStaminaText(staminaCost);
  const canRevive = input.canRevive !== false;
  return Object.freeze({
    state: "deadlock",
    title: DEFAULT_DEADLOCK_TITLE,
    message: input.reason ?? DEFAULT_DEADLOCK_MESSAGE,
    artworkText: "",
    rewardText: "",
    staminaText,
    detailText: formatDetailText(input.reason ?? DEFAULT_DEADLOCK_MESSAGE, staminaText),
    canStartNext: false,
    canReplay: true,
    canGoHome: true,
    canShare: false,
    canRevive,
    actions: createActionModels({ canStartNext: false, canReplay: true, canGoHome: true }),
    auxActions: createAuxActionModels({ canShare: false, canRevive }),
  });
}

export function createBattleResultArtworkPresentationModel(model: BattleResultPresentationModel): BattleResultArtworkPresentationModel {
  return Object.freeze({
    artworkText: model.artworkText,
    shareText: model.canShare ? "Share" : "Share later",
    reviveText: model.canRevive ? "Revive" : "Revive unavailable",
  });
}

function createActionModels(input: {
  readonly canStartNext: boolean;
  readonly canReplay: boolean;
  readonly canGoHome: boolean;
}): readonly BattleResultActionPresentationModel[] {
  return Object.freeze([
    createActionModel("replay", "Replay", input.canReplay, input.canReplay),
    createActionModel("next", "Next", input.canStartNext, input.canStartNext),
    createActionModel("home", "Home", input.canGoHome, input.canGoHome),
  ]);
}

function createActionModel(
  action: BattleResultAction,
  label: string,
  visible: boolean,
  enabled: boolean,
): BattleResultActionPresentationModel {
  return Object.freeze({ action, label, visible, enabled });
}

function createAuxActionModels(input: {
  readonly canShare: boolean;
  readonly canRevive: boolean;
}): readonly BattleResultAuxActionPresentationModel[] {
  return Object.freeze([
    createAuxActionModel("share", "Share", input.canShare, input.canShare),
    createAuxActionModel("revive", "Revive", input.canRevive, input.canRevive),
  ]);
}

function createAuxActionModel(
  action: BattleResultAuxAction,
  label: string,
  visible: boolean,
  enabled: boolean,
): BattleResultAuxActionPresentationModel {
  return Object.freeze({ action, label, visible, enabled });
}

function formatDetailText(message: string, detail: string): string {
  return detail.length === 0 ? message : `${message}  ${detail}`;
}

function formatRewardText(amount: number): string {
  return `+${amount.toString()} coins`;
}

function formatStaminaText(amount: number): string {
  return amount <= 0 ? "" : `-${amount.toString()} stamina`;
}

function normalizeAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return 0;
  }
  return value;
}
