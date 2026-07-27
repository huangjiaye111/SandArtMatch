export type SandColorId = number;
export type EmptySandCell = null;
export type SandCellValue = SandColorId | EmptySandCell;

export interface SandGridConfig {
  width: number;
  height: number;
  cells?: readonly (readonly SandCellValue[])[];
}

export const LEVEL_CONFIG_VERSION = 1;
export const MAX_LEVEL_GRID_CELLS = 1_000_000;
export const DEFAULT_LEVEL_CONVEYOR_SLOTS = 6;
export const DEFAULT_RULES: LevelRulesConfig = Object.freeze({
  mergeCount: 3,
  mergeScope: "global",
  absorbMode: "exposedSameColor",
  allowPartialBucketMerge: true,
  allowDifferentCapacityMerge: true,
  enableSideSlip: true,
  mergeSpeedMultiplier: 1,
});

export type LevelConfigVersion = typeof LEVEL_CONFIG_VERSION;
export type MergeScope = "global";
export type AbsorbMode = "exposedSameColor";
export type BucketSpecialType = "normal";

export interface LevelRulesConfig {
  readonly mergeCount: number;
  readonly mergeScope: MergeScope;
  readonly absorbMode: AbsorbMode;
  readonly allowPartialBucketMerge: boolean;
  readonly allowDifferentCapacityMerge: boolean;
  readonly enableSideSlip: boolean;
  readonly mergeSpeedMultiplier: number;
}

export interface LevelBucketConfig {
  readonly configId: string;
  readonly colorId: SandColorId;
  readonly capacity: number;
  readonly initialAmount: number;
  readonly specialType: BucketSpecialType;
}

export interface LevelConfig {
  readonly version: LevelConfigVersion;
  readonly levelId: number;
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  readonly sandMap: readonly SandCellValue[];
  readonly conveyorSlots: number;
  readonly bucketQueue: readonly LevelBucketConfig[];
  readonly rules: LevelRulesConfig;
}

export type RawLevelConfig = unknown;

export interface LevelConfigErrorDetail {
  readonly path: string;
  readonly message: string;
}

export class LevelConfigError extends Error {
  public readonly details: readonly LevelConfigErrorDetail[];

  public constructor(details: readonly LevelConfigErrorDetail[]) {
    super(formatLevelConfigError(details));
    this.name = "LevelConfigError";
    this.details = Object.freeze(details.map((detail) => Object.freeze({ ...detail })));
  }
}

export function parseLevelConfig(raw: RawLevelConfig): LevelConfig {
  const errors: LevelConfigErrorDetail[] = [];
  if (!isRecord(raw)) {
    throw new LevelConfigError([errorAt("$", "Level config must be an object.")]);
  }

  rejectUnknownKeys(raw, "$", ["version", "levelId", "seed", "width", "height", "sandMap", "conveyorSlots", "bucketQueue", "rules"], errors);

  const version = raw.version === undefined ? LEVEL_CONFIG_VERSION : raw.version;
  if (version !== LEVEL_CONFIG_VERSION) {
    errors.push(errorAt("version", `Level config version must be ${LEVEL_CONFIG_VERSION}.`));
  }

  const levelId = readPositiveSafeInteger(raw.levelId, "levelId", errors);
  const width = readPositiveSafeInteger(raw.width, "width", errors);
  const height = readPositiveSafeInteger(raw.height, "height", errors);
  const seed = readSeed(raw.seed, "seed", errors);
  const conveyorSlots = raw.conveyorSlots === undefined
    ? DEFAULT_LEVEL_CONVEYOR_SLOTS
    : readPositiveSafeInteger(raw.conveyorSlots, "conveyorSlots", errors);
  const rules = readRules(raw.rules, "rules", errors);

  const cellCount = validateCellCount(width, height, errors);
  const sandMap = readSandMap(raw.sandMap, "sandMap", cellCount, errors);
  const bucketQueue = readBucketQueue(raw.bucketQueue, "bucketQueue", errors);

  if (errors.length > 0) {
    throw new LevelConfigError(errors);
  }

  return deepFreezeLevelConfig({
    version: LEVEL_CONFIG_VERSION,
    levelId: levelId as number,
    seed: seed as string,
    width: width as number,
    height: height as number,
    sandMap: sandMap as SandCellValue[],
    conveyorSlots: conveyorSlots as number,
    bucketQueue: bucketQueue as LevelBucketConfig[],
    rules,
  });
}

function readRules(rawRules: unknown, path: string, errors: LevelConfigErrorDetail[]): LevelRulesConfig {
  if (rawRules === undefined) {
    return DEFAULT_RULES;
  }

  if (!isRecord(rawRules)) {
    errors.push(errorAt(path, "Rules must be an object."));
    return DEFAULT_RULES;
  }

  rejectUnknownKeys(rawRules, path, Object.keys(DEFAULT_RULES), errors);

  const mergeCount = rawRules.mergeCount === undefined
    ? DEFAULT_RULES.mergeCount
    : readPositiveSafeInteger(rawRules.mergeCount, `${path}.mergeCount`, errors);
  if (mergeCount !== undefined && mergeCount !== 3) {
    errors.push(errorAt(`${path}.mergeCount`, "Merge count must be 3 for MVP."));
  }

  const mergeScope = rawRules.mergeScope === undefined ? DEFAULT_RULES.mergeScope : rawRules.mergeScope;
  if (mergeScope !== "global") {
    errors.push(errorAt(`${path}.mergeScope`, "Merge scope must be global for MVP."));
  }

  const absorbMode = rawRules.absorbMode === undefined ? DEFAULT_RULES.absorbMode : rawRules.absorbMode;
  if (absorbMode !== "exposedSameColor") {
    errors.push(errorAt(`${path}.absorbMode`, "Absorb mode must be exposedSameColor for MVP."));
  }

  const allowPartialBucketMerge = readBooleanWithDefault(
    rawRules.allowPartialBucketMerge,
    DEFAULT_RULES.allowPartialBucketMerge,
    `${path}.allowPartialBucketMerge`,
    errors,
  );
  if (allowPartialBucketMerge === false) {
    errors.push(errorAt(`${path}.allowPartialBucketMerge`, "Partial bucket merge must be allowed for the current MVP merge system."));
  }

  const allowDifferentCapacityMerge = readBooleanWithDefault(
    rawRules.allowDifferentCapacityMerge,
    DEFAULT_RULES.allowDifferentCapacityMerge,
    `${path}.allowDifferentCapacityMerge`,
    errors,
  );
  if (allowDifferentCapacityMerge === false) {
    errors.push(errorAt(`${path}.allowDifferentCapacityMerge`, "Different capacity merge must be allowed for MVP."));
  }

  const enableSideSlip = readBooleanWithDefault(rawRules.enableSideSlip, DEFAULT_RULES.enableSideSlip, `${path}.enableSideSlip`, errors);
  if (enableSideSlip === false) {
    errors.push(errorAt(`${path}.enableSideSlip`, "Side slip must be enabled for the current MVP gravity system."));
  }

  const mergeSpeedMultiplier = rawRules.mergeSpeedMultiplier === undefined
    ? DEFAULT_RULES.mergeSpeedMultiplier
    : readPositiveFiniteNumber(rawRules.mergeSpeedMultiplier, `${path}.mergeSpeedMultiplier`, errors);
  if (mergeSpeedMultiplier !== undefined && mergeSpeedMultiplier !== DEFAULT_RULES.mergeSpeedMultiplier) {
    errors.push(errorAt(`${path}.mergeSpeedMultiplier`, `Merge speed multiplier must be ${DEFAULT_RULES.mergeSpeedMultiplier} for the current MVP merge system.`));
  }

  return Object.freeze({
    mergeCount: mergeCount ?? DEFAULT_RULES.mergeCount,
    mergeScope: "global",
    absorbMode: "exposedSameColor",
    allowPartialBucketMerge,
    allowDifferentCapacityMerge,
    enableSideSlip,
    mergeSpeedMultiplier: mergeSpeedMultiplier ?? DEFAULT_RULES.mergeSpeedMultiplier,
  });
}

function readBucketQueue(rawQueue: unknown, path: string, errors: LevelConfigErrorDetail[]): LevelBucketConfig[] {
  if (!Array.isArray(rawQueue)) {
    errors.push(errorAt(path, "Bucket queue must be an array."));
    return [];
  }

  const seenConfigIds = new Set<string>();
  const bucketQueue: LevelBucketConfig[] = [];
  for (let index = 0; index < rawQueue.length; index += 1) {
    const bucketPath = `${path}[${index}]`;
    if (!(index in rawQueue)) {
      errors.push(errorAt(bucketPath, "Bucket config is missing."));
      bucketQueue.push(fallbackBucketConfig(index));
      continue;
    }

    const rawBucket = rawQueue[index];
    if (!isRecord(rawBucket)) {
      errors.push(errorAt(bucketPath, "Bucket config must be an object."));
      bucketQueue.push(fallbackBucketConfig(index));
      continue;
    }

    rejectUnknownKeys(rawBucket, bucketPath, ["configId", "colorId", "capacity", "initialAmount", "specialType"], errors);

    const configId = readConfigId(rawBucket.configId, `${bucketPath}.configId`, errors);
    if (configId !== undefined) {
      if (seenConfigIds.has(configId)) {
        errors.push(errorAt(`${bucketPath}.configId`, `Duplicate bucket configId: ${configId}.`));
      }
      seenConfigIds.add(configId);
    }

    const colorId = readColorId(rawBucket.colorId, `${bucketPath}.colorId`, errors);
    const capacity = readPositiveSafeInteger(rawBucket.capacity, `${bucketPath}.capacity`, errors);
    const initialAmount = rawBucket.initialAmount === undefined
      ? 0
      : readNonNegativeSafeInteger(rawBucket.initialAmount, `${bucketPath}.initialAmount`, errors);
    if (capacity !== undefined && initialAmount !== undefined && initialAmount > capacity) {
      errors.push(errorAt(`${bucketPath}.initialAmount`, "Bucket initialAmount must not exceed capacity."));
    }

    const specialType = rawBucket.specialType === undefined ? "normal" : rawBucket.specialType;
    if (specialType !== "normal") {
      errors.push(errorAt(`${bucketPath}.specialType`, "Only normal buckets are supported in MVP."));
    }

    bucketQueue.push(Object.freeze({
      configId: configId ?? `bucket-${index + 1}`,
      colorId: colorId ?? 1,
      capacity: capacity ?? 1,
      initialAmount: initialAmount ?? 0,
      specialType: "normal",
    }));
  }

  return bucketQueue;
}

function readSandMap(rawSandMap: unknown, path: string, expectedCellCount: number | undefined, errors: LevelConfigErrorDetail[]): SandCellValue[] {
  if (!Array.isArray(rawSandMap)) {
    errors.push(errorAt(path, "sandMap must be a flat array."));
    return [];
  }

  if (expectedCellCount === undefined) {
    return [];
  }

  if (expectedCellCount !== undefined && rawSandMap.length !== expectedCellCount) {
    errors.push(errorAt(path, `sandMap length must equal width * height (${expectedCellCount}).`));
  }

  const sandMap: SandCellValue[] = [];
  for (let index = 0; index < rawSandMap.length; index += 1) {
    if (!(index in rawSandMap)) {
      errors.push(errorAt(`${path}[${index}]`, "sandMap cell is missing."));
      sandMap.push(null);
      continue;
    }

    const value = rawSandMap[index];
    if (value === null) {
      sandMap.push(null);
      continue;
    }

    const colorId = readColorId(value, `${path}[${index}]`, errors);
    sandMap.push(colorId ?? 1);
  }

  return sandMap;
}

function validateCellCount(width: number | undefined, height: number | undefined, errors: LevelConfigErrorDetail[]): number | undefined {
  if (width === undefined || height === undefined) {
    return undefined;
  }

  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cellCount > MAX_LEVEL_GRID_CELLS) {
    errors.push(errorAt("width", `width * height must be a safe integer no greater than ${MAX_LEVEL_GRID_CELLS}.`));
    errors.push(errorAt("height", `width * height must be a safe integer no greater than ${MAX_LEVEL_GRID_CELLS}.`));
    return undefined;
  }

  return cellCount;
}

function readSeed(value: unknown, path: string, errors: LevelConfigErrorDetail[]): string | undefined {
  if (typeof value === "string") {
    if (value.length === 0) {
      errors.push(errorAt(path, "Seed string must be non-empty."));
      return undefined;
    }
    return value;
  }

  errors.push(errorAt(path, "Seed must be a non-empty string."));
  return undefined;
}

function readConfigId(value: unknown, path: string, errors: LevelConfigErrorDetail[]): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(errorAt(path, "Bucket configId must be a non-empty string."));
    return undefined;
  }

  return value;
}

function readColorId(value: unknown, path: string, errors: LevelConfigErrorDetail[]): SandColorId | undefined {
  const colorId = readPositiveSafeInteger(value, path, errors);
  if (colorId === undefined) {
    return undefined;
  }

  return colorId;
}

function readPositiveSafeInteger(value: unknown, path: string, errors: LevelConfigErrorDetail[]): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    errors.push(errorAt(path, "Value must be a positive safe integer."));
    return undefined;
  }

  return value as number;
}

function readNonNegativeSafeInteger(value: unknown, path: string, errors: LevelConfigErrorDetail[]): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    errors.push(errorAt(path, "Value must be a non-negative safe integer."));
    return undefined;
  }

  return value as number;
}

function readPositiveFiniteNumber(value: unknown, path: string, errors: LevelConfigErrorDetail[]): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(errorAt(path, "Value must be a positive finite number."));
    return undefined;
  }

  return value;
}

function readBooleanWithDefault(value: unknown, fallback: boolean, path: string, errors: LevelConfigErrorDetail[]): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    errors.push(errorAt(path, "Value must be a boolean."));
    return fallback;
  }

  return value;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[],
  errors: LevelConfigErrorDetail[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      errors.push(errorAt(path === "$" ? key : `${path}.${key}`, "Unknown field is not supported."));
    }
  }
}

function deepFreezeLevelConfig(config: LevelConfig): LevelConfig {
  return Object.freeze({
    ...config,
    sandMap: Object.freeze([...config.sandMap]),
    bucketQueue: Object.freeze(config.bucketQueue.map((bucket) => Object.freeze({ ...bucket }))),
    rules: Object.freeze({ ...config.rules }),
  });
}

function fallbackBucketConfig(index: number): LevelBucketConfig {
  return Object.freeze({
    configId: `invalid-${index}`,
    colorId: 1,
    capacity: 1,
    initialAmount: 0,
    specialType: "normal",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorAt(path: string, message: string): LevelConfigErrorDetail {
  return Object.freeze({ path, message });
}

function formatLevelConfigError(details: readonly LevelConfigErrorDetail[]): string {
  return `Invalid level config: ${details.map((detail) => `${detail.path}: ${detail.message}`).join("; ")}`;
}
