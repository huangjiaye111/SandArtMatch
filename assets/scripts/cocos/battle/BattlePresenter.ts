import {
  BattlePhase,
  type BattleActionResult,
  type BattleStageEvent,
  type BattleViewSnapshot,
} from "../../domain/battle/BattleState";
import type { BattleStateMachine } from "../../domain/battle/BattleStateMachine";
import type { BattlePresentationEvent, BattleView } from "./BattleViewContract";
import type { BattleToolAction } from "../../domain/battle/BattleToolRules";

export class BattlePresenter {
  private inputEnabled = true;
  private isHandlingAction = false;
  private readonly machine: BattleStateMachine;
  private readonly view: BattleView;
  private readonly levelText: string;

  public constructor(machine: BattleStateMachine, view: BattleView, levelText: string) {
    this.machine = machine;
    this.view = view;
    this.levelText = levelText;
  }

  public initialize(): void {
    const snapshot = this.machine.snapshot();
    this.view.initialize(snapshot);
    this.view.setLevelText(this.levelText);
    this.sync(snapshot);
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.view.setInputEnabled(enabled && this.machine.canAcceptInput());
  }

  public async selectBucket(bucketInstanceId: string): Promise<void> {
    if (!this.inputEnabled || this.isHandlingAction || !this.machine.canAcceptInput()) {
      this.view.showFeedback("Input locked");
      return;
    }

    this.isHandlingAction = true;
    this.view.setInputEnabled(false);
    try {
      const result = this.machine.selectBucket(bucketInstanceId);
      if (result.accepted) {
        const events = toPresentationEvents(result);
        void this.view.playFeedback(events);
        this.sync(result.snapshot, result.rejectReason, { skipSandGrid: true });
      } else {
        this.sync(result.snapshot, result.rejectReason);
        void this.view.playFeedback(toPresentationEvents(result));
      }
    } finally {
      this.isHandlingAction = false;
      this.view.setInputEnabled(this.inputEnabled && this.machine.canAcceptInput());
    }
  }

  public refresh(): void {
    this.sync(this.machine.snapshot());
  }

  public useTool(action: BattleToolAction): void {
    if (!this.inputEnabled || this.isHandlingAction || !this.machine.canAcceptInput()) {
      this.view.showFeedback("Input locked");
      return;
    }

    const result = this.machine.useTool(action);
    this.sync(result.snapshot, result.rejectReason);
    if (!result.accepted) {
      void this.view.playFeedback([{ type: "invalidClick", message: formatFailureReason(result.rejectReason ?? "Input locked") }]);
      return;
    }
    const message = result.action === "hint"
      ? formatHintMessage(result.hint?.recommendedBucketInstanceId ?? null)
      : "Buckets shuffled";
    this.view.showFeedback(message);
    void this.view.playFeedback([{ type: "toolUsed", action: result.action, message }]);
  }

  public restart(): void {
    this.view.cancelFeedback();
    const result = this.machine.restart();
    this.view.hideResult();
    this.sync(result.snapshot);
  }

  public clear(): void {
    this.view.clear();
  }

  private sync(
    snapshot: BattleViewSnapshot,
    failureReason?: string,
    options: { readonly skipSandGrid?: boolean } = {},
  ): void {
    if (options.skipSandGrid !== true) {
      this.view.renderSandGrid(snapshot.grid);
    }
    this.view.renderConveyor(snapshot.conveyor, snapshot.buckets);
    this.view.renderBucketPool(snapshot.buckets);
    this.view.setInputEnabled(this.inputEnabled && this.machine.canAcceptInput());

    if (snapshot.phase === BattlePhase.Won) {
      this.view.showWin();
      this.view.playFeedback([{ type: "victory" }]);
      return;
    }

    if (snapshot.phase === BattlePhase.Failed) {
      this.view.showLose(failureReason);
      this.view.playFeedback([{ type: "deadlock", message: failureReason ?? "Deadlock" }]);
      return;
    }

    this.view.hideResult();

    if (failureReason !== undefined) {
      this.view.showFeedback(formatFailureReason(failureReason));
    } else {
      this.view.setLevelText(this.levelText);
    }
  }
}

function toPresentationEvents(result: BattleActionResult): readonly BattlePresentationEvent[] {
  if (!result.accepted) {
    return Object.freeze([
      {
        type: "invalidClick",
        message: formatFailureReason(result.rejectReason ?? "Input locked"),
      },
    ]);
  }

  const events: BattlePresentationEvent[] = [
    {
      type: "bucketClicked",
      bucketInstanceId: result.bucketInstanceId,
    },
  ];

  let presentationSlots = [...result.snapshot.conveyor.slots];
  for (const stageEvent of result.events) {
    appendStagePresentationEvent(events, stageEvent, result.snapshot, presentationSlots);
    if (stageEvent.type === "bucketEnqueued") {
      presentationSlots = [...stageEvent.conveyor.slots];
    } else if (stageEvent.type === "mergeResolved") {
      presentationSlots = [...stageEvent.result.state.slots];
    } else if (stageEvent.type === "bucketCompleteResolved") {
      presentationSlots = [...stageEvent.conveyor.slots];
    }
  }
  events.push({ type: "sandCanvasRedrawn", grid: result.snapshot.grid });

  return Object.freeze(events);
}

function appendStagePresentationEvent(
  events: BattlePresentationEvent[],
  stageEvent: BattleStageEvent,
  snapshot: BattleViewSnapshot,
  presentationSlots: readonly (string | null)[],
): void {
  switch (stageEvent.type) {
    case "bucketEnqueued":
      events.push({
        type: "bucketEnteredConveyor",
        bucketInstanceId: stageEvent.bucketInstanceId,
        slotIndex: stageEvent.slotIndex,
      });
      return;
    case "mergeResolved":
      if (stageEvent.result.merged) {
        events.push({
          type: "merge",
          bucketInstanceIds: stageEvent.result.candidate?.bucketInstanceIds ?? [],
          insertedBucketInstanceId: stageEvent.result.mergedBucket?.instanceId ?? null,
          slotIndex: stageEvent.result.insertIndex,
        });
      }
      return;
    case "exposedSandResolved":
      if (stageEvent.exposedSand.length > 0) {
        events.push({
          type: "exposedSandHighlighted",
          cells: stageEvent.exposedSand,
        });
      }
      return;
    case "absorbResolved":
      if (stageEvent.schedule.assignedCount > 0) {
        events.push({
          type: "sandAbsorbed",
          allocations: stageEvent.schedule.allocations,
          assignedCount: stageEvent.schedule.assignedCount,
          absorptionEvents: stageEvent.schedule.allocations.map((allocation) => {
            const bucket = snapshot.buckets.find((candidate) => candidate.instanceId === allocation.bucketInstanceId);
            return Object.freeze({
              revision: snapshot.actionIndex,
              actionId: snapshot.actionIndex,
              bucketInstanceId: allocation.bucketInstanceId,
              slotIndex: presentationSlots.indexOf(allocation.bucketInstanceId),
              colorId: allocation.colorId,
              absorbedCells: allocation.sand,
              amountBefore: allocation.bucketAmountBefore,
              amountAfter: allocation.bucketAmountAfter,
              capacity: bucket?.capacity ?? allocation.bucketAmountAfter + allocation.bucketRemainingCapacityAfter,
            });
          }),
        });
      }
      return;
    case "sandGravityResolved":
      if (stageEvent.result.totalMoves > 0) {
        events.push({
          type: "sandGravitySettled",
          revision: snapshot.actionIndex,
          actionId: snapshot.actionIndex,
          moves: stageEvent.result.moveTraces,
          result: stageEvent.result,
          grid: stageEvent.grid,
          totalMoves: stageEvent.result.totalMoves,
          settlementSteps: stageEvent.settlementSteps,
        });
      }
      return;
    case "bucketCompleteResolved":
      if (stageEvent.completedBucketInstanceIds.length > 0) {
        events.push({
          type: "fullBucketLeft",
          bucketInstanceIds: stageEvent.completedBucketInstanceIds,
          slotIndexes: stageEvent.completedBucketSlotIndexes,
        });
      }
      return;
    default:
      return;
  }
}

function formatFailureReason(reason: string): string {
  switch (reason) {
    case "battleNotWaitingInput":
      return "Input locked";
    case "battleAlreadyWon":
      return "Already won";
    case "bucketNotFound":
      return "Bucket unavailable";
    case "bucketNotSelectable":
      return "Bucket not selectable";
    case "bucketNotColumnFront":
      return "Bucket not column front";
    case "conveyorFull":
      return "Conveyor full";
    case "toolNotFound":
      return "Tool unavailable";
    case "settlementError":
      return "Settlement error";
    default:
      return reason;
  }
}

function formatHintMessage(bucketInstanceId: string | null): string {
  return bucketInstanceId === null ? "No move hinted" : `Hint: ${bucketInstanceId}`;
}
