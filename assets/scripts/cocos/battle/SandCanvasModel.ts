import type { AbsorbAllocation, AbsorbedSandCell } from "../../domain/battle/Settlement";
import type { SandCellValue } from "../../domain/config/LevelConfig";
import type { SandGridSnapshot } from "../../domain/core/SandGrid";

export interface SandCanvasSize {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly minCellSize?: number;
  readonly innerWidth?: number;
  readonly innerHeight?: number;
}

export interface SandCanvasCellRect {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly colorId: SandCellValue;
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
}

export interface SandCanvasRenderModel {
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly cellSize: number;
  readonly gap: number;
  readonly totalWidth: number;
  readonly totalHeight: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly cells: readonly SandCanvasCellRect[];
  readonly sandCells: readonly SandCanvasCellRect[];
  readonly emptyCells: readonly SandCanvasCellRect[];
}

export interface SandCanvasPaletteEntry {
  readonly fill: string;
  readonly shadow: string;
  readonly highlight: string;
}

export interface SandAbsorbVisualSummary {
  readonly allocationCount: number;
  readonly absorbedCount: number;
  readonly bucketInstanceIds: readonly string[];
  readonly sourceCells: readonly AbsorbedSandCell[];
}

export interface SandCanvasCellPixelPaint {
  readonly brightnessDelta: number;
  readonly alpha: number;
  readonly usesBackgroundColor: boolean;
}

const DEFAULT_MIN_CELL_SIZE = 1;
const GAP_RATIO = 0.04;
const DEFAULT_INNER_WIDTH = 600;
const DEFAULT_INNER_HEIGHT = 600;

const SAND_PALETTE: Record<number, SandCanvasPaletteEntry> = Object.freeze({
  1: Object.freeze({ fill: "#F27C8A", shadow: "#C85B67", highlight: "#FFA4AD" }),
  2: Object.freeze({ fill: "#4DB6E8", shadow: "#2C86B6", highlight: "#82D2FF" }),
  3: Object.freeze({ fill: "#F6D84A", shadow: "#C9A92A", highlight: "#FFE978" }),
  4: Object.freeze({ fill: "#58C889", shadow: "#329C62", highlight: "#8BE3B0" }),
  5: Object.freeze({ fill: "#9B7BEA", shadow: "#7155BD", highlight: "#BCA7FF" }),
  6: Object.freeze({ fill: "#F49A3F", shadow: "#C46E24", highlight: "#FFC071" }),
  7: Object.freeze({ fill: "#D94C64", shadow: "#A93448", highlight: "#F47B8D" }),
  8: Object.freeze({ fill: "#6ECFC9", shadow: "#409B97", highlight: "#9DEBE6" }),
  9: Object.freeze({ fill: "#5869D8", shadow: "#3C49A6", highlight: "#8795FF" }),
  10: Object.freeze({ fill: "#F2E8C9", shadow: "#C9B989", highlight: "#FFF4D6" }),
  11: Object.freeze({ fill: "#9A6A45", shadow: "#70472D", highlight: "#BD8C62" }),
  12: Object.freeze({ fill: "#46505A", shadow: "#2D333A", highlight: "#6C7784" }),
});

const FALLBACK_PALETTE: SandCanvasPaletteEntry = Object.freeze({
  fill: "#E6E6E6",
  shadow: "#B8C0BA",
  highlight: "#FFFFFF",
});

export function createSandCanvasRenderModel(
  grid: SandGridSnapshot,
  size: SandCanvasSize,
): SandCanvasRenderModel {
  validateGridSnapshot(grid);
  validateSize(size);

  const minCellSize = size.minCellSize ?? DEFAULT_MIN_CELL_SIZE;
  const innerWidth = size.innerWidth ?? Math.min(size.maxWidth, DEFAULT_INNER_WIDTH);
  const innerHeight = size.innerHeight ?? Math.min(size.maxHeight, DEFAULT_INNER_HEIGHT);
  const rawCellSize = Math.min(innerWidth / grid.width, innerHeight / grid.height);
  const cellSize = Math.max(minCellSize, Math.floor(rawCellSize));
  const gap = cellSize <= 7 ? 0 : Math.max(1, Math.floor(cellSize * GAP_RATIO));
  const drawSize = Math.max(1, cellSize - gap);
  const totalWidth = grid.width * cellSize;
  const totalHeight = grid.height * cellSize;
  const offsetX = Math.floor((innerWidth - totalWidth) / 2);
  const offsetY = Math.floor((innerHeight - totalHeight) / 2);
  const cells: SandCanvasCellRect[] = [];
  const sandCells: SandCanvasCellRect[] = [];
  const emptyCells: SandCanvasCellRect[] = [];

  for (let index = 0; index < grid.cells.length; index += 1) {
    const x = index % grid.width;
    const y = Math.floor(index / grid.width);
    const cell: SandCanvasCellRect = Object.freeze({
      index,
      x,
      y,
      colorId: grid.cells[index],
      centerX: -innerWidth / 2 + offsetX + x * cellSize + cellSize / 2,
      centerY: innerHeight / 2 - offsetY - y * cellSize - cellSize / 2,
      size: drawSize,
    });
    cells.push(cell);
    if (cell.colorId === null) {
      emptyCells.push(cell);
    } else {
      sandCells.push(cell);
    }
  }

  return Object.freeze({
    gridWidth: grid.width,
    gridHeight: grid.height,
    cellSize,
    gap,
    totalWidth,
    totalHeight,
    innerWidth,
    innerHeight,
    offsetX,
    offsetY,
    cells: Object.freeze(cells),
    sandCells: Object.freeze(sandCells),
    emptyCells: Object.freeze(emptyCells),
  });
}

export function getSandCanvasPaletteEntry(colorId: number): SandCanvasPaletteEntry {
  return SAND_PALETTE[colorId] ?? FALLBACK_PALETTE;
}

export function getSandCanvasCellVariation(x: number, y: number, seed = 0): number {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(seed)) {
    throw new TypeError("Sand canvas variation coordinates and seed must be safe integers.");
  }
  let hash = (x + 1) * 374761393 + (y + 1) * 668265263 + seed * 2246822519;
  hash = (hash ^ (hash >>> 13)) * 1274126177;
  hash ^= hash >>> 16;
  return positiveMod(hash, 7) - 3;
}

export function getSandCanvasCellPixelPaint(
  cellX: number,
  cellY: number,
  pixelX: number,
  pixelY: number,
  seed = 0,
): SandCanvasCellPixelPaint {
  if (
    !Number.isSafeInteger(cellX) ||
    !Number.isSafeInteger(cellY) ||
    !Number.isSafeInteger(pixelX) ||
    !Number.isSafeInteger(pixelY) ||
    !Number.isSafeInteger(seed)
  ) {
    throw new TypeError("Sand canvas pixel paint coordinates and seed must be safe integers.");
  }

  const hash = hashCoordinates(cellX, cellY, pixelX, pixelY, seed);
  const grain = positiveMod(hash, 17);
  const pore = positiveMod(hash >>> 4, 113) === 0;
  return Object.freeze({
    brightnessDelta: grain <= 2 ? -5 : grain >= 14 ? 5 : getSandCanvasCellVariation(cellX, cellY, seed),
    alpha: pore ? 226 : 255,
    usesBackgroundColor: false,
  });
}

export function summarizeAbsorption(allocations: readonly AbsorbAllocation[]): SandAbsorbVisualSummary {
  const sourceCells: AbsorbedSandCell[] = [];
  const bucketInstanceIds: string[] = [];
  for (const allocation of allocations) {
    if (!bucketInstanceIds.includes(allocation.bucketInstanceId)) {
      bucketInstanceIds.push(allocation.bucketInstanceId);
    }
    sourceCells.push(...allocation.sand);
  }

  return Object.freeze({
    allocationCount: allocations.length,
    absorbedCount: sourceCells.length,
    bucketInstanceIds: Object.freeze(bucketInstanceIds),
    sourceCells: Object.freeze(sourceCells.map((cell) => Object.freeze({ ...cell }))),
  });
}

export function findCanvasCell(
  model: SandCanvasRenderModel,
  cell: Pick<AbsorbedSandCell, "index" | "x" | "y">,
): SandCanvasCellRect | null {
  if (cell.index >= 0 && cell.index < model.cells.length) {
    const candidate = model.cells[cell.index];
    if (candidate.x === cell.x && candidate.y === cell.y) {
      return candidate;
    }
  }
  return model.cells.find((candidate) => candidate.x === cell.x && candidate.y === cell.y) ?? null;
}

function validateGridSnapshot(grid: SandGridSnapshot): void {
  if (typeof grid !== "object" || grid === null) {
    throw new TypeError("Sand canvas requires a grid snapshot.");
  }
  if (!Number.isSafeInteger(grid.width) || grid.width <= 0) {
    throw new RangeError("Sand canvas grid width must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(grid.height) || grid.height <= 0) {
    throw new RangeError("Sand canvas grid height must be a positive safe integer.");
  }
  if (!Array.isArray(grid.cells) || grid.cells.length !== grid.width * grid.height) {
    throw new RangeError("Sand canvas grid cells must match width * height.");
  }
}

function validateSize(size: SandCanvasSize): void {
  if (typeof size !== "object" || size === null) {
    throw new TypeError("Sand canvas size is required.");
  }
  if (!Number.isFinite(size.maxWidth) || size.maxWidth <= 0) {
    throw new RangeError("Sand canvas maxWidth must be positive.");
  }
  if (!Number.isFinite(size.maxHeight) || size.maxHeight <= 0) {
    throw new RangeError("Sand canvas maxHeight must be positive.");
  }
  if (size.innerWidth !== undefined && (!Number.isFinite(size.innerWidth) || size.innerWidth <= 0)) {
    throw new RangeError("Sand canvas innerWidth must be positive.");
  }
  if (size.innerHeight !== undefined && (!Number.isFinite(size.innerHeight) || size.innerHeight <= 0)) {
    throw new RangeError("Sand canvas innerHeight must be positive.");
  }
  if (size.minCellSize !== undefined && (!Number.isFinite(size.minCellSize) || size.minCellSize <= 0)) {
    throw new RangeError("Sand canvas minCellSize must be positive.");
  }
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hashCoordinates(cellX: number, cellY: number, pixelX: number, pixelY: number, seed: number): number {
  let hash =
    (cellX + 1) * 374761393 +
    (cellY + 1) * 668265263 +
    (pixelX + 1) * 1442695041 +
    (pixelY + 1) * 1013904223 +
    seed * 2246822519;
  hash = (hash ^ (hash >>> 15)) * 2246822519;
  hash = (hash ^ (hash >>> 13)) * 3266489917;
  return hash ^ (hash >>> 16);
}
