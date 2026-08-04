export interface ConveyorCarrierPoint {
  readonly x: number;
  readonly y: number;
}

export interface ConveyorCarrierLayout {
  readonly slotCount: number;
  readonly spacing: number;
  readonly slotPositions: readonly ConveyorCarrierPoint[];
  readonly loopLength: number;
  readonly loopStartX: number;
  readonly visibleStartX: number;
  readonly visibleEndX: number;
}

export interface CarrierEnterMotionPlan {
  readonly revision: number;
  readonly movementId: number;
  readonly bucketId: string;
  readonly slotIndex: number;
  readonly duration: number;
  readonly landingCompressDuration: number;
  readonly landingRecoverDuration: number;
  readonly fromPosition: ConveyorCarrierPoint;
  readonly toPosition: ConveyorCarrierPoint;
}

export interface CarrierMoveMotionPlan {
  readonly bucketId: string;
  readonly fromSlotIndex: number;
  readonly toSlotIndex: number;
  readonly fromPosition: ConveyorCarrierPoint;
  readonly toPosition: ConveyorCarrierPoint;
}

export function createConveyorCarrierLayout(input: {
  readonly slotPositions: readonly ConveyorCarrierPoint[];
}): ConveyorCarrierLayout {
  if (input.slotPositions.length < 2) {
    throw new RangeError("Carrier layout requires at least two visible positions.");
  }
  const spacing = input.slotPositions[1].x - input.slotPositions[0].x;
  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new RangeError("Carrier positions must advance left to right with positive spacing.");
  }
  for (let index = 1; index < input.slotPositions.length; index += 1) {
    const previous = input.slotPositions[index - 1];
    const current = input.slotPositions[index];
    if (Math.abs((current.x - previous.x) - spacing) > 1) {
      throw new Error("Carrier spacing must remain stable.");
    }
    if (current.x <= previous.x) {
      throw new Error("Carrier slots must not cross each other.");
    }
  }
  const slotPositions = input.slotPositions.map((position) => Object.freeze({ ...position }));
  const loopLength = spacing * slotPositions.length;
  const loopStartX = slotPositions[0].x - spacing;
  return Object.freeze({
    slotCount: slotPositions.length,
    spacing,
    slotPositions: Object.freeze(slotPositions),
    loopLength,
    loopStartX,
    visibleStartX: slotPositions[0].x - spacing * 0.5,
    visibleEndX: slotPositions[slotPositions.length - 1].x + spacing * 0.5,
  });
}

export function getConveyorCarrierSlotPosition(
  layout: ConveyorCarrierLayout,
  slotIndex: number,
): ConveyorCarrierPoint {
  const position = layout.slotPositions[slotIndex];
  if (position === undefined) {
    throw new RangeError(`Invalid carrier slot index: ${slotIndex}`);
  }
  return position;
}

export function createCarrierMoveMotionPlan(input: {
  readonly bucketId: string;
  readonly fromSlotIndex: number;
  readonly toSlotIndex: number;
  readonly layout: ConveyorCarrierLayout;
}): CarrierMoveMotionPlan {
  return Object.freeze({
    bucketId: input.bucketId,
    fromSlotIndex: input.fromSlotIndex,
    toSlotIndex: input.toSlotIndex,
    fromPosition: getConveyorCarrierSlotPosition(input.layout, input.fromSlotIndex),
    toPosition: getConveyorCarrierSlotPosition(input.layout, input.toSlotIndex),
  });
}

export function sampleConveyorLoopPosition(
  layout: ConveyorCarrierLayout,
  carrierIndex: number,
  phase: number,
): ConveyorCarrierPoint {
  const wrapped = positiveModulo(carrierIndex * layout.spacing + phase, layout.loopLength);
  return Object.freeze({
    x: layout.loopStartX + wrapped,
    y: layout.slotPositions[carrierIndex]?.y ?? layout.slotPositions[0].y,
  });
}

export function selectVisibleEmptyCarrierIndex(input: {
  readonly layout: ConveyorCarrierLayout;
  readonly phase: number;
  readonly occupiedCarrierIndexes: ReadonlySet<number>;
  readonly reservationSeed: number;
}): number {
  const visible: number[] = [];
  for (let index = 0; index < input.layout.slotCount; index += 1) {
    if (input.occupiedCarrierIndexes.has(index)) {
      continue;
    }
    const position = sampleConveyorLoopPosition(input.layout, index, input.phase);
    if (position.x >= input.layout.visibleStartX && position.x <= input.layout.visibleEndX) {
      visible.push(index);
    }
  }
  const candidates = visible.length > 0 ? visible : [...Array(input.layout.slotCount).keys()].filter((index) => !input.occupiedCarrierIndexes.has(index));
  if (candidates.length === 0) {
    return 0;
  }
  return candidates[positiveModulo(input.reservationSeed, candidates.length)];
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
