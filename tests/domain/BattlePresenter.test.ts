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
  public undoEnabled = false;
  public sandGrid: SandGridSnapshot | null = null;
  public conveyor: ConveyorState | null = null;
  public buckets: readonly BucketState[] = [];
  public result: "hidden" | "win" | "lose" = "hidden";
  public feedback = "";
  public presentationEvents: BattlePresentationEvent[] = [];
  public undoRejected = false;
  public initializedSnapshot: BattleViewSnapshot | null = null;
  public clearCount = 0;

  public initialize(snapshot: BattleViewSnapshot): void {
    this.initializedSnapshot = snapshot;
  }

  public setLevelText(text: string): void {
    this.levelText = text;
  }

  public setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  public setUndoEnabled(enabled: boolean): void {
    this.undoEnabled = enabled;
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

  public playFeedback(events: readonly BattlePresentationEvent[]): void {
    this.presentationEvents.push(...events);
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
    assert.equal(view.undoEnabled, false);
    assert.equal(view.conveyor?.slots.length, 6);
    assert.equal(view.buckets.length, 8);
    assert.equal(view.sandGrid?.width, 4);
    assert.equal(view.result, "hidden");
  });

  it("routes bucket selection through BattleStateMachine and refreshes the view", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();

    presenter.selectBucket("t01-red-a");

    assert.equal(machine.snapshot().actionIndex, 1);
    assert.equal(view.buckets.find((bucket) => bucket.instanceId === "t01-red-a")?.status, "completed");
    assert.equal(view.undoEnabled, true);
    assert.equal(view.inputEnabled, true);
    assert.equal(view.result, "hidden");
    assert.equal(view.presentationEvents.some((event) => event.type === "bucketEnteredConveyor"), true);
    assert.equal(view.presentationEvents.some((event) => event.type === "fullBucketLeft"), true);
  });

  it("routes undo through BattleStateMachine and restores the rendered snapshot", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();
    presenter.selectBucket("t01-red-a");

    presenter.undo();

    assert.equal(machine.snapshot().actionIndex, 0);
    assert.equal(view.buckets.find((bucket) => bucket.instanceId === "t01-red-a")?.status, "available");
    assert.equal(view.undoEnabled, false);
    assert.deepEqual(view.conveyor?.slots, [null, null, null, null, null, null]);
    assert.equal(view.presentationEvents.some((event) => event.type === "undoRestored"), true);
  });

  it("does not forward bucket clicks while input is disabled", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();

    presenter.setInputEnabled(false);
    presenter.selectBucket("t01-red-a");
    presenter.undo();

    assert.equal(machine.snapshot().actionIndex, 0);
    assert.equal(view.inputEnabled, false);
    assert.equal(view.undoEnabled, false);
    assert.equal(view.feedback, "Input locked");
  });

  it("locks presenter input against nested high-frequency bucket clicks", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();
    const originalSelectBucket = machine.selectBucket.bind(machine);
    let nestedClickCount = 0;
    machine.selectBucket = (bucketInstanceId: string) => {
      nestedClickCount += 1;
      if (nestedClickCount === 1) {
        presenter.selectBucket("t01-green-b");
      }
      return originalSelectBucket(bucketInstanceId);
    };

    presenter.selectBucket("t01-green-a");

    assert.equal(nestedClickCount, 1);
    assert.equal(machine.snapshot().actionIndex, 1);
    assert.equal(view.buckets.find((bucket) => bucket.instanceId === "t01-green-b")?.status, "available");
    assert.equal(view.inputEnabled, true);
  });

  it("shows feedback for unavailable undo requests", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();
    const originalUndo = machine.undo.bind(machine);
    machine.undo = () => {
      view.undoRejected = true;
      return originalUndo();
    };

    presenter.undo();

    assert.equal(machine.snapshot().actionIndex, 0);
    assert.equal(view.undoRejected, true);
    assert.equal(view.feedback, "Nothing to undo");
    assert.equal(view.presentationEvents.some((event) => event.type === "invalidClick"), true);
  });

  it("restores the level text after a later successful render", () => {
    const machine = createBattleStateMachineForBuiltInTestLevel();
    const view = new FakeBattleView();
    const presenter = new BattlePresenter(machine, view, "Level 1");
    presenter.initialize();

    presenter.undo();
    presenter.selectBucket("t01-green-a");

    assert.equal(view.feedback, "Nothing to undo");
    assert.equal(view.levelText, "Level 1");
  });
});
