import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createSandCanvasRenderModel,
  findCanvasCell,
  getSandCanvasCellPixelPaint,
  getSandCanvasCellVariation,
  getSandCanvasPaletteEntry,
  summarizeAbsorption,
} from "../../assets/scripts/cocos/battle/SandCanvasModel.ts";

describe("SandCanvasModel", () => {
  it("maps a SandGrid snapshot into stable canvas cells", () => {
    const model = createSandCanvasRenderModel(
      {
        width: 3,
        height: 2,
        cells: [1, null, 2, null, 3, null],
      },
      { maxWidth: 300, maxHeight: 200 },
    );

    assert.equal(model.gridWidth, 3);
    assert.equal(model.gridHeight, 2);
    assert.equal(model.cells.length, 6);
    assert.deepEqual(model.sandCells.map((cell) => cell.colorId), [1, 2, 3]);
    assert.deepEqual(model.emptyCells.map((cell) => cell.index), [1, 3, 5]);
    assert.deepEqual(
      model.cells.map((cell) => ({ index: cell.index, x: cell.x, y: cell.y })),
      [
        { index: 0, x: 0, y: 0 },
        { index: 1, x: 1, y: 0 },
        { index: 2, x: 2, y: 0 },
        { index: 3, x: 0, y: 1 },
        { index: 4, x: 1, y: 1 },
        { index: 5, x: 2, y: 1 },
      ],
    );
  });

  it("fits a 96x96 canvas inside the square SandFrame inner rect without stretching cells", () => {
    const model = createSandCanvasRenderModel(
      {
        width: 96,
        height: 96,
        cells: Array.from({ length: 96 * 96 }, () => 1),
      },
      { maxWidth: 600, maxHeight: 600, innerWidth: 600, innerHeight: 600 },
    );

    assert.equal(model.cellSize, 6);
    assert.equal(model.totalWidth, 576);
    assert.equal(model.totalHeight, 576);
    assert.equal(model.offsetX, 12);
    assert.equal(model.offsetY, 12);
    assert.equal(model.cells.every((cell) => cell.centerX - cell.size / 2 >= -300), true);
    assert.equal(model.cells.every((cell) => cell.centerX + cell.size / 2 <= 300), true);
    assert.equal(model.cells.every((cell) => cell.centerY - cell.size / 2 >= -300), true);
    assert.equal(model.cells.every((cell) => cell.centerY + cell.size / 2 <= 300), true);
  });

  it("centers smaller draw regions horizontally and vertically inside the inner rect", () => {
    const model = createSandCanvasRenderModel(
      {
        width: 8,
        height: 6,
        cells: Array.from({ length: 48 }, () => null),
      },
      { maxWidth: 640, maxHeight: 480, innerWidth: 500, innerHeight: 500 },
    );

    assert.equal(model.cellSize, 62);
    assert.equal(model.totalWidth, 496);
    assert.equal(model.totalHeight, 372);
    assert.equal(model.offsetX, 2);
    assert.equal(model.offsetY, 64);
  });

  it("keeps colorId to visual color mapping stable", () => {
    assert.deepEqual(getSandCanvasPaletteEntry(1), {
      fill: "#F27C8A",
      shadow: "#C85B67",
      highlight: "#FFA4AD",
    });
    assert.deepEqual(getSandCanvasPaletteEntry(6), {
      fill: "#F49A3F",
      shadow: "#C46E24",
      highlight: "#FFC071",
    });
    assert.deepEqual(getSandCanvasPaletteEntry(999), {
      fill: "#E6E6E6",
      shadow: "#B8C0BA",
      highlight: "#FFFFFF",
    });
  });

  it("keeps empty cells out of the sand draw list", () => {
    const model = createSandCanvasRenderModel(
      {
        width: 2,
        height: 2,
        cells: [null, 4, null, 5],
      },
      { maxWidth: 100, maxHeight: 100 },
    );

    assert.equal(model.sandCells.length, 2);
    assert.equal(model.sandCells.every((cell) => cell.colorId !== null), true);
    assert.equal(model.emptyCells.length, 2);
  });

  it("finds cells by stable index and coordinate", () => {
    const model = createSandCanvasRenderModel(
      {
        width: 2,
        height: 2,
        cells: [1, 2, 3, 4],
      },
      { maxWidth: 100, maxHeight: 100 },
    );

    assert.equal(findCanvasCell(model, { index: 2, x: 0, y: 1 })?.colorId, 3);
    assert.equal(findCanvasCell(model, { index: 2, x: 1, y: 1 })?.colorId, 4);
    assert.equal(findCanvasCell(model, { index: 99, x: 9, y: 9 }), null);
  });

  it("summarizes absorption without mutating allocation inputs", () => {
    const allocations = [
      {
        bucketInstanceId: "bucket-a",
        bucketIndex: 0,
        colorId: 1,
        sand: [
          { x: 0, y: 1, index: 2, colorId: 1 },
          { x: 1, y: 1, index: 3, colorId: 1 },
        ],
        absorbedCount: 2,
        bucketAmountBefore: 0,
        bucketAmountAfter: 2,
        bucketRemainingCapacityBefore: 4,
        bucketRemainingCapacityAfter: 2,
      },
    ];

    const summary = summarizeAbsorption(allocations);

    assert.equal(summary.allocationCount, 1);
    assert.equal(summary.absorbedCount, 2);
    assert.deepEqual(summary.bucketInstanceIds, ["bucket-a"]);
    assert.deepEqual(summary.sourceCells.map((cell) => cell.index), [2, 3]);
  });

  it("uses deterministic non-striped sand cell variation", () => {
    const first = Array.from({ length: 12 }, (_, index) => getSandCanvasCellVariation(index, index));
    const second = Array.from({ length: 12 }, (_, index) => getSandCanvasCellVariation(index, index));
    const row = Array.from({ length: 12 }, (_, index) => getSandCanvasCellVariation(index, 3));

    assert.deepEqual(first, second);
    assert.equal(new Set(row).size > 2, true);
    assert.equal(row.every((value) => value >= -3 && value <= 3), true);
  });

  it("fills every pixel of a non-empty 6x6 logical cell without fixed background grid lines", () => {
    const first = Array.from({ length: 36 }, (_, index) =>
      getSandCanvasCellPixelPaint(4, 7, index % 6, Math.floor(index / 6), 19),
    );
    const second = Array.from({ length: 36 }, (_, index) =>
      getSandCanvasCellPixelPaint(4, 7, index % 6, Math.floor(index / 6), 19),
    );

    assert.deepEqual(first, second);
    assert.equal(first.every((pixel) => pixel.usesBackgroundColor === false), true);
    assert.equal(first.every((pixel) => pixel.alpha >= 220), true);
    assert.equal(new Set(first.map((pixel) => `${pixel.brightnessDelta}:${pixel.alpha}`)).size > 1, true);
  });

  it("changes grain perturbation by seed without changing the logical canvas layout", () => {
    const seedA = getSandCanvasCellPixelPaint(10, 11, 2, 3, 1);
    const seedB = getSandCanvasCellPixelPaint(10, 11, 2, 3, 2);
    const layoutA = createSandCanvasRenderModel(
      { width: 2, height: 2, cells: [1, null, 2, null] },
      { maxWidth: 12, maxHeight: 12, innerWidth: 12, innerHeight: 12 },
    );
    const layoutB = createSandCanvasRenderModel(
      { width: 2, height: 2, cells: [1, null, 2, null] },
      { maxWidth: 12, maxHeight: 12, innerWidth: 12, innerHeight: 12 },
    );

    assert.notDeepEqual(seedA, seedB);
    assert.deepEqual(layoutA.cells, layoutB.cells);
  });
});
