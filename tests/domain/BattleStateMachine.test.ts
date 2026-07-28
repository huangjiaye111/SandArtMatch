import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBattleStateMachine } from "../../assets/scripts/domain/battle/BattleStateMachine.ts";
import { BattlePhase, type BattleActionResult, type BattleStageEvent } from "../../assets/scripts/domain/battle/BattleState.ts";
import { createBucket, type BucketState } from "../../assets/scripts/domain/bucket/Bucket.ts";
import { createConveyor } from "../../assets/scripts/domain/bucket/Conveyor.ts";
import { createSeededRandom } from "../../assets/scripts/domain/core/Random.ts";
import { SandGrid } from "../../assets/scripts/domain/core/SandGrid.ts";

function bucket(instanceId: string, colorId = 1, capacity = 3, currentAmount = 0) {
  return createBucket(instanceId, { colorId, capacity }, { currentAmount });
}

function basicGrid() {
  return SandGrid.fromConfig({
    width: 3,
    height: 2,
    cells: [
      [null, null, null],
      [1, 2, null],
    ],
  });
}

function resultEvent<Type extends BattleStageEvent["type"]>(
  result: BattleActionResult,
  type: Type,
): Extract<BattleStageEvent, { readonly type: Type }> {
  const event = result.events.find((candidate) => candidate.type === type);
  assert.equal(event !== undefined, true, `missing event: ${type}`);
  return event as Extract<BattleStageEvent, { readonly type: Type }>;
}

function bucketState(result: BattleActionResult, instanceId: string): BucketState {
  const state = result.snapshot.buckets.find((candidate) => candidate.instanceId === instanceId);
  assert.equal(state !== undefined, true, `missing bucket state: ${instanceId}`);
  return state as BucketState;
}

describe("BattleStateMachine", () => {
  it("starts in WaitingInput and exposes a stable read snapshot", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1), bucket("blue", 2)],
      random: createSeededRandom("initial"),
    });

    const snapshot = machine.snapshot();

    assert.equal(machine.currentPhase, BattlePhase.WaitingInput);
    assert.equal(machine.canAcceptInput(), true);
    assert.equal(snapshot.phase, BattlePhase.WaitingInput);
    assert.deepEqual(snapshot.conveyor.slots, [null, null, null, null, null, null]);
    assert.deepEqual(snapshot.buckets.map((storedBucket) => storedBucket.instanceId), ["red", "blue"]);
    assert.throws(() => {
      (snapshot.buckets as BucketState[]).pop();
    }, TypeError);
  });

  it("settles a legal bucket selection through the TASK010 phase order", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1, 3), bucket("blue", 2, 3)],
      random: createSeededRandom("legal"),
    });

    const result = machine.selectBucket("red");

    assert.equal(result.accepted, true);
    assert.equal(result.beforePhase, BattlePhase.WaitingInput);
    assert.equal(result.afterPhase, BattlePhase.WaitingInput);
    assert.deepEqual(result.phaseSequence, [
      BattlePhase.WaitingInput,
      BattlePhase.BucketEnqueue,
      BattlePhase.MergeResolve,
      BattlePhase.ExposedSandResolve,
      BattlePhase.AbsorbResolve,
      BattlePhase.SandGravity,
      BattlePhase.BucketCompleteResolve,
      BattlePhase.ResultCheck,
      BattlePhase.WaitingInput,
    ]);
    assert.deepEqual(result.events.map((event) => event.type), [
      "bucketEnqueued",
      "mergeResolved",
      "exposedSandResolved",
      "absorbResolved",
      "sandGravityResolved",
      "bucketCompleteResolved",
      "resultChecked",
    ]);
    assert.deepEqual(result.snapshot.conveyor.slots, ["red", null, null, null, null, null]);
    assert.equal(bucketState(result, "red").amount, 1);
    assert.equal(bucketState(result, "red").status, "inConveyor");
    assert.deepEqual(result.snapshot.grid.cells, [null, null, null, null, 2, null]);
  });

  it("rejects a missing bucket without changing battle state", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1)],
      random: createSeededRandom("missing"),
    });
    const before = machine.snapshot();

    const result = machine.selectBucket("missing");

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "bucketNotFound");
    assert.deepEqual(machine.snapshot(), before);
    assert.deepEqual(result.snapshot, before);
  });

  it("rejects full-conveyor input without treating full slots as failure", () => {
    const conveyor = createConveyor(2);
    conveyor.addBucket(bucket("front", 1, 5));
    conveyor.addBucket(bucket("back", 2, 5));
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("waiting", 1, 5)],
      conveyor,
      random: createSeededRandom("full"),
    });
    const before = machine.snapshot();

    const result = machine.selectBucket("waiting");

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "conveyorFull");
    assert.equal(result.afterPhase, BattlePhase.WaitingInput);
    assert.equal(result.afterPhase === BattlePhase.Failed, false);
    assert.deepEqual(machine.snapshot(), before);
  });

  it("rejects player input outside WaitingInput", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1)],
      random: createSeededRandom("busy"),
    });
    (machine as unknown as { phaseValue: BattlePhase }).phaseValue = BattlePhase.MergeResolve;
    const before = machine.snapshot();

    const result = machine.selectBucket("red");

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "battleNotWaitingInput");
    assert.deepEqual(machine.snapshot(), before);
  });

  it("rejects reentrant bucket input while settlement is already processing", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1), bucket("blue", 2)],
      random: createSeededRandom("reentrant-input"),
    });
    const internals = machine as unknown as {
      enqueueBucket: (bucketInstanceId: string) => BattleStageEvent;
    };
    const enqueueBucket = internals.enqueueBucket.bind(machine);
    let nestedResult: BattleActionResult | null = null;
    internals.enqueueBucket = (bucketInstanceId: string) => {
      nestedResult = machine.selectBucket("blue");
      return enqueueBucket(bucketInstanceId);
    };

    const result = machine.selectBucket("red");

    assert.equal(result.accepted, true);
    assert.equal(nestedResult !== null, true);
    const nested = nestedResult as unknown as BattleActionResult;
    assert.equal(nested.accepted, false);
    assert.equal(nested.rejectReason, "battleNotWaitingInput");
    assert.equal(machine.snapshot().actionIndex, 1);
    assert.equal(machine.snapshot().buckets.find((storedBucket) => storedBucket.instanceId === "blue")?.status, "available");
  });

  it("runs merge after enqueue and feeds the merged bucket into absorption", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("red-a", 1, 2));
    conveyor.addBucket(bucket("red-b", 1, 3));
    const machine = createBattleStateMachine({
      grid: SandGrid.fromConfig({
        width: 2,
        height: 1,
        cells: [[1, null]],
      }),
      buckets: [bucket("red-c", 1, 4)],
      conveyor,
      random: createSeededRandom("merge"),
    });

    const result = machine.selectBucket("red-c");
    const mergeEvent = resultEvent(result, "mergeResolved");
    const absorbEvent = resultEvent(result, "absorbResolved");

    assert.equal(result.accepted, true);
    assert.equal(mergeEvent.type, "mergeResolved");
    assert.equal(mergeEvent.result.merged, true);
    assert.deepEqual(mergeEvent.result.candidate?.bucketInstanceIds, ["red-a", "red-b", "red-c"]);
    assert.equal(mergeEvent.result.mergedBucket?.instanceId, "merge-1-1-red-a_red-b_red-c");
    assert.equal(mergeEvent.result.mergedBucket?.capacity, 9);
    assert.equal(absorbEvent.type, "absorbResolved");
    assert.deepEqual(absorbEvent.schedule.allocations.map((allocation) => allocation.bucketInstanceId), [
      "merge-1-1-red-a_red-b_red-c",
    ]);
    assert.equal(bucketState(result, "merge-1-1-red-a_red-b_red-c").amount, 1);
    assert.deepEqual(result.snapshot.conveyor.slots, ["merge-1-1-red-a_red-b_red-c", null, null, null, null, null]);
  });

  it("continues normally when no merge candidate exists", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("blue", 2, 3)],
      random: createSeededRandom("no-merge"),
    });

    const result = machine.selectBucket("blue");
    const mergeEvent = resultEvent(result, "mergeResolved");

    assert.equal(result.accepted, true);
    assert.equal(mergeEvent.type, "mergeResolved");
    assert.equal(mergeEvent.result.merged, false);
    assert.deepEqual(result.snapshot.conveyor.slots, ["blue", null, null, null, null, null]);
    assert.equal(bucketState(result, "blue").amount, 1);
  });

  it("uses exposed sand coordinates and assigns same-color cells to matching buckets", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("blue", 2, 3));
    const machine = createBattleStateMachine({
      grid: SandGrid.fromConfig({
        width: 4,
        height: 2,
        cells: [
          [null, null, null, null],
          [1, 2, 2, null],
        ],
      }),
      buckets: [bucket("red", 1, 3)],
      conveyor,
      random: createSeededRandom("colors"),
    });

    const result = machine.selectBucket("red");
    const exposedEvent = resultEvent(result, "exposedSandResolved");
    const absorbEvent = resultEvent(result, "absorbResolved");

    assert.equal(exposedEvent.type, "exposedSandResolved");
    assert.deepEqual(exposedEvent.exposedSand.map((cell) => [cell.x, cell.y, cell.index, cell.colorId]), [
      [0, 1, 4, 1],
      [1, 1, 5, 2],
      [2, 1, 6, 2],
    ]);
    assert.equal(absorbEvent.type, "absorbResolved");
    assert.deepEqual(absorbEvent.schedule.allocations.map((allocation) => [
      allocation.bucketInstanceId,
      allocation.sand.map((cell) => [cell.x, cell.y, cell.index]),
      allocation.absorbedCount,
    ]), [
      ["blue", [[1, 1, 5], [2, 1, 6]], 2],
      ["red", [[0, 1, 4]], 1],
    ]);
    assert.equal(bucketState(result, "blue").amount, 2);
    assert.equal(bucketState(result, "red").amount, 1);
    assert.deepEqual(result.snapshot.grid.cells, [null, null, null, null, null, null, null, null]);
  });

  it("does not let a bucket exceed capacity and keeps delete count equal to fill count", () => {
    const machine = createBattleStateMachine({
      grid: SandGrid.fromConfig({
        width: 3,
        height: 1,
        cells: [[1, 1, 1]],
      }),
      buckets: [bucket("red", 1, 2, 1)],
      random: createSeededRandom("capacity"),
    });

    const result = machine.selectBucket("red");
    const absorbEvent = resultEvent(result, "absorbResolved");

    assert.equal(absorbEvent.type, "absorbResolved");
    assert.equal(absorbEvent.schedule.assignedCount, 1);
    assert.equal(absorbEvent.schedule.allocations[0].absorbedCount, 1);
    assert.equal(absorbEvent.schedule.allocations[0].bucketAmountBefore, 1);
    assert.equal(absorbEvent.schedule.allocations[0].bucketAmountAfter, 2);
    assert.equal(result.snapshot.buckets.find((storedBucket) => storedBucket.instanceId === "red")?.amount, 2);
    assert.equal(result.snapshot.conveyor.slots.includes("red"), false);
    assert.deepEqual(result.snapshot.grid.cells, [null, 1, 1]);
  });

  it("runs gravity after deletion and reports the moved sand count", () => {
    const machine = createBattleStateMachine({
      grid: SandGrid.fromConfig({
        width: 1,
        height: 3,
        cells: [[2], [1], [null]],
      }),
      buckets: [bucket("red", 1, 1)],
      random: createSeededRandom("gravity-after-absorb"),
    });

    const result = machine.selectBucket("red");
    const gravityEvent = resultEvent(result, "sandGravityResolved");

    assert.equal(gravityEvent.type, "sandGravityResolved");
    assert.equal(gravityEvent.result.totalMoves, 2);
    assert.deepEqual(result.snapshot.grid.cells, [null, null, 2]);
  });

  it("removes multiple full buckets in stable conveyor order and preserves the rest", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(bucket("front-full", 1, 1, 1));
    conveyor.addBucket(bucket("middle", 2, 5, 1));
    conveyor.addBucket(bucket("back-full", 3, 2, 2));
    const machine = createBattleStateMachine({
      grid: SandGrid.empty(1, 1),
      buckets: [bucket("new", 4, 5)],
      conveyor,
      random: createSeededRandom("complete-order"),
    });

    const result = machine.selectBucket("new");
    const completeEvent = resultEvent(result, "bucketCompleteResolved");

    assert.equal(completeEvent.type, "bucketCompleteResolved");
    assert.deepEqual(completeEvent.completedBucketInstanceIds, ["front-full", "back-full"]);
    assert.deepEqual(result.snapshot.conveyor.slots, ["middle", "new", null, null, null, null]);
  });

  it("returns Won after the sand grid is cleared", () => {
    const machine = createBattleStateMachine({
      grid: SandGrid.fromConfig({
        width: 1,
        height: 1,
        cells: [[1]],
      }),
      buckets: [bucket("red", 1, 1)],
      random: createSeededRandom("win"),
    });

    const result = machine.selectBucket("red");
    const outcomeEvent = resultEvent(result, "resultChecked");

    assert.equal(result.accepted, true);
    assert.equal(result.afterPhase, BattlePhase.Won);
    assert.equal(machine.currentPhase, BattlePhase.Won);
    assert.equal(outcomeEvent.type, "resultChecked");
    assert.equal(outcomeEvent.won, true);
    assert.equal(outcomeEvent.failed, false);
    assert.deepEqual(result.snapshot.grid.cells, [null]);
  });

  it("rejects input after victory without mutating state", () => {
    const machine = createBattleStateMachine({
      grid: SandGrid.fromConfig({ width: 1, height: 1, cells: [[1]] }),
      buckets: [bucket("red", 1, 1), bucket("later", 1, 1)],
      random: createSeededRandom("post-win"),
    });
    machine.selectBucket("red");
    const before = machine.snapshot();

    const rejected = machine.selectBucket("later");

    assert.equal(rejected.accepted, false);
    assert.equal(rejected.rejectReason, "battleAlreadyWon");
    assert.deepEqual(machine.snapshot(), before);
  });

  it("rolls back grid, buckets, conveyor, random, and phase when a settlement stage throws", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1, 3)],
      random: createSeededRandom("throw"),
      gravityOptions: { maxIterations: 0 },
    });
    const before = machine.snapshot();

    const result = machine.selectBucket("red");

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "settlementError");
    assert.equal(result.errorMessage, "Gravity maxIterations must be a positive safe integer.");
    assert.equal(machine.currentPhase, BattlePhase.WaitingInput);
    assert.deepEqual(result.phaseSequence, [
      BattlePhase.WaitingInput,
      BattlePhase.BucketEnqueue,
      BattlePhase.MergeResolve,
      BattlePhase.ExposedSandResolve,
      BattlePhase.AbsorbResolve,
      BattlePhase.SandGravity,
    ]);
    assert.deepEqual(machine.snapshot(), before);
  });

  it("discards failed-operation undo history and can continue after a settlement exception", () => {
    const machine = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1, 3), bucket("blue", 2, 3)],
      random: createSeededRandom("throw-once"),
    });
    const internals = machine as unknown as {
      resolveGravity: () => unknown;
    };
    const resolveGravity = internals.resolveGravity.bind(machine);
    let shouldThrow = true;
    internals.resolveGravity = () => {
      if (shouldThrow) {
        shouldThrow = false;
        throw new Error("simulated gravity failure");
      }
      return resolveGravity();
    };
    const before = machine.snapshot();

    const failed = machine.selectBucket("red");
    const retried = machine.selectBucket("red");

    assert.equal(failed.accepted, false);
    assert.equal(failed.rejectReason, "settlementError");
    assert.equal(failed.errorMessage, "simulated gravity failure");
    assert.deepEqual(failed.snapshot, before);
    assert.equal(machine.currentPhase, BattlePhase.WaitingInput);
    assert.equal(failed.snapshot.undoHistoryDepth, 0);
    assert.equal(failed.snapshot.canUndo, false);
    assert.equal(retried.accepted, true);
    assert.equal(retried.snapshot.actionIndex, 1);
    assert.equal(retried.snapshot.undoHistoryDepth, 1);
  });

  it("is deterministic for identical initial state and identical action sequence", () => {
    const makeMachine = () =>
      createBattleStateMachine({
        grid: SandGrid.fromConfig({
          width: 3,
          height: 3,
          cells: [
            [2, null, null],
            [1, null, null],
            [null, null, null],
          ],
        }),
        buckets: [bucket("red", 1, 3), bucket("blue", 2, 3)],
        random: createSeededRandom("same"),
      });

    const first = makeMachine();
    const second = makeMachine();
    const firstResults = [first.selectBucket("red"), first.selectBucket("blue")];
    const secondResults = [second.selectBucket("red"), second.selectBucket("blue")];

    assert.deepEqual(firstResults, secondResults);
    assert.deepEqual(first.snapshot(), second.snapshot());
  });

  it("does not depend on Cocos APIs", () => {
    const snapshot = createBattleStateMachine({
      grid: basicGrid(),
      buckets: [bucket("red", 1)],
      random: createSeededRandom("pure-ts"),
    }).snapshot();

    assert.equal("cc" in snapshot, false);
    assert.equal("node" in snapshot, false);
  });
});
