import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectExposedSand,
  detectExposedSandByColor,
  type ExposedSandCell,
  type ExternalAirCell,
} from "../../assets/scripts/domain/core/Exposure.ts";
import { SandGrid } from "../../assets/scripts/domain/core/SandGrid.ts";

describe("Exposure", () => {
  it("returns no exposed sand for an empty grid", () => {
    const grid = SandGrid.empty(3, 2);

    const result = detectExposedSand(grid);

    assert.deepEqual(toExposedTuples(result.exposedSand), []);
    assert.deepEqual(toAirTuples(result.externalAir), [
      [0, 0, 0],
      [1, 0, 1],
      [2, 0, 2],
      [0, 1, 3],
      [1, 1, 4],
      [2, 1, 5],
    ]);
    assert.equal(result.hasExternalAirEntry, true);
  });

  it("identifies a single bottom sand particle as exposed", () => {
    const grid = SandGrid.fromConfig({
      width: 1,
      height: 1,
      cells: [[7]],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toExposedTuples(result.exposedSand), [[0, 0, 0, 7]]);
    assert.deepEqual(toAirTuples(result.externalAir), []);
    assert.equal(result.hasExternalAirEntry, false);
  });

  it("uses bottom-row empty cells as external-air entries", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 3,
      cells: [
        [1, 1, 1],
        [1, null, 2],
        [3, null, 4],
      ],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toAirTuples(result.externalAir), [
      [1, 1, 4],
      [1, 2, 7],
    ]);
    assert.equal(result.hasExternalAirEntry, true);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [1, 0, 1, 1],
      [0, 1, 3, 1],
      [2, 1, 5, 2],
      [0, 2, 6, 3],
      [2, 2, 8, 4],
    ]);
  });

  it("floods a vertical channel connected to bottom external air", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 4,
      cells: [
        [1, null, 2],
        [1, null, 2],
        [1, null, 2],
        [3, null, 4],
      ],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toAirTuples(result.externalAir), [
      [1, 0, 1],
      [1, 1, 4],
      [1, 2, 7],
      [1, 3, 10],
    ]);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [0, 0, 0, 1],
      [2, 0, 2, 2],
      [0, 1, 3, 1],
      [2, 1, 5, 2],
      [0, 2, 6, 1],
      [2, 2, 8, 2],
      [0, 3, 9, 3],
      [2, 3, 11, 4],
    ]);
  });

  it("recognizes external air through a bending four-direction channel", () => {
    const grid = SandGrid.fromConfig({
      width: 5,
      height: 4,
      cells: [
        [1, null, null, 2, 2],
        [1, null, 3, 3, 2],
        [1, null, null, null, 2],
        [4, 4, 4, null, 5],
      ],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toAirTuples(result.externalAir), [
      [1, 0, 1],
      [2, 0, 2],
      [1, 1, 6],
      [1, 2, 11],
      [2, 2, 12],
      [3, 2, 13],
      [3, 3, 18],
    ]);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [0, 0, 0, 1],
      [3, 0, 3, 2],
      [0, 1, 5, 1],
      [2, 1, 7, 3],
      [3, 1, 8, 3],
      [0, 2, 10, 1],
      [4, 2, 14, 2],
      [0, 3, 15, 4],
      [1, 3, 16, 4],
      [2, 3, 17, 4],
      [4, 3, 19, 5],
    ]);
  });

  it("does not flood air through diagonal-only contact", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 3,
      cells: [
        [9, 8, 7],
        [6, null, 5],
        [null, 4, 3],
      ],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toAirTuples(result.externalAir), [[0, 2, 6]]);
    assert.equal(result.externalAir.some((cell) => cell.x === 1 && cell.y === 1), false);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [0, 1, 3, 6],
      [1, 2, 7, 4],
      [2, 2, 8, 3],
    ]);
  });

  it("does not treat a fully enclosed cavity as external air", () => {
    const grid = SandGrid.fromConfig({
      width: 7,
      height: 7,
      cells: [
        [null, 1, 1, 1, 1, 1, 1],
        [null, 1, 1, 1, 1, 1, 1],
        [null, 1, 1, 1, 1, 1, 1],
        [null, 1, 1, null, 1, 1, 1],
        [null, 1, 1, 1, 1, 1, 1],
        [null, 1, 1, 1, 1, 1, 1],
        [null, 2, 2, 2, 2, 2, 2],
      ],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toAirTuples(result.externalAir), [
      [0, 0, 0],
      [0, 1, 7],
      [0, 2, 14],
      [0, 3, 21],
      [0, 4, 28],
      [0, 5, 35],
      [0, 6, 42],
    ]);
    assert.equal(result.externalAir.some((cell) => cell.x === 3 && cell.y === 3), false);
    assert.equal(result.exposedSand.some((cell) => cell.x === 3 && cell.y === 2), false);
    assert.equal(result.exposedSand.some((cell) => cell.x === 2 && cell.y === 3), false);
    assert.equal(result.exposedSand.some((cell) => cell.x === 4 && cell.y === 3), false);
    assert.equal(result.exposedSand.some((cell) => cell.x === 3 && cell.y === 4), false);
  });

  it("handles a full grid without external-air entries or top-row exposure", () => {
    const grid = SandGrid.fromConfig({
      width: 2,
      height: 2,
      cells: [
        [1, 2],
        [3, 4],
      ],
    });

    const result = detectExposedSand(grid);

    assert.equal(result.hasExternalAirEntry, false);
    assert.deepEqual(toAirTuples(result.externalAir), []);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [0, 1, 2, 3],
      [1, 1, 3, 4],
    ]);
  });

  it("has no in-grid external-air entry when the bottom row is fully sealed", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 3,
      cells: [
        [null, null, null],
        [1, null, 2],
        [3, 4, 5],
      ],
    });

    const result = detectExposedSand(grid);

    assert.equal(result.hasExternalAirEntry, false);
    assert.deepEqual(toAirTuples(result.externalAir), []);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [0, 2, 6, 3],
      [1, 2, 7, 4],
      [2, 2, 8, 5],
    ]);
  });

  it("does not use top, left, or right boundaries as external-air entries", () => {
    const grid = SandGrid.fromConfig({
      width: 4,
      height: 4,
      cells: [
        [null, 1, null, null],
        [2, 3, null, 4],
        [5, 6, 7, null],
        [8, 9, 10, 11],
      ],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toAirTuples(result.externalAir), []);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [0, 3, 12, 8],
      [1, 3, 13, 9],
      [2, 3, 14, 10],
      [3, 3, 15, 11],
    ]);
  });

  it("keeps left, right, and top neighbor checks in bounds", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 3,
      cells: [
        [1, 2, 3],
        [4, 5, 6],
        [null, 7, null],
      ],
    });

    const result = detectExposedSand(grid);

    assert.deepEqual(toAirTuples(result.externalAir), [
      [0, 2, 6],
      [2, 2, 8],
    ]);
    assert.deepEqual(toExposedTuples(result.exposedSand), [
      [0, 1, 3, 4],
      [2, 1, 5, 6],
      [1, 2, 7, 7],
    ]);
  });

  it("returns the same stable result for the same input", () => {
    const grid = SandGrid.fromConfig({
      width: 4,
      height: 3,
      cells: [
        [1, null, 2, 3],
        [1, null, null, 3],
        [4, 4, null, 5],
      ],
    });

    const first = detectExposedSand(grid);
    const second = detectExposedSand(grid);

    assert.deepEqual(first, second);
    assert.deepEqual(toExposedTuples(first.exposedSand), [
      [0, 0, 0, 1],
      [2, 0, 2, 2],
      [0, 1, 4, 1],
      [3, 1, 7, 3],
      [0, 2, 8, 4],
      [1, 2, 9, 4],
      [3, 2, 11, 5],
    ]);
  });

  it("does not modify SandGrid contents during detection", () => {
    const grid = SandGrid.fromConfig({
      width: 3,
      height: 3,
      cells: [
        [1, null, 2],
        [1, null, 2],
        [3, null, 4],
      ],
    });
    const before = grid.snapshot();

    detectExposedSand(grid);

    assert.deepEqual(grid.snapshot(), before);
    assert.deepEqual(grid.toRows(), [
      [1, null, 2],
      [1, null, 2],
      [3, null, 4],
    ]);
  });

  it("returns correct color ids and supports color filtering", () => {
    const grid = SandGrid.fromConfig({
      width: 4,
      height: 3,
      cells: [
        [1, null, 2, 2],
        [1, null, 3, 2],
        [4, null, 3, 5],
      ],
    });

    const all = detectExposedSand(grid);
    const colorTwo = detectExposedSand(grid, { colorId: 2 });
    const colorThree = detectExposedSandByColor(grid, 3);

    assert.deepEqual(toExposedTuples(all.exposedSand), [
      [0, 0, 0, 1],
      [2, 0, 2, 2],
      [0, 1, 4, 1],
      [2, 1, 6, 3],
      [0, 2, 8, 4],
      [2, 2, 10, 3],
      [3, 2, 11, 5],
    ]);
    assert.deepEqual(toExposedTuples(colorTwo.exposedSand), [[2, 0, 2, 2]]);
    assert.deepEqual(toExposedTuples(colorThree), [
      [2, 1, 6, 3],
      [2, 2, 10, 3],
    ]);
  });

  it("does not expose mutable result arrays", () => {
    const grid = SandGrid.fromConfig({
      width: 2,
      height: 2,
      cells: [
        [1, null],
        [2, null],
      ],
    });

    const result = detectExposedSand(grid);

    assert.throws(() => {
      (result.exposedSand as ExposedSandCell[]).push({ x: 0, y: 0, index: 0, colorId: 9 });
    }, TypeError);
    assert.throws(() => {
      (result.externalAir as ExternalAirCell[]).push({ x: 0, y: 0, index: 0 });
    }, TypeError);
    assert.throws(() => {
      (result.exposedSand[0] as ExposedSandCell).colorId = 9;
    }, TypeError);
  });

  it("rejects invalid parameters explicitly", () => {
    const grid = SandGrid.empty(1, 1);

    assert.throws(() => detectExposedSand(undefined as unknown as SandGrid), TypeError);
    assert.throws(() => detectExposedSand(grid, { colorId: 0 }), RangeError);
    assert.throws(() => detectExposedSand(grid, { colorId: -1 }), RangeError);
    assert.throws(() => detectExposedSand(grid, { colorId: 1.5 }), RangeError);
    assert.throws(() => detectExposedSandByColor(grid, Number.NaN), RangeError);
  });
});

function toExposedTuples(cells: readonly ExposedSandCell[]): Array<[number, number, number, number]> {
  return cells.map((cell) => [cell.x, cell.y, cell.index, cell.colorId]);
}

function toAirTuples(cells: readonly ExternalAirCell[]): Array<[number, number, number]> {
  return cells.map((cell) => [cell.x, cell.y, cell.index]);
}
