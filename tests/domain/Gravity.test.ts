import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyGravityStep, settleGravity } from "../../assets/scripts/domain/core/Gravity.ts";
import { createSeededRandom } from "../../assets/scripts/domain/core/Random.ts";
import { SandGrid } from "../../assets/scripts/domain/core/SandGrid.ts";

describe("Gravity", () => {
  it("settles a single sand particle vertically to the bottom", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 4,
      cells: [
        [null, 1, null],
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
    });

    const result = settleGravity(grid, createSeededRandom("vertical"));

    assert.deepEqual(grid.toRows(), [
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, 1, null],
    ]);
    assert.deepEqual(result, {
      stable: true,
      iterations: 3,
      totalMoves: 3,
      hitIterationLimit: false,
      moveTraces: [
        { fromX: 1, fromY: 0, toX: 1, toY: 1, colorId: 1, iteration: 0 },
        { fromX: 1, fromY: 1, toX: 1, toY: 2, colorId: 1, iteration: 1 },
        { fromX: 1, fromY: 2, toX: 1, toY: 3, colorId: 1, iteration: 2 },
      ],
    });
  });

  it("stacks multiple particles under gravity", () => {
    const grid = SandGrid.fromConfig({
      width: 1,
      height: 4,
      cells: [
        [1],
        [2],
        [null],
        [null],
      ],
    });

    const result = settleGravity(grid, createSeededRandom("stack"));

    assert.deepEqual(grid.toRows(), [
      [null],
      [null],
      [1],
      [2],
    ]);
    assert.equal(result.stable, true);
    assert.equal(grid.countSand(), 2);
  });

  it("moves down-left when down is blocked and only left-down is empty", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 2,
      cells: [
        [null, 1, null],
        [null, 2, 3],
      ],
    });

    const result = applyGravityStep(grid, createSeededRandom("left-only"));

    assert.deepEqual(grid.toRows(), [
      [null, null, null],
      [1, 2, 3],
    ]);
    assert.deepEqual(result, {
      moved: true,
      moves: 1,
      moveTraces: [{ fromX: 1, fromY: 0, toX: 0, toY: 1, colorId: 1, iteration: 0 }],
    });
  });

  it("moves down-right when down is blocked and only right-down is empty", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 2,
      cells: [
        [null, 1, null],
        [3, 2, null],
      ],
    });

    const result = applyGravityStep(grid, createSeededRandom("right-only"));

    assert.deepEqual(grid.toRows(), [
      [null, null, null],
      [3, 2, 1],
    ]);
    assert.deepEqual(result, {
      moved: true,
      moves: 1,
      moveTraces: [{ fromX: 1, fromY: 0, toX: 2, toY: 1, colorId: 1, iteration: 0 }],
    });
  });

  it("uses the same seeded choice when both diagonals are empty", () => {
    const makeGrid = (): SandGrid =>
      SandGrid.fromConfig({
        width: 3,
        height: 2,
        cells: [
          [null, 1, null],
          [null, 2, null],
        ],
      });
    const first = makeGrid();
    const second = makeGrid();

    applyGravityStep(first, createSeededRandom("a"));
    applyGravityStep(second, createSeededRandom("a"));

    assert.deepEqual(first.toRows(), second.toRows());
    assert.equal(first.countSand(), 2);
  });

  it("allows different seeded choices when both diagonals are empty", () => {
    const left = SandGrid.fromConfig({
      width: 3,
      height: 2,
      cells: [
        [null, 1, null],
        [null, 2, null],
      ],
    });
    const right = left.clone();

    applyGravityStep(left, createSeededRandom("a"));
    applyGravityStep(right, createSeededRandom("b"));

    assert.deepEqual(left.toRows(), [
      [null, null, null],
      [1, 2, null],
    ]);
    assert.deepEqual(right.toRows(), [
      [null, null, null],
      [null, 2, 1],
    ]);
  });

  it("keeps a particle still when down and both diagonals are blocked", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 2,
      cells: [
        [null, 1, null],
        [2, 3, 4],
      ],
    });

    const result = settleGravity(grid, createSeededRandom("blocked"));

    assert.deepEqual(grid.toRows(), [
      [null, 1, null],
      [2, 3, 4],
    ]);
    assert.deepEqual(result, {
      stable: true,
      iterations: 0,
      totalMoves: 0,
      hitIterationLimit: false,
      moveTraces: [],
    });
  });

  it("keeps bottom-row particles in bounds", () => {
    const grid = SandGrid.fromConfig({
      width: 2,
      height: 2,
      cells: [
        [null, null],
        [1, 2],
      ],
    });

    const result = settleGravity(grid, createSeededRandom("bottom"));

    assert.deepEqual(grid.toRows(), [
      [null, null],
      [1, 2],
    ]);
    assert.equal(result.stable, true);
    assert.equal(result.totalMoves, 0);
  });

  it("keeps left and right edge movement in bounds", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 2,
      cells: [
        [1, null, 2],
        [3, null, 4],
      ],
    });

    const result = applyGravityStep(grid, createSeededRandom("edges"));

    assert.deepEqual(grid.toRows(), [
      [null, null, 2],
      [3, 1, 4],
    ]);
    assert.deepEqual(result, {
      moved: true,
      moves: 1,
      moveTraces: [{ fromX: 0, fromY: 0, toX: 1, toY: 1, colorId: 1, iteration: 0 }],
    });
    assert.equal(grid.countSand(), 4);
  });

  it("reports an empty grid as immediately stable", () => {
    const grid = SandGrid.empty(3, 3);
    const result = settleGravity(grid, createSeededRandom("empty"));

    assert.deepEqual(grid.toRows(), [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
    assert.deepEqual(result, {
      stable: true,
      iterations: 0,
      totalMoves: 0,
      hitIterationLimit: false,
      moveTraces: [],
    });
  });

  it("does not modify an already stable grid", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 2,
      cells: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    });
    const before = grid.snapshot();

    const result = settleGravity(grid, createSeededRandom("stable"));

    assert.deepEqual(grid.snapshot(), before);
    assert.deepEqual(result, {
      stable: true,
      iterations: 0,
      totalMoves: 0,
      hitIterationLimit: false,
      moveTraces: [],
    });
  });

  it("uses maxIterations to stop before an unstable grid can loop forever", () => {
    const grid = SandGrid.fromConfig({
      width: 1,
      height: 4,
      cells: [[1], [null], [null], [null]],
    });

    const result = settleGravity(grid, createSeededRandom("limit"), { maxIterations: 1 });

    assert.deepEqual(grid.toRows(), [[null], [1], [null], [null]]);
    assert.deepEqual(result, {
      stable: false,
      iterations: 1,
      totalMoves: 1,
      hitIterationLimit: true,
      moveTraces: [{ fromX: 0, fromY: 0, toX: 0, toY: 1, colorId: 1, iteration: 0 }],
    });
  });

  it("rejects invalid max iteration limits", () => {
    const grid = SandGrid.empty(1, 1);
    const random = createSeededRandom("invalid-limit");

    assert.throws(() => settleGravity(grid, random, { maxIterations: 0 }), RangeError);
    assert.throws(() => settleGravity(grid, random, { maxIterations: 1.5 }), RangeError);
  });
});
