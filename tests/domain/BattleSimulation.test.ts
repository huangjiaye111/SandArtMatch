import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BattlePhase } from "../../assets/scripts/domain/battle/BattleState.ts";
import { createBattleSimulation, type BattleSimulationFrame } from "../../assets/scripts/domain/battle/BattleSimulation.ts";
import { createBattleStateMachine } from "../../assets/scripts/domain/battle/BattleStateMachine.ts";
import { createBucket } from "../../assets/scripts/domain/bucket/Bucket.ts";
import { createBucketPoolState } from "../../assets/scripts/domain/bucket/BucketPool.ts";
import { createConveyor } from "../../assets/scripts/domain/bucket/Conveyor.ts";
import { getBuiltInTestLevel } from "../../assets/scripts/domain/config/TestLevels.ts";
import { createSeededRandom } from "../../assets/scripts/domain/core/Random.ts";
import { SandGrid } from "../../assets/scripts/domain/core/SandGrid.ts";

describe("BattleSimulation", () => {
  it("runs fixed ticks deterministically for identical inputs", () => {
    const left = simpleSimulation();
    const right = simpleSimulation();
    left.enqueueBucketSelection("red");
    right.enqueueBucketSelection("red");

    assert.deepEqual(runTicks(left, 8).map(summaryFrame), runTicks(right, 8).map(summaryFrame));
    assert.deepEqual(left.getSnapshot(), right.getSnapshot());
  });

  it("keeps accumulator results independent from render fps", () => {
    const fast = simpleSimulation();
    const slow = simpleSimulation();
    fast.enqueueBucketSelection("red");
    slow.enqueueBucketSelection("red");

    runAccumulator(fast, [1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60], 30, 4);
    runAccumulator(slow, [1 / 20, 1 / 20], 30, 4);

    assert.deepEqual(fast.getSnapshot(), slow.getSnapshot());
  });

  it("lets multiple buckets absorb in the same tick from left to right", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(createBucket("red", { colorId: 1, capacity: 4 }));
    conveyor.addBucket(createBucket("blue", { colorId: 2, capacity: 4 }));
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 2, height: 1, cells: [[1, 2]] }),
      buckets: [],
      conveyor,
      random: createSeededRandom("multi-bucket"),
      config: { maxAbsorbCellsPerBucketPerTick: 1, gravityIterationsPerTick: 1 },
    });

    const frame = simulation.tick();

    assert.deepEqual(frame.bucketAmountDeltas.map((delta) => delta.bucketInstanceId), ["red", "blue"]);
    assert.deepEqual(frame.absorbedCellIndices, [0, 1]);
  });

  it("rejects deeper bucket selections before they reach the column front", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.empty(1, 1),
      buckets: [
        createBucket("c0-front", { colorId: 1, capacity: 4 }),
        createBucket("c1-front", { colorId: 1, capacity: 4 }),
        createBucket("c2-front", { colorId: 1, capacity: 4 }),
        createBucket("c3-front", { colorId: 1, capacity: 4 }),
        createBucket("c0-second", { colorId: 1, capacity: 4 }),
        createBucket("c1-second", { colorId: 1, capacity: 4 }),
        createBucket("c2-second", { colorId: 1, capacity: 4 }),
        createBucket("c3-second", { colorId: 1, capacity: 4 }),
      ],
      random: createSeededRandom("simulation-front"),
    });

    assert.equal(simulation.enqueueBucketSelection("c0-second").reason, "bucketNotColumnFront");
    assert.equal(simulation.enqueueBucketSelection("c0-front").accepted, true);
  });

  it("resolves hint without mutating the simulation snapshot", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 2, height: 1, cells: [[1, 2]] }),
      buckets: [
        createBucket("blue", { colorId: 2, capacity: 4 }),
        createBucket("red", { colorId: 1, capacity: 4 }),
      ],
      random: createSeededRandom("simulation-hint"),
    });
    const before = simulation.getSnapshot();

    const result = simulation.useTool("hint");

    assert.equal(result.accepted, true);
    assert.equal(result.hint?.recommendedBucketInstanceId, "blue");
    assert.deepEqual(simulation.getSnapshot(), before);
  });

  it("shuffles available bucket order deterministically through the simulation", () => {
    const createSimulation = () => createBattleSimulation({
      grid: SandGrid.empty(1, 1),
      buckets: [
        createBucket("bucket-a", { colorId: 1, capacity: 4 }),
        createBucket("bucket-b", { colorId: 2, capacity: 4 }),
        createBucket("bucket-c", { colorId: 3, capacity: 4 }),
        createBucket("bucket-d", { colorId: 4, capacity: 4 }),
      ],
      random: createSeededRandom("simulation-shuffle"),
    });
    const left = createSimulation();
    const right = createSimulation();

    const leftResult = left.useTool("shuffle");
    const rightResult = right.useTool("shuffle");

    assert.equal(leftResult.accepted, true);
    assert.deepEqual(leftResult.shuffledBucketInstanceIds, rightResult.shuffledBucketInstanceIds);
    assert.deepEqual(left.getSnapshot(), right.getSnapshot());
    assert.notDeepEqual(left.getSnapshot().buckets.map((bucket) => bucket.instanceId), ["bucket-a", "bucket-b", "bucket-c", "bucket-d"]);
    assert.deepEqual(createBucketPoolState(left.getSnapshot().buckets).selectableBucketIds, left.getSnapshot().buckets.slice(0, 4).map((bucket) => bucket.instanceId));
    assert.equal(left.getSnapshot().actionIndex, 1);
  });

  it("rejects tools while a bucket selection is pending", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.empty(1, 1),
      buckets: [createBucket("red", { colorId: 1, capacity: 4 })],
      random: createSeededRandom("simulation-tool-pending"),
    });

    simulation.enqueueBucketSelection("red");
    const result = simulation.useTool("shuffle");

    assert.equal(result.accepted, false);
    assert.equal(result.rejectReason, "battleNotWaitingInput");
    assert.deepEqual(simulation.getSnapshot().buckets.map((bucket) => bucket.instanceId), ["red"]);
  });

  it("removes a selected lower bucket through the targeted pool tool", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 4, height: 1, cells: [[2, 2, 2, 3]] }),
      buckets: [
        createBucket("front", { colorId: 1, capacity: 4 }),
        createBucket("second", { colorId: 2, capacity: 2 }),
      ],
      random: createSeededRandom("remove-pool-tool"),
    });

    const result = simulation.useTargetedTool("removePoolBucket", "second");

    assert.equal(result.accepted, true);
    assert.deepEqual(result.snapshot.buckets.map((bucket) => bucket.instanceId), ["front"]);
    assert.deepEqual(result.snapshot.grid.cells, [null, null, 2, 3]);
    assert.equal(result.snapshot.actionIndex, 1);
  });

  it("removes a selected carrier bucket through the targeted carrier tool", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(createBucket("carrier-a", { colorId: 1, capacity: 4 }, { currentAmount: 1 }));
    conveyor.addBucket(createBucket("carrier-b", { colorId: 3, capacity: 4 }));
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({
        width: 3,
        height: 3,
        cells: [
          [2, 2, 2],
          [2, 1, 2],
          [2, 2, 2],
        ],
      }),
      buckets: [createBucket("pool-a", { colorId: 3, capacity: 4 })],
      conveyor,
      random: createSeededRandom("remove-carrier-tool"),
    });

    const result = simulation.useTargetedTool("removeCarrierBucket", "carrier-a");

    assert.equal(result.accepted, true);
    assert.deepEqual(result.snapshot.conveyor.slots, ["carrier-b", null, null, null, null, null]);
    assert.equal(result.snapshot.buckets.find((bucket) => bucket.instanceId === "carrier-a"), undefined);
    assert.deepEqual(result.snapshot.grid.cells, [2, 2, 2, 2, null, 2, 2, 2, 2]);
    assert.equal(result.snapshot.actionIndex, 1);
  });

  it("caps each bucket absorption per tick", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 4, height: 1, cells: [[1, 1, 1, 1]] }),
      buckets: [createBucket("red", { colorId: 1, capacity: 8 })],
      random: createSeededRandom("absorb-cap"),
      config: { maxAbsorbCellsPerBucketPerTick: 2 },
    });

    simulation.enqueueBucketSelection("red");
    const frame = simulation.tick();

    assert.deepEqual(frame.bucketAmountDeltas.map((delta) => delta.delta), [2]);
    assert.equal(frame.absorbedCellIndices.length, 2);
  });

  it("applies gravity after absorption in the same tick", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 3, cells: [[2], [1], [null]] }),
      buckets: [createBucket("red", { colorId: 1, capacity: 1 })],
      random: createSeededRandom("gravity-after-absorb"),
      config: { maxAbsorbCellsPerBucketPerTick: 1, gravityIterationsPerTick: 1 },
    });

    simulation.enqueueBucketSelection("red");
    const frame = simulation.tick();

    assert.deepEqual(frame.absorbedCellIndices, [1]);
    assert.equal(frame.gravityMoves.length, 1);
    assert.deepEqual(frame.battleState.grid.cells, [null, 2, null]);
  });

  it("recomputes exposure on the next tick so newly exposed matching sand continues absorbing", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 2, cells: [[1], [1]] }),
      buckets: [createBucket("red", { colorId: 1, capacity: 2 })],
      random: createSeededRandom("new-exposure"),
      config: { maxAbsorbCellsPerBucketPerTick: 1, gravityIterationsPerTick: 1 },
    });

    simulation.enqueueBucketSelection("red");
    const first = simulation.tick();
    const second = simulation.tick();

    assert.deepEqual(first.absorbedCellIndices, [1]);
    assert.deepEqual(second.absorbedCellIndices, [1]);
    assert.deepEqual(second.battleState.grid.cells, [null, null]);
  });

  it("preserves side-slip through the existing single-step gravity algorithm", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({
        width: 3,
        height: 2,
        cells: [
          [null, 2, null],
          [3, 3, null],
        ],
      }),
      buckets: [],
      random: createSeededRandom("side-slip"),
      config: { gravityIterationsPerTick: 1 },
    });

    const frame = simulation.tick();

    assert.equal(frame.gravityMoves.length, 1);
    assert.equal(Math.abs(frame.gravityMoves[0].toX - frame.gravityMoves[0].fromX), 1);
  });

  it("does not report idle while gravity can still move sand", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 3, cells: [[1], [null], [null]] }),
      buckets: [],
      random: createSeededRandom("idle-gravity"),
      config: { gravityIterationsPerTick: 1 },
    });

    assert.equal(simulation.isIdle(), false);
    simulation.tick();
    assert.equal(simulation.isIdle(), false);
    simulation.tick();
    assert.equal(simulation.isIdle(), true);
  });

  it("reports full bucket exits in the frame that releases the conveyor slot", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 1, cells: [[1]] }),
      buckets: [createBucket("red", { colorId: 1, capacity: 1 })],
      random: createSeededRandom("full-exit"),
      config: { maxAbsorbCellsPerBucketPerTick: 1 },
    });

    simulation.enqueueBucketSelection("red");
    const frame = simulation.tick();

    assert.deepEqual(frame.completedBucketIds, ["red"]);
    assert.deepEqual(frame.exitResults, ["red"]);
    assert.deepEqual(frame.battleState.conveyor.slots, [null, null, null, null, null, null]);
    assert.equal(frame.battleState.buckets.find((bucket) => bucket.instanceId === "red")?.status, "completed");
  });

  it("reports merge results from existing conveyor buckets without view-side rules", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(createBucket("red-a", { colorId: 1, capacity: 2 }, { currentAmount: 1 }));
    conveyor.addBucket(createBucket("red-b", { colorId: 1, capacity: 3 }, { currentAmount: 1 }));
    conveyor.addBucket(createBucket("red-c", { colorId: 1, capacity: 4 }, { currentAmount: 1 }));
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 1, cells: [[null]] }),
      buckets: [],
      conveyor,
      random: createSeededRandom("merge-frame"),
    });

    const frame = simulation.tick();

    assert.equal(frame.mergeResults.length, 1);
    assert.deepEqual(frame.mergeResults[0].participantBuckets.map((bucket) => bucket.instanceId), ["red-a", "red-b", "red-c"]);
    assert.equal(frame.battleState.conveyor.slots[0], frame.mergeResults[0].mergedBucket?.instanceId);
  });

  it("keeps runtime bucket pool columns stable after a merge reorders conveyor buckets", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(createBucket("red-a", { colorId: 1, capacity: 3 }));
    conveyor.addBucket(createBucket("red-b", { colorId: 1, capacity: 3 }));
    const simulation = createBattleSimulation({
      grid: SandGrid.empty(1, 1),
      buckets: [
        createBucket("c0-front", { colorId: 2, capacity: 3 }),
        createBucket("c1-front", { colorId: 3, capacity: 3 }),
        createBucket("c2-merge", { colorId: 1, capacity: 3 }),
        createBucket("c3-front", { colorId: 4, capacity: 3 }),
        createBucket("c0-second", { colorId: 2, capacity: 3 }),
        createBucket("c1-second", { colorId: 3, capacity: 3 }),
        createBucket("c2-second", { colorId: 1, capacity: 3 }),
        createBucket("c3-second", { colorId: 4, capacity: 3 }),
      ],
      conveyor,
      random: createSeededRandom("simulation-merge-keeps-pool-columns"),
    });

    assert.equal(simulation.enqueueBucketSelection("c2-merge").accepted, true);
    const frame = simulation.tick();
    const pool = createBucketPoolState(frame.battleState.buckets);
    const columns = new Map(pool.buckets.map((stored) => [
      stored.bucketId,
      { columnIndex: stored.columnIndex, visibleDepthIndex: stored.visibleDepthIndex },
    ]));

    assert.equal(frame.mergeResults.length, 1);
    assert.deepEqual(columns.get("c0-front"), { columnIndex: 0, visibleDepthIndex: 0 });
    assert.deepEqual(columns.get("c1-front"), { columnIndex: 1, visibleDepthIndex: 0 });
    assert.deepEqual(columns.get("c2-second"), { columnIndex: 2, visibleDepthIndex: 0 });
    assert.deepEqual(columns.get("c3-front"), { columnIndex: 3, visibleDepthIndex: 0 });
    assert.deepEqual(columns.get("c0-second"), { columnIndex: 0, visibleDepthIndex: 1 });
    assert.deepEqual(columns.get("c1-second"), { columnIndex: 1, visibleDepthIndex: 1 });
    assert.deepEqual(columns.get("c3-second"), { columnIndex: 3, visibleDepthIndex: 1 });
  });

  it("merges full matching buckets before applying completed-bucket exits", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(createBucket("red-a", { colorId: 1, capacity: 2 }, { currentAmount: 2 }));
    conveyor.addBucket(createBucket("red-b", { colorId: 1, capacity: 3 }, { currentAmount: 3 }));
    conveyor.addBucket(createBucket("red-c", { colorId: 1, capacity: 4 }, { currentAmount: 4 }));
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 1, cells: [[null]] }),
      buckets: [],
      conveyor,
      random: createSeededRandom("full-merge-before-exit"),
    });

    const mergeFrame = simulation.tick();
    const exitFrame = simulation.tick();

    assert.deepEqual(mergeFrame.completedBucketIds, ["red-a", "red-b", "red-c"]);
    assert.equal(mergeFrame.mergeResults.length, 1);
    assert.deepEqual(mergeFrame.exitResults, []);
    assert.equal(mergeFrame.mergeResults[0].mergedBucket?.currentAmount, 9);
    assert.equal(mergeFrame.mergeResults[0].mergedBucket?.capacity, 9);
    assert.deepEqual(exitFrame.exitResults, [mergeFrame.mergeResults[0].mergedBucket?.instanceId]);
  });

  it("keeps multiple merges stable in one simulation tick", () => {
    const conveyor = createConveyor();
    for (const bucket of [
      createBucket("red-a", { colorId: 1, capacity: 2 }),
      createBucket("red-b", { colorId: 1, capacity: 2 }),
      createBucket("red-c", { colorId: 1, capacity: 2 }),
      createBucket("blue-a", { colorId: 2, capacity: 2 }),
      createBucket("blue-b", { colorId: 2, capacity: 2 }),
      createBucket("blue-c", { colorId: 2, capacity: 2 }),
    ]) {
      conveyor.addBucket(bucket);
    }
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 1, cells: [[null]] }),
      buckets: [],
      conveyor,
      random: createSeededRandom("multi-merge-order"),
    });

    const frame = simulation.tick();

    assert.deepEqual(frame.mergeResults.map((result) => result.candidate?.bucketInstanceIds), [
      ["red-a", "red-b", "red-c"],
      ["blue-a", "blue-b", "blue-c"],
    ]);
    assert.deepEqual(frame.battleState.conveyor.slots.slice(0, 2), [
      frame.mergeResults[0].mergedBucket?.instanceId,
      frame.mergeResults[1].mergedBucket?.instanceId,
    ]);
  });

  it("keeps multiple exits stable from left to right", () => {
    const conveyor = createConveyor();
    conveyor.addBucket(createBucket("full-a", { colorId: 1, capacity: 2 }, { currentAmount: 2 }));
    conveyor.addBucket(createBucket("full-b", { colorId: 2, capacity: 3 }, { currentAmount: 3 }));
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 1, cells: [[null]] }),
      buckets: [],
      conveyor,
      random: createSeededRandom("multi-exit-order"),
    });

    const frame = simulation.tick();

    assert.deepEqual(frame.completedBucketIds, ["full-a", "full-b"]);
    assert.deepEqual(frame.completedSlotIndexes, [0, 1]);
    assert.deepEqual(frame.exitResults, ["full-a", "full-b"]);
    assert.deepEqual(frame.battleState.conveyor.slots, [null, null, null, null, null, null]);
  });

  it("marks victory after the fixed tick clears the final sand", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 1, cells: [[1]] }),
      buckets: [createBucket("red", { colorId: 1, capacity: 1 })],
      random: createSeededRandom("simulation-victory"),
      config: { maxAbsorbCellsPerBucketPerTick: 1 },
    });

    simulation.enqueueBucketSelection("red");
    const frame = simulation.tick();

    assert.equal(frame.won, true);
    assert.equal(frame.battleState.phase, BattlePhase.Won);
  });

  it("lets a new bucket join while an older bucket still has work", () => {
    const simulation = createBattleSimulation({
      grid: SandGrid.fromConfig({ width: 1, height: 3, cells: [[1], [1], [1]] }),
      buckets: [
        createBucket("red-a", { colorId: 1, capacity: 3 }),
        createBucket("red-b", { colorId: 1, capacity: 3 }),
      ],
      random: createSeededRandom("join-while-working"),
      config: { maxAbsorbCellsPerBucketPerTick: 1 },
    });

    simulation.enqueueBucketSelection("red-a");
    simulation.tick();
    const enqueue = simulation.enqueueBucketSelection("red-b");
    const frame = simulation.tick();

    assert.equal(enqueue.accepted, true);
    assert.equal(frame.enqueuedBucketId, "red-b");
    assert.equal(frame.battleState.conveyor.slots.includes("red-b"), true);
  });

  it("resets to the initial deterministic snapshot", () => {
    const simulation = simpleSimulation();
    const initial = simulation.getSnapshot();
    simulation.enqueueBucketSelection("red");
    simulation.tick();

    simulation.reset();

    assert.deepEqual(simulation.getSnapshot().grid, initial.grid);
    assert.deepEqual(simulation.getSnapshot().conveyor, initial.conveyor);
  });

  it("matches the old one-shot final snapshot for a simple equivalent input", () => {
    const grid = SandGrid.fromConfig({ width: 1, height: 3, cells: [[2], [1], [null]] });
    const bucket = createBucket("red", { colorId: 1, capacity: 1 });
    const oldMachine = createBattleStateMachine({
      grid,
      buckets: [bucket.clone()],
      random: createSeededRandom("compare-final"),
    });
    const simulation = createBattleSimulation({
      grid,
      buckets: [bucket.clone()],
      random: createSeededRandom("compare-final"),
      config: { maxAbsorbCellsPerBucketPerTick: 8, gravityIterationsPerTick: 8 },
    });

    oldMachine.selectBucket("red");
    simulation.enqueueBucketSelection("red");
    simulation.tick();

    assert.deepEqual(simulation.getSnapshot().grid, oldMachine.snapshot().grid);
  });

  it("keeps the showcase level dense without full-height vertical air channels", () => {
    const level = getBuiltInTestLevel();
    const occupied = level.sandMap.filter((cell) => cell !== null).length;

    assert.equal(level.width, 96);
    assert.equal(level.height, 96);
    assert.equal(occupied / level.sandMap.length >= 0.9, true);
    for (let x = 0; x < level.width; x += 1) {
      let emptyCount = 0;
      for (let y = 0; y < level.height; y += 1) {
        if (level.sandMap[y * level.width + x] === null) {
          emptyCount += 1;
        }
      }
      assert.equal(emptyCount < level.height * 0.25, true, `column ${x} has a vertical air channel`);
    }
  });

  it("starts the showcase level stable until a bucket selection creates gaps", () => {
    const simulation = createBattleSimulationFromShowcaseLevel();

    assert.equal(simulation.isIdle(), true);
    const frame = simulation.tick();
    assert.equal(frame.gravityMoves.length, 0);
    assert.equal(frame.absorbedCellIndices.length, 0);
  });
});

function simpleSimulation() {
  return createBattleSimulation({
    grid: SandGrid.fromConfig({ width: 1, height: 3, cells: [[2], [1], [null]] }),
    buckets: [createBucket("red", { colorId: 1, capacity: 3 })],
    random: createSeededRandom("simple-simulation"),
    config: { maxAbsorbCellsPerBucketPerTick: 1, gravityIterationsPerTick: 1 },
  });
}

function createBattleSimulationFromShowcaseLevel() {
  const level = getBuiltInTestLevel();
  return createBattleSimulation({
    grid: SandGrid.fromConfig({ width: level.width, height: level.height, cells: rowsFromFlat(level.sandMap, level.width) }),
    buckets: [],
    random: createSeededRandom(level.seed),
  });
}

function rowsFromFlat<T>(cells: readonly T[], width: number): readonly (readonly T[])[] {
  const rows: T[][] = [];
  for (let index = 0; index < cells.length; index += width) {
    rows.push([...cells.slice(index, index + width)]);
  }
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

function runTicks(simulation: ReturnType<typeof simpleSimulation>, count: number) {
  return Array.from({ length: count }, () => simulation.tick());
}

function summaryFrame(frame: BattleSimulationFrame) {
  return {
    absorbed: frame.absorbedCellIndices,
    gravity: frame.gravityMoves.map((move) => [move.fromX, move.fromY, move.toX, move.toY, move.colorId]),
    grid: frame.battleState.grid.cells,
  };
}

function runAccumulator(
  simulation: ReturnType<typeof simpleSimulation>,
  deltas: readonly number[],
  tickRate: number,
  maxTicksPerFrame: number,
): void {
  let accumulator = 0;
  const fixedDelta = 1 / tickRate;
  for (const delta of deltas) {
    accumulator += delta;
    let ticks = 0;
    while (accumulator >= fixedDelta && ticks < maxTicksPerFrame) {
      simulation.tick();
      accumulator -= fixedDelta;
      ticks += 1;
    }
  }
}
