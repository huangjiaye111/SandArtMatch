export type RandomSeed = string | number;

export interface RandomSnapshot {
  algorithm: "xorshift32";
  state: number;
}

const ALGORITHM: RandomSnapshot["algorithm"] = "xorshift32";
const UINT32_RANGE = 0x100000000;
const DEFAULT_NON_ZERO_STATE = 0x6d2b79f5;

export class SeededRandom {
  private state: number;

  public constructor(seedOrSnapshot: RandomSeed | RandomSnapshot) {
    if (isRandomSnapshot(seedOrSnapshot)) {
      validateSnapshot(seedOrSnapshot);
      this.state = normalizeState(seedOrSnapshot.state);
      return;
    }

    this.state = seedToState(seedOrSnapshot);
  }

  public static fromSeed(seed: RandomSeed): SeededRandom {
    return new SeededRandom(seed);
  }

  public static fromSnapshot(snapshot: RandomSnapshot): SeededRandom {
    return new SeededRandom(snapshot);
  }

  public snapshot(): RandomSnapshot {
    return {
      algorithm: ALGORITHM,
      state: this.state,
    };
  }

  public restore(snapshot: RandomSnapshot): void {
    validateSnapshot(snapshot);
    this.state = normalizeState(snapshot.state);
  }

  public nextUint32(): number {
    let next = this.state;
    next ^= next << 13;
    next ^= next >>> 17;
    next ^= next << 5;
    this.state = normalizeState(next);
    return this.state;
  }

  public nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  public intInclusive(min: number, max: number): number {
    validateIntegerRange(min, max);

    const span = max - min + 1;
    if (span > UINT32_RANGE) {
      throw new RangeError("Range size must not exceed 2^32.");
    }

    const threshold = UINT32_RANGE - (UINT32_RANGE % span);
    let value = this.nextUint32();
    while (value >= threshold) {
      value = this.nextUint32();
    }

    return min + (value % span);
  }

  public index(length: number): number {
    if (!Number.isSafeInteger(length) || length <= 0) {
      throw new RangeError("Length must be a positive safe integer.");
    }

    return this.intInclusive(0, length - 1);
  }
}

export function createSeededRandom(seed: RandomSeed): SeededRandom {
  return SeededRandom.fromSeed(seed);
}

function seedToState(seed: RandomSeed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new RangeError("Numeric seed must be finite.");
    }

    return normalizeState(seed);
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return normalizeState(hash);
}

function normalizeState(value: number): number {
  const normalized = value >>> 0;
  return normalized === 0 ? DEFAULT_NON_ZERO_STATE : normalized;
}

function isRandomSnapshot(value: RandomSeed | RandomSnapshot): value is RandomSnapshot {
  return typeof value === "object" && value !== null && "algorithm" in value && "state" in value;
}

function validateSnapshot(snapshot: RandomSnapshot): void {
  if (snapshot.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported random algorithm: ${snapshot.algorithm}`);
  }

  if (!Number.isSafeInteger(snapshot.state) || snapshot.state < 0 || snapshot.state > 0xffffffff) {
    throw new RangeError("Snapshot state must be a uint32 integer.");
  }

  if (snapshot.state === 0) {
    throw new RangeError("Snapshot state must be non-zero.");
  }
}

function validateIntegerRange(min: number, max: number): void {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new RangeError("Integer range bounds must be safe integers.");
  }

  if (max < min) {
    throw new RangeError("Max must be greater than or equal to min.");
  }
}
