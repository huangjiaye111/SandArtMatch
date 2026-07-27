import type { SandCellValue, SandColorId, SandGridConfig } from "../config/LevelConfig";

const MAX_GRID_CELLS = 1_000_000;

export interface SandGridSnapshot {
  width: number;
  height: number;
  cells: readonly SandCellValue[];
}

export class SandGrid {
  public readonly width: number;
  public readonly height: number;

  private readonly cells: SandCellValue[];

  public constructor(width: number, height: number, cells?: readonly SandCellValue[]) {
    validateGridSize(width, height);

    this.width = width;
    this.height = height;
    this.cells = cells === undefined ? createEmptyCells(width, height) : validateFlatCells(width, height, cells);
  }

  public static empty(width: number, height: number): SandGrid {
    return new SandGrid(width, height);
  }

  public static fromConfig(config: SandGridConfig): SandGrid {
    if (config.cells === undefined) {
      return SandGrid.empty(config.width, config.height);
    }

    validateGridSize(config.width, config.height);
    if (config.cells.length !== config.height) {
      throw new RangeError("Grid config row count must match height.");
    }

    const cells: SandCellValue[] = [];
    for (let y = 0; y < config.height; y += 1) {
      const row = config.cells[y];
      if (!Array.isArray(row)) {
        throw new RangeError("Grid config rows must be arrays.");
      }

      if (row.length !== config.width) {
        throw new RangeError("Grid config column count must match width.");
      }

      for (const value of row) {
        cells.push(validateCellValue(value));
      }
    }

    return new SandGrid(config.width, config.height, cells);
  }

  public static fromSnapshot(snapshot: SandGridSnapshot): SandGrid {
    return new SandGrid(snapshot.width, snapshot.height, snapshot.cells);
  }

  public get(x: number, y: number): SandCellValue {
    return this.cells[this.indexOf(x, y)];
  }

  public set(x: number, y: number, colorId: SandColorId): void {
    validateColorId(colorId);
    this.cells[this.indexOf(x, y)] = colorId;
  }

  public clear(x: number, y: number): void {
    this.cells[this.indexOf(x, y)] = null;
  }

  public clearAll(): void {
    this.cells.fill(null);
  }

  public hasSandAt(x: number, y: number): boolean {
    return this.get(x, y) !== null;
  }

  public countSand(colorId?: SandColorId): number {
    if (colorId !== undefined) {
      validateColorId(colorId);
    }

    let count = 0;
    for (const cell of this.cells) {
      if (colorId === undefined ? cell !== null : cell === colorId) {
        count += 1;
      }
    }

    return count;
  }

  public isEmpty(): boolean {
    return this.countSand() === 0;
  }

  public clone(): SandGrid {
    return SandGrid.fromSnapshot(this.snapshot());
  }

  public snapshot(): SandGridSnapshot {
    return {
      width: this.width,
      height: this.height,
      cells: Object.freeze([...this.cells]),
    };
  }

  public toRows(): SandCellValue[][] {
    const rows: SandCellValue[][] = [];
    for (let y = 0; y < this.height; y += 1) {
      const start = y * this.width;
      rows.push(this.cells.slice(start, start + this.width));
    }

    return rows;
  }

  private indexOf(x: number, y: number): number {
    validateCoordinate("x", x, this.width);
    validateCoordinate("y", y, this.height);
    return y * this.width + x;
  }
}

function createEmptyCells(width: number, height: number): SandCellValue[] {
  return new Array<SandCellValue>(cellCountFor(width, height)).fill(null);
}

function validateFlatCells(width: number, height: number, cells: readonly SandCellValue[]): SandCellValue[] {
  if (cells.length !== cellCountFor(width, height)) {
    throw new RangeError("Snapshot cell count must match grid dimensions.");
  }

  return cells.map(validateCellValue);
}

function validateGridSize(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || width <= 0) {
    throw new RangeError("Grid width must be a positive safe integer.");
  }

  if (!Number.isSafeInteger(height) || height <= 0) {
    throw new RangeError("Grid height must be a positive safe integer.");
  }

  cellCountFor(width, height);
}

function validateCoordinate(name: "x" | "y", value: number, limit: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= limit) {
    throw new RangeError(`Grid ${name} coordinate is out of bounds.`);
  }
}

function validateCellValue(value: SandCellValue): SandCellValue {
  if (value === null) {
    return value;
  }

  validateColorId(value);
  return value;
}

function validateColorId(colorId: SandColorId): void {
  if (!Number.isSafeInteger(colorId) || colorId <= 0) {
    throw new RangeError("Sand color id must be a positive safe integer.");
  }
}

function cellCountFor(width: number, height: number): number {
  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cellCount > MAX_GRID_CELLS) {
    throw new RangeError(`Grid cell count must be a safe integer no greater than ${MAX_GRID_CELLS}.`);
  }

  return cellCount;
}
