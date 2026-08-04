export interface ConveyorSlotLayout {
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

export interface ConveyorLayoutModel {
  readonly width: number;
  readonly height: number;
  readonly slotWidth: number;
  readonly slotHeight: number;
  readonly slots: readonly ConveyorSlotLayout[];
}

const SLOT_COUNT = 6;
const DEFAULT_WIDTH = 660;
const DEFAULT_HEIGHT = 132;
const DEFAULT_SLOT_WIDTH = 96;
const DEFAULT_SLOT_HEIGHT = 78;

export function createConveyorLayoutModel(
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): ConveyorLayoutModel {
  if (!Number.isFinite(width) || width <= 0) {
    throw new RangeError("Conveyor layout width must be positive.");
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError("Conveyor layout height must be positive.");
  }

  const usableWidth = Math.max(DEFAULT_SLOT_WIDTH * SLOT_COUNT, width - 80);
  const step = usableWidth / SLOT_COUNT;
  const start = -usableWidth / 2 + step / 2;
  const slots: ConveyorSlotLayout[] = [];
  for (let index = 0; index < SLOT_COUNT; index += 1) {
    slots.push(Object.freeze({ index, x: Math.round(start + step * index), y: 0 }));
  }

  return Object.freeze({
    width,
    height,
    slotWidth: DEFAULT_SLOT_WIDTH,
    slotHeight: DEFAULT_SLOT_HEIGHT,
    slots: Object.freeze(slots),
  });
}
