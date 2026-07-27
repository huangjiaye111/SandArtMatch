import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BattlePhase, type BattleViewSnapshot } from "../../assets/scripts/domain/battle/BattleState.ts";
import {
  DEFAULT_UNDO_HISTORY_LIMIT,
  createUndoStack,
  type BattleSnapshot,
} from "../../assets/scripts/domain/battle/UndoStack.ts";
import { createBattleStateMachine } from "../../assets/scripts/domain/battle/BattleStateMachine.ts";
import { createBucket, type Bucket, type BucketState } from "../../assets/scripts/domain/bucket/Bucket.ts";
import { createConveyor, type ConveyorSystem } from "../../assets/scripts/domain/bucket/Conveyor.ts";
import { createSeededRandom, SeededRandom } from "../../assets/scripts/domain/core/Random.ts";
import { SandGrid, type SandGridSnapshot } from "../../assets/scripts/domain/core/SandGrid.ts";

type MutableBattleSnapshot = {
  -readonly [Key in keyof BattleSnapshot]: BattleSnapshot[Key];
};

function bucket(instanceId: string, colorId = 1, capacity = 5, currentAmount = 0): Bucket {
  return createBucket(instanceId, { colorId, capacity }, { currentAmount });
}

function conveyorWith(buckets: readonly Bucket[], maxSlots = 6): ConveyorSystem {
  const conveyor = createConveyor(maxSlots);
  for (const storedBucket of buckets) {
    conveyor.addBucket(storedBucket);
  }
  return conveyor;
}

function grid(cells: readonly (readonly (number | null)[])[]): SandGrid {
  return SandGrid.fromConfig({
    width: cells[0].length,
    height: cells.length,
    cells,
  });
}

function battleSnapshot(input: Partial<BattleSnapshot> = {}): BattleSnapshot {
  const sand = input.grid ?? grid([[1, null], [2, null]]).snapshot();
  const random = input.random ?? createSeededRandom("undo-snapshot").snapshot();
  const buckets = input.buckets ?? Object.freeze([bucket("red", 1).snapshot()]);
  const conveyor = input.conveyor ?? createConveyor().snapshot();

  return Object.freeze({
    phase: input.phase ?? BattlePhase.WaitingInput,
    grid: sand,
    conveyor,
    buckets,
    random,
    mergeSequence: input.mergeSequence ?? 1,
    actionIndex: input.actionIndex ?? 0,
  });
}

function stableMachine() {
  return createBattleStateMachine({
    grid: grid([
      [2, null, null],
      [1, null, null],
      [null, null, null],
    ]),
    buckets: [bucket("red", 1, 3), bucket("blue", 2, 3), bucket("green", 3, 3)],
    random: createSeededRandom("stable-machine"),
    undoHistoryLimit: DEFAULT_UNDO_HISTORY_LIMIT,
  });
}

function noAbsorbMachine() {
  return createBattleStateMachine({
    grid: grid([[9]]),
    buckets: [bucket("red", 1, 3), bucket("blue", 2, 3), bucket("green", 3, 3), bucket("yellow", 4, 3)],
    random: createSeededRandom("no-absorb-machine"),
    undoHistoryLimit: DEFAULT_UNDO_HISTORY_LIMIT,
  });
}

function comparable(snapshot: BattleViewSnapshot) {
  return {
    phase: snapshot.phase,
    grid: snapshot.grid,
    conveyor: snapshot.conveyor,
    buckets: snapshot.buckets.map((storedBucket) => ({
      ...storedBucket,
      remainingCapacity: storedBucket.capacity - storedBucket.amount,
    })),
    random: snapshot.random,
    actionIndex: snapshot.actionIndex,
    canUndo: snapshot.canUndo,
    undoHistoryDepth: snapshot.undoHistoryDepth,
  };
}

function bucketState(snapshot: BattleViewSnapshot, instanceId: string): BucketState {
  const state = snapshot.buckets.find((candidate) => candidate.instanceId === instanceId);
  assert.equal(state !== undefined, true, `missing bucket: ${instanceId}`);
  return state as BucketState;
}

function nextRandomSequence(randomSnapshot: BattleViewSnapshot["random"], count = 4): number[] {
  const random = SeededRandom.fromSnapshot(randomSnapshot);
  return Array.from({ length: count }, () => random.nextUint32());
}

describe("UndoStack", () => {
  it("starts empty and reports a clear failure when no snapshot exists", () => {
    const stack = createUndoStack();

    const result = stack.restoreLatest();

    assert.equal(stack.canUndo(), false);
    assert.equal(result.restored, false);
    assert.equal(result.failureReason, "emptyHistory");
    assert.equal(result.historyDepth, 0);
  });

  it("saves stable operation snapshots and rejects non-stable phases", () => {
    const stack = createUndoStack();
    const stable = stack.saveOperationSnapshot(battleSnapshot());
    const busy = stack.saveOperationSnapshot(battleSnapshot({ phase: BattlePhase.AbsorbResolve }));

    assert.equal(stable.saved, true);
    assert.equal(stable.historyDepth, 1);
    assert.equal(busy.saved, false);
    assert.equal(busy.failureReason, "notStablePhase");
    assert.equal(stack.historyDepth, 1);
  });

  it("isolates saved snapshots from later caller-side grid and bucket mutations", () => {
    const sandSnapshot: SandGridSnapshot = {
      width: 2,
      height: 1,
      cells: [1, 2],
    };
    const storedBucket: BucketState = {
      instanceId: "red",
      colorId: 1,
      capacity: 3,
      amount: 1,
      status: "available",
    };
    const stack = createUndoStack();

    stack.saveOperationSnapshot(battleSnapshot({ grid: sandSnapshot, buckets: Object.freeze([storedBucket]) }));
    (sandSnapshot.cells as (number | null)[])[0] = null;
    (storedBucket as { amount: number }).amount = 3;

    const restored = stack.restoreLatest();

    assert.equal(restored.restored, true);
    assert.deepEqual(restored.snapshot?.grid.cells, [1, 2]);
    assert.equal(restored.snapshot?.buckets[0].amount, 1);
    assert.equal((restored.snapshot?.buckets[0].capacity ?? 0) - (restored.snapshot?.buckets[0].amount ?? 0), 2);
  });

  it("does not expose mutable internal history through history snapshots", () => {
    const stack = createUndoStack();
    stack.saveOperationSnapshot(battleSnapshot({ actionIndex: 7 }));

    const history = stack.snapshots();

    assert.throws(() => {
      (history as BattleSnapshot[]).pop();
    }, TypeError);
    assert.throws(() => {
      (history[0] as MutableBattleSnapshot).actionIndex = 99;
    }, TypeError);
    assert.equal(stack.restoreLatest().snapshot?.actionIndex, 7);
  });

  it("keeps only the newest snapshots when saves exceed the configured limit", () => {
    const stack = createUndoStack(2);

    stack.saveOperationSnapshot(battleSnapshot({ actionIndex: 1 }));
    stack.saveOperationSnapshot(battleSnapshot({ actionIndex: 2 }));
    stack.saveOperationSnapshot(battleSnapshot({ actionIndex: 3 }));

    assert.equal(stack.historyDepth, 2);
    assert.deepEqual(stack.snapshots().map((snapshot) => snapshot.actionIndex), [2, 3]);
  });

  it("restores in last-in-first-out order and consumes each used snapshot", () => {
    const stack = createUndoStack(3);
    stack.saveOperationSnapshot(battleSnapshot({ actionIndex: 1 }));
    stack.saveOperationSnapshot(battleSnapshot({ actionIndex: 2 }));

    const first = stack.restoreLatest();
    const second = stack.restoreLatest();

    assert.equal(first.snapshot?.actionIndex, 2);
    assert.equal(first.historyDepth, 1);
    assert.equal(second.snapshot?.actionIndex, 1);
    assert.equal(second.historyDepth, 0);
    assert.equal(stack.canUndo(), false);
  });

  it("clear removes all saved snapshots", () => {
    const stack = createUndoStack();
    stack.saveOperationSnapshot(battleSnapshot());

    stack.clear();

    assert.equal(stack.restoreLatest().failureReason, "emptyHistory");
  });

  it("rejects an invalid latest snapshot without consuming history", () => {
    const stack = createUndoStack();
    stack.saveOperationSnapshot(battleSnapshot({ actionIndex: 1 }));
    (stack as unknown as { history: BattleSnapshot[] }).history.push({
      ...battleSnapshot({ actionIndex: 2 }),
      grid: { width: 2, height: 2, cells: [1] },
    } as BattleSnapshot);

    const result = stack.restoreLatest();

    assert.equal(result.restored, false);
    assert.equal(result.failureReason, "invalidSnapshot");
    assert.equal(stack.historyDepth, 2);
  });
});

describe("BattleStateMachine undo integration", () => {
  it("does not undo before any player operation has saved a snapshot", () => {
    const machine = stableMachine();
    const before = comparable(machine.snapshot());

    const result = machine.undo();

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "emptyHistory");
    assert.deepEqual(comparable(machine.snapshot()), before);
  });

  it("saves a snapshot before a valid player operation and exposes history metadata", () => {
    const machine = stableMachine();

    const result = machine.selectBucket("red");

    assert.equal(result.accepted, true);
    assert.equal(result.snapshot.actionIndex, 1);
    assert.equal(result.snapshot.canUndo, true);
    assert.equal(result.snapshot.undoHistoryDepth, 1);
  });

  it("does not save a snapshot when input validation fails", () => {
    const machine = stableMachine();

    const result = machine.selectBucket("missing");

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "bucketNotFound");
    assert.equal(machine.snapshot().undoHistoryDepth, 0);
  });

  it("restores full grid content, bucket amounts, conveyor order, random state, phase, and actionIndex", () => {
    const machine = stableMachine();
    const before = comparable(machine.snapshot());

    const selected = machine.selectBucket("red");
    assert.equal(selected.accepted, true);
    assert.notDeepEqual(comparable(machine.snapshot()), before);

    const undone = machine.undo();

    assert.equal(undone.accepted, true);
    assert.deepEqual(undone.phaseSequence, [BattlePhase.WaitingInput, BattlePhase.Undoing, BattlePhase.WaitingInput]);
    assert.deepEqual(comparable(machine.snapshot()), before);
    assert.deepEqual(nextRandomSequence(machine.snapshot().random), nextRandomSequence(before.random));
  });

  it("restores a completed and removed bucket to its pre-action domain state", () => {
    const machine = createBattleStateMachine({
      grid: grid([[1, 1]]),
      buckets: [bucket("red", 1, 2, 1)],
      random: createSeededRandom("complete-undo"),
    });

    const result = machine.selectBucket("red");
    assert.equal(result.snapshot.conveyor.slots.includes("red"), false);
    assert.equal(bucketState(result.snapshot, "red").status, "completed");

    const undone = machine.undo();
    const restoredBucket = bucketState(undone.snapshot, "red");

    assert.equal(undone.accepted, true);
    assert.equal(restoredBucket.instanceId, "red");
    assert.equal(restoredBucket.capacity, 2);
    assert.equal(restoredBucket.amount, 1);
    assert.equal(restoredBucket.capacity - restoredBucket.amount, 1);
    assert.equal(restoredBucket.status, "available");
    assert.deepEqual(undone.snapshot.conveyor.slots, [null, null, null, null, null, null]);
  });

  it("restores an in-conveyor full bucket that leaves during another player operation", () => {
    const conveyor = conveyorWith([bucket("full", 2, 1, 1)], 3);
    const machine = createBattleStateMachine({
      grid: grid([[9]]),
      buckets: [bucket("new", 3, 5)],
      conveyor,
      random: createSeededRandom("leave-undo"),
    });
    const before = machine.snapshot();

    const result = machine.selectBucket("new");
    assert.equal(result.accepted, true);
    assert.equal(result.afterPhase, BattlePhase.WaitingInput);
    assert.equal(result.snapshot.conveyor.slots.includes("full"), false);

    const undone = machine.undo();

    assert.equal(undone.accepted, true);
    assert.deepEqual(undone.snapshot.conveyor.slots, before.conveyor.slots);
    assert.equal(bucketState(undone.snapshot, "full").status, "inConveyor");
    assert.equal(bucketState(undone.snapshot, "full").amount, 1);
  });

  it("restores bucket merge participants and removes the merged bucket", () => {
    const conveyor = conveyorWith([bucket("red-a", 1, 2), bucket("red-b", 1, 3)]);
    const machine = createBattleStateMachine({
      grid: grid([[9]]),
      buckets: [bucket("red-c", 1, 4)],
      conveyor,
      random: createSeededRandom("merge-undo"),
    });

    const result = machine.selectBucket("red-c");
    assert.equal(result.accepted, true);
    assert.equal(result.afterPhase, BattlePhase.WaitingInput);
    assert.equal(result.snapshot.buckets.some((storedBucket) => storedBucket.instanceId.startsWith("merge-")), true);

    const undone = machine.undo();

    assert.equal(undone.accepted, true);
    assert.deepEqual(undone.snapshot.conveyor.slots, ["red-a", "red-b", null, null, null, null]);
    assert.deepEqual(undone.snapshot.buckets.map((storedBucket) => storedBucket.instanceId).sort(), [
      "red-a",
      "red-b",
      "red-c",
    ]);
    assert.equal(bucketState(undone.snapshot, "red-c").status, "available");
    assert.equal(undone.snapshot.buckets.some((storedBucket) => storedBucket.instanceId.startsWith("merge-")), false);
  });

  it("restores conveyor order after an operation changes it", () => {
    const conveyor = conveyorWith([bucket("front", 2), bucket("middle", 3)]);
    const machine = createBattleStateMachine({
      grid: grid([[9]]),
      buckets: [bucket("back", 4)],
      conveyor,
      random: createSeededRandom("order-undo"),
    });
    const beforeSlots = machine.snapshot().conveyor.slots;

    const selected = machine.selectBucket("back");
    assert.equal(selected.accepted, true);
    assert.deepEqual(machine.snapshot().conveyor.slots.slice(0, 3), ["front", "middle", "back"]);

    const undone = machine.undo();

    assert.equal(undone.accepted, true);
    assert.deepEqual(undone.snapshot.conveyor.slots, beforeSlots);
  });

  it("re-executes the same operation deterministically after undo", () => {
    const machine = stableMachine();

    const first = machine.selectBucket("red");
    const firstSnapshot = comparable(first.snapshot);
    const undo = machine.undo();
    const second = machine.selectBucket("red");

    assert.equal(undo.accepted, true);
    assert.equal(second.accepted, true);
    assert.deepEqual(comparable(second.snapshot), firstSnapshot);
  });

  it("restores actionIndex across multiple operations and undo consumption", () => {
    const machine = noAbsorbMachine();
    machine.selectBucket("red");
    machine.selectBucket("blue");
    assert.equal(machine.snapshot().actionIndex, 2);
    assert.equal(machine.snapshot().undoHistoryDepth, 2);

    machine.undo();

    assert.equal(machine.snapshot().actionIndex, 1);
    assert.equal(machine.snapshot().undoHistoryDepth, 1);
  });

  it("keeps only the newest configured number of battle snapshots", () => {
    const machine = createBattleStateMachine({
      grid: grid([[1, 2, 3, 4]]),
      buckets: [bucket("a", 1), bucket("b", 2), bucket("c", 3), bucket("d", 4)],
      random: createSeededRandom("limit"),
      undoHistoryLimit: 2,
    });

    machine.selectBucket("a");
    machine.selectBucket("b");
    machine.selectBucket("c");

    assert.equal(machine.snapshot().undoHistoryDepth, 2);
    machine.undo();
    assert.equal(machine.snapshot().actionIndex, 2);
    machine.undo();
    assert.equal(machine.snapshot().actionIndex, 1);
    assert.equal(machine.undo().rejectReason, "emptyHistory");
  });

  it("clearUndoHistory removes battle undo history", () => {
    const machine = stableMachine();
    machine.selectBucket("red");

    machine.clearUndoHistory();

    assert.equal(machine.snapshot().canUndo, false);
    assert.equal(machine.undo().rejectReason, "emptyHistory");
  });

  it("rejects undo while processing and leaves the full state unchanged", () => {
    const machine = stableMachine();
    machine.selectBucket("red");
    (machine as unknown as { phaseValue: BattlePhase }).phaseValue = BattlePhase.AbsorbResolve;
    const before = comparable(machine.snapshot());

    const result = machine.undo();

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "battleNotWaitingInput");
    assert.deepEqual(comparable(machine.snapshot()), before);
  });

  it("rejects undo in terminal states according to TASK012 stable-input restriction", () => {
    const wonMachine = createBattleStateMachine({
      grid: grid([[1]]),
      buckets: [bucket("red", 1, 1)],
      random: createSeededRandom("won-no-undo"),
    });
    wonMachine.selectBucket("red");

    const failedMachine = createBattleStateMachine({
      grid: grid([[2]]),
      buckets: [bucket("red", 1)],
      conveyor: createConveyor(1),
      random: createSeededRandom("failed-no-undo"),
    });
    failedMachine.selectBucket("red");

    assert.equal(wonMachine.undo().rejectReason, "battleAlreadyWon");
    assert.equal(failedMachine.undo().rejectReason, "battleAlreadyFailed");
  });

  it("does not leave a half-restored battle state when the latest undo snapshot is damaged", () => {
    const machine = stableMachine();
    machine.selectBucket("red");
    const undoStack = (machine as unknown as { undoStack: { history: BattleSnapshot[] } }).undoStack;
    undoStack.history.push({
      ...battleSnapshot(),
      grid: { width: 3, height: 3, cells: [1] },
    } as BattleSnapshot);
    const before = comparable(machine.snapshot());

    const result = machine.undo();

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "invalidSnapshot");
    assert.deepEqual(comparable(machine.snapshot()), before);
    assert.equal(machine.snapshot().undoHistoryDepth, 2);
  });

  it("does not consume history when a valid undo snapshot cannot be applied by the state machine", () => {
    const machine = stableMachine();
    machine.selectBucket("red");
    const before = comparable(machine.snapshot());
    const internals = machine as unknown as {
      restoreInternalSnapshot: (snapshot: BattleSnapshot) => void;
    };
    const restoreInternalSnapshot = internals.restoreInternalSnapshot.bind(machine);
    internals.restoreInternalSnapshot = (snapshot: BattleSnapshot) => {
      if (snapshot.actionIndex === 0) {
        throw new Error("simulated restore replacement failure");
      }
      restoreInternalSnapshot(snapshot);
    };

    const result = machine.undo();

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "restoreError");
    assert.equal(result.errorMessage, "simulated restore replacement failure");
    assert.deepEqual(comparable(machine.snapshot()), before);
    assert.equal(machine.snapshot().undoHistoryDepth, 1);
  });

  it("does not mutate caller-owned level inputs while snapshotting and undoing", () => {
    const sand = grid([[1, null]]);
    const red = bucket("red", 1, 3);
    const beforeGrid = sand.snapshot();
    const beforeBucket = red.snapshot();

    const machine = createBattleStateMachine({
      grid: sand,
      buckets: [red],
      random: createSeededRandom("level-input"),
    });
    machine.selectBucket("red");
    machine.undo();

    assert.deepEqual(sand.snapshot(), beforeGrid);
    assert.deepEqual(red.snapshot(), beforeBucket);
  });
});
