export type SandColorId = number;
export type EmptySandCell = null;
export type SandCellValue = SandColorId | EmptySandCell;

export interface SandGridConfig {
  width: number;
  height: number;
  cells?: readonly (readonly SandCellValue[])[];
}

