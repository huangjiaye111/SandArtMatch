import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SandGrid, type SandGridSnapshot } from "../../assets/scripts/domain/core/SandGrid.ts";
import type { SandGridConfig } from "../../assets/scripts/domain/config/LevelConfig.ts";

describe("SandGrid", () => {
  it("creates an empty two-dimensional grid", () => {
    const grid = SandGrid.empty(3, 2);

    assert.equal(grid.width, 3);
    assert.equal(grid.height, 2);
    assert.deepEqual(grid.toRows(), [
      [null, null, null],
      [null, null, null],
    ]);
    assert.equal(grid.countSand(), 0);
    assert.equal(grid.isEmpty(), true);
  });

  it("writes, reads, clears, and counts multiple colors", () => {
    const grid = SandGrid.empty(4, 3);

    grid.set(0, 0, 1);
    grid.set(3, 2, 2);
    grid.set(1, 1, 1);

    assert.equal(grid.get(0, 0), 1);
    assert.equal(grid.get(3, 2), 2);
    assert.equal(grid.hasSandAt(1, 1), true);
    assert.equal(grid.hasSandAt(2, 1), false);
    assert.equal(grid.countSand(), 3);
    assert.equal(grid.countSand(1), 2);
    assert.equal(grid.countSand(2), 1);
    assert.equal(grid.isEmpty(), false);

    grid.clear(1, 1);

    assert.equal(grid.get(1, 1), null);
    assert.equal(grid.countSand(), 2);
    assert.equal(grid.countSand(1), 1);
  });

  it("creates a grid from test configuration", () => {
    const config: SandGridConfig = {
      width: 3,
      height: 2,
      cells: [
        [1, null, 2],
        [null, 3, null],
      ],
    };

    const grid = SandGrid.fromConfig(config);

    assert.deepEqual(grid.toRows(), config.cells);
    assert.equal(grid.countSand(), 3);
    assert.equal(grid.countSand(3), 1);
  });

  it("clears all sand for victory checks", () => {
    const grid = SandGrid.fromConfig({
      width: 2,
      height: 2,
      cells: [
        [1, 2],
        [3, null],
      ],
    });

    grid.clearAll();

    assert.equal(grid.countSand(), 0);
    assert.equal(grid.isEmpty(), true);
    assert.deepEqual(grid.toRows(), [
      [null, null],
      [null, null],
    ]);
  });

  it("clones and snapshots without sharing mutable cell storage", () => {
    const grid = SandGrid.fromConfig({
      width: 2,
      height: 2,
      cells: [
        [1, null],
        [2, 3],
      ],
    });
    const clone = grid.clone();
    const snapshot = grid.snapshot();

    clone.clear(0, 0);

    assert.deepEqual(grid.toRows(), [
      [1, null],
      [2, 3],
    ]);
    assert.deepEqual(clone.toRows(), [
      [null, null],
      [2, 3],
    ]);

    const restored = SandGrid.fromSnapshot(snapshot);
    assert.deepEqual(restored.toRows(), [
      [1, null],
      [2, 3],
    ]);
  });

  it("does not expose mutable internal arrays through rows or snapshots", () => {
    const grid = SandGrid.fromConfig({
      width: 2,
      height: 2,
      cells: [
        [1, null],
        [2, 3],
      ],
    });
    const rows = grid.toRows();
    const snapshot = grid.snapshot();

    rows[0][0] = 9;
    assert.throws(() => {
      (snapshot.cells as SandGridSnapshot["cells"] & SandGridSnapshot["cells"][number][])[1] = 9;
    }, TypeError);

    assert.deepEqual(grid.toRows(), [
      [1, null],
      [2, 3],
    ]);
    assert.deepEqual(snapshot.cells, [1, null, 2, 3]);
  });

  it("rejects invalid sizes before allocating cells", () => {
    assert.throws(() => SandGrid.empty(0, 1), RangeError);
    assert.throws(() => SandGrid.empty(1, 0), RangeError);
    assert.throws(() => SandGrid.empty(1.5, 2), RangeError);
    assert.throws(() => SandGrid.empty(2, Number.POSITIVE_INFINITY), RangeError);
    assert.throws(() => SandGrid.empty(1_000_001, 1), RangeError);
    assert.throws(() => SandGrid.empty(Number.MAX_SAFE_INTEGER, 2), RangeError);
  });

  it("rejects out-of-bounds and non-integer coordinates", () => {
    const grid = SandGrid.empty(2, 2);

    grid.set(1, 1, 7);
    assert.equal(grid.get(1, 1), 7);
    assert.throws(() => grid.get(-1, 0), RangeError);
    assert.throws(() => grid.get(2, 0), RangeError);
    assert.throws(() => grid.get(0, -1), RangeError);
    assert.throws(() => grid.get(0, 2), RangeError);
    assert.throws(() => grid.set(0.5, 1, 1), RangeError);
    assert.throws(() => grid.clear(1, 1.5), RangeError);
  });

  it("rejects invalid color ids", () => {
    const grid = SandGrid.empty(2, 2);

    grid.set(0, 0, 1);
    assert.throws(() => grid.set(0, 0, 0), RangeError);
    assert.throws(() => grid.set(0, 0, -1), RangeError);
    assert.throws(() => grid.set(0, 0, 1.5), RangeError);
    assert.throws(() => grid.countSand(Number.NaN), RangeError);
    assert.equal(grid.get(0, 0), 1);
    assert.throws(
      () =>
        SandGrid.fromConfig({
          width: 1,
          height: 1,
          cells: [[0]],
        }),
      RangeError,
    );
  });

  it("rejects malformed config and snapshot cell counts", () => {
    assert.throws(
      () =>
        SandGrid.fromConfig({
          width: 2,
          height: 2,
          cells: [[1, null]],
        }),
      RangeError,
    );
    assert.throws(
      () =>
        SandGrid.fromConfig({
          width: 2,
          height: 1,
          cells: [[1]],
        }),
      RangeError,
    );
    assert.throws(
      () =>
        SandGrid.fromConfig({
          width: 2,
          height: 1,
          cells: [undefined as unknown as readonly null[]],
        }),
      RangeError,
    );

    const snapshot: SandGridSnapshot = {
      width: 2,
      height: 2,
      cells: [1, null, 2],
    };

    assert.throws(() => SandGrid.fromSnapshot(snapshot), RangeError);
  });
});
