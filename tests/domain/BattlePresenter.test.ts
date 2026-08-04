import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BattlePhase, type BattleViewSnapshot } from "../../assets/scripts/domain/battle/BattleState.ts";
import { createBattleStateMachineForBuiltInTestLevel } from "../../assets/scripts/domain/config/TestLevels.ts";
import type { BucketState } from "../../assets/scripts/domain/bucket/Bucket.ts";
import type { ConveyorState } from "../../assets/scripts/domain/bucket/Conveyor.ts";
import type { SandGridSnapshot } from "../../assets/scripts/domain/core/SandGrid.ts";
import { BattlePresenter } from "../../assets/scripts/cocos/battle/BattlePresenter.ts";
import type { BattlePresentationEvent, BattleView } from "../../assets/scripts/cocos/battle/BattleViewContract.ts";

class FakeBattleView implements BattleView {
  public levelText = "";
  public inputEnabled = false;
  public sandGrid: SandGridSnapshot | null = null;
  public conveyor: ConveyorState | null = null;
  public buckets: readonly BucketState[] = [];
  public result: "hidden" | "win" | "lose" = "hidden";
  public feedback = "";
  public presentationEvents: BattlePresentationEvent[] = [];
  public initializedSnapshot: BattleViewSnapshot | null = null;
  public clearCount = 0;
  public cancelFeedbackCount = 0;

  public initialize(snapshot: BattleViewSnapshot): void {
    this.initializedSnapshot = snapshot;
  }

  public setLevelText(text: string): void {
    this.levelText = text;
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  public renderSandGrid(grid: SandGridSnapshot): void {
    this.sandGrid = grid;
  }

  public renderConveyor(conveyor: ConveyorState, buckets: readonly BucketState[]): void {
    this.conveyor = conveyor;
    this.buckets = buckets;
  }

  public renderBucketPool(buckets: readonly BucketState[]): void {
    this.buckets = buckets;
  }

  public async playFeedback(events: readonly BattlePresentationEvent[]): Promise<void> {
    this.presentationEvents.push(...events);
  }

  public cancelFeedback(): void {
    this.cancelFeedbackCount += 1;
  }

  public showFeedback(message: string): void {
    this.feedback = message;
  }

  public showWin(): void {
    this.result = "win";
  }

  public showLose(): void {
    this.result = "lose";
  }

  public hideResult(): void {
    this.result = "hidden";
  }

  public clear(): void {
    this.clearCount += 1;
  }
}

describe("BattlePresenter", () => {
  it("initializes the battle view from the state machine snapshot", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");

    presenter.initialize();

    assert.equal(view.initializedSnapshot?.phase, BattlePhase.WaitingInput);
    assert.equal(view.levelText, "Level 1");
    assert.equal(view.inputEnabled, true);
    assert.equal(view.conveyor?.slots.length, 6);
    assert.equal(view.buckets.length, 14);
    assert.equal(view.sandGrid?.width, 96);
    assert.equal(view.sandGrid?.height, 96);
    assert.equal(view.result, "hidden");
  });

  it("routes bucket selection through BattleStateMachine and refreshes the view", async () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();

    await presenter.selectBucket("showcase-water-1");

    assert.equal(machine.snapshot().actionIndex, 1);
    assert.equal(view.buckets.find((bucket) => bucket.instanceId === "showcase-water-1")?.status !== "available", true);
    assert.equal(view.inputEnabled, true);
    assert.equal(view.result, "hidden");
    assert.equal(view.presentationEvents.some((event) => event.type === "bucketEnteredConveyor"), true);
    assert.equal(view.presentationEvents.some((event) => event.type === "exposedSandHighlighted"), true);
    assert.equal(view.presentationEvents.some((event) => event.type === "sandAbsorbed"), true);
    const sandAbsorbed = view.presentationEvents.find((event) => event.type === "sandAbsorbed");
    assert.equal(sandAbsorbed !== undefined && sandAbsorbed.type === "sandAbsorbed", true);
    if (sandAbsorbed === undefined || sandAbsorbed.type !== "sandAbsorbed") {
      throw new Error("Expected sand absorption presentation event.");
    }
    assert.equal(sandAbsorbed.absorptionEvents.length > 0, true);
    const absorption = sandAbsorbed.absorptionEvents[0];
    assert.equal(absorption.bucketInstanceId.length > 0, true);
    assert.equal(absorption.slotIndex >= 0, true);
    assert.equal(absorption.capacity > 0, true);
    assert.equal(absorption.amountAfter >= absorption.amountBefore, true);
    assert.equal(absorption.absorbedCells.length > 0, true);
  });

  it("does not forward bucket clicks while input is disabled", async () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();

    presenter.setInputEnabled(false);
    await presenter.selectBucket("showcase-water-1");

    assert.equal(machine.snapshot().actionIndex, 0);
    assert.equal(view.inputEnabled, false);
    assert.equal(view.feedback, "Input locked");
  });

  it("locks presenter input against nested high-frequency bucket clicks", async () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();
    const originalSelectBucket = machine.selectBucket.bind(machine);
    let nestedClickCount = 0;
    machine.selectBucket = (bucketInstanceId: string) => {
      nestedClickCount += 1;
      if (nestedClickCount === 1) {
        void presenter.selectBucket("showcase-accent-merge-2");
      }
      return originalSelectBucket(bucketInstanceId);
    };

    await presenter.selectBucket("showcase-water-1");

    assert.equal(nestedClickCount, 1);
    assert.equal(machine.snapshot().actionIndex, 1);
    assert.equal(view.buckets.find((bucket) => bucket.instanceId === "showcase-accent-merge-2")?.status, "available");
    assert.equal(view.inputEnabled, true);
  });

  it("restores the level text after a later successful render", async () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();

    view.showFeedback("Temporary message");
    await presenter.selectBucket("showcase-water-1");

    assert.equal(view.levelText, "Level 1");
  });

  it("emits presentation events in the settled state-machine order", async () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();

    await presenter.selectBucket("showcase-water-1");

    const eventTypes = view.presentationEvents.map((event) => event.type);
    assert.deepEqual(eventTypes.slice(0, 2), ["bucketClicked", "bucketEnteredConveyor"]);
    assert.equal(eventTypes.includes("exposedSandHighlighted"), true);
    assert.equal(eventTypes.includes("sandAbsorbed"), true);
    assert.equal(eventTypes.at(-1), "sandCanvasRedrawn");
    assert.equal(eventTypes.indexOf("bucketEnteredConveyor") < eventTypes.indexOf("sandAbsorbed"), true);
  });

  it("restarts through the presenter and cancels active feedback before redrawing", async () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();
    const initialGrid = view.sandGrid;
    const initialSlots = view.conveyor?.slots;

    await presenter.selectBucket("showcase-accent-merge-1");
    view.showWin();
    presenter.restart();

    assert.equal(machine.snapshot().actionIndex, 0);
    assert.equal(view.cancelFeedbackCount, 1);
    assert.equal(view.result, "hidden");
    assert.deepEqual(view.sandGrid, initialGrid);
    assert.deepEqual(view.conveyor?.slots, initialSlots);
    assert.equal(view.inputEnabled, true);
  });
});
