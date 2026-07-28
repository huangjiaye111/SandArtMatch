import { Bucket } from "./Bucket";

export const DEFAULT_CONVEYOR_MAX_SLOTS = 6;

export interface ConveyorState {
  readonly maxSlots: number;
  readonly slots: readonly (string | null)[];
}

export interface ConveyorSlotState {
  readonly index: number;
  readonly bucketInstanceId: string | null;
}

export interface ConveyorAddResult {
  readonly bucket: Bucket;
  readonly slotIndex: number;
  readonly state: ConveyorState;
}

export interface ConveyorRemoveResult {
  readonly bucket: Bucket;
  readonly slotIndex: number;
  readonly state: ConveyorState;
}

export interface ConveyorReplaceResult {
  readonly removedBuckets: readonly Bucket[];
  readonly insertedBucket: Bucket;
  readonly slotIndex: number;
  readonly state: ConveyorState;
}

export class ConveyorSystem {
  private readonly maxSlotCount: number;
  private readonly buckets: Bucket[];

  public constructor(maxSlots: number = DEFAULT_CONVEYOR_MAX_SLOTS) {
    validateMaxSlots(maxSlots);

    this.maxSlotCount = maxSlots;
    this.buckets = [];
  }

  public get maxSlots(): number {
    return this.maxSlotCount;
  }

  public get count(): number {
    return this.buckets.length;
  }

  public get remainingSlots(): number {
    return this.maxSlotCount - this.buckets.length;
  }

  public isEmpty(): boolean {
    return this.buckets.length === 0;
  }

  public isFull(): boolean {
    return this.buckets.length === this.maxSlotCount;
  }

  public findFirstEmptySlotIndex(): number | null {
    return this.isFull() ? null : this.buckets.length;
  }

  public addBucket(bucket: Bucket): ConveyorAddResult {
    validateBucket(bucket);

    if (this.isFull()) {
      throw new Error("Cannot add bucket to a full conveyor.");
    }

    if (this.hasBucket(bucket.instanceId)) {
      throw new Error(`Bucket is already in the conveyor: ${bucket.instanceId}.`);
    }

    if (bucket.status !== "available") {
      throw new Error(`Only available buckets can enter the conveyor: ${bucket.instanceId}.`);
    }

    const slotIndex = this.buckets.length;
    bucket.moveToConveyor();
    this.buckets.push(bucket);

    return Object.freeze({
      bucket,
      slotIndex,
      state: this.snapshot(),
    });
  }

  public getBucketAt(slotIndex: number): Bucket {
    validateSlotIndex(slotIndex, this.maxSlotCount);

    const bucket = this.buckets[slotIndex];
    if (bucket === undefined) {
      throw new Error(`Conveyor slot is empty: ${slotIndex}.`);
    }

    return bucket;
  }

  public getSlotState(slotIndex: number): ConveyorSlotState {
    validateSlotIndex(slotIndex, this.maxSlotCount);

    return Object.freeze({
      index: slotIndex,
      bucketInstanceId: this.buckets[slotIndex]?.instanceId ?? null,
    });
  }

  public getSlots(): readonly ConveyorSlotState[] {
    return Object.freeze(
      Array.from({ length: this.maxSlotCount }, (_, index) => this.getSlotState(index)),
    );
  }

  public findBucketIndex(instanceId: string): number | null {
    validateInstanceId(instanceId);

    const index = this.buckets.findIndex((bucket) => bucket.instanceId === instanceId);
    return index === -1 ? null : index;
  }

  public findBucket(instanceId: string): Bucket | null {
    const index = this.findBucketIndex(instanceId);
    return index === null ? null : this.buckets[index];
  }

  public hasBucket(instanceId: string): boolean {
    return this.findBucketIndex(instanceId) !== null;
  }

  public removeBucketAt(slotIndex: number): ConveyorRemoveResult {
    validateSlotIndex(slotIndex, this.maxSlotCount);

    const bucket = this.buckets[slotIndex];
    if (bucket === undefined) {
      throw new Error(`Conveyor slot is empty: ${slotIndex}.`);
    }

    this.buckets.splice(slotIndex, 1);

    return Object.freeze({
      bucket,
      slotIndex,
      state: this.snapshot(),
    });
  }

  public removeBucketByInstanceId(instanceId: string): ConveyorRemoveResult {
    const slotIndex = this.findBucketIndex(instanceId);
    if (slotIndex === null) {
      throw new Error(`Bucket is not in the conveyor: ${instanceId}.`);
    }

    return this.removeBucketAt(slotIndex);
  }

  public replaceBucketsWith(instanceIds: readonly string[], replacementBucket: Bucket): ConveyorReplaceResult {
    validateReplacementInstanceIds(instanceIds);
    validateBucket(replacementBucket);

    if (replacementBucket.status !== "available") {
      throw new Error(`Only available replacement buckets can enter the conveyor: ${replacementBucket.instanceId}.`);
    }

    if (this.hasBucket(replacementBucket.instanceId)) {
      throw new Error(`Replacement bucket is already in the conveyor: ${replacementBucket.instanceId}.`);
    }

    const selectedIndexes: number[] = [];
    for (const instanceId of instanceIds) {
      const index = this.findBucketIndex(instanceId);
      if (index === null) {
        throw new Error(`Bucket is not in the conveyor: ${instanceId}.`);
      }
      selectedIndexes.push(index);
    }
    const insertionIndex = Math.min(...selectedIndexes);
    const selectedBuckets = selectedIndexes
      .slice()
      .sort((left, right) => left - right)
      .map((index) => this.buckets[index]);
    const nextBuckets = this.buckets.filter((_, index) => selectedIndexes.indexOf(index) === -1);

    replacementBucket.moveToConveyor();
    nextBuckets.splice(insertionIndex, 0, replacementBucket);
    this.buckets.splice(0, this.buckets.length, ...nextBuckets);

    return Object.freeze({
      removedBuckets: Object.freeze([...selectedBuckets]),
      insertedBucket: replacementBucket,
      slotIndex: insertionIndex,
      state: this.snapshot(),
    });
  }

  public bucketsSnapshot(): readonly Bucket[] {
    return Object.freeze([...this.buckets]);
  }

  public snapshot(): ConveyorState {
    const occupiedSlots = this.buckets.map((bucket) => bucket.instanceId);
    const emptySlots = Array.from<string | null>({ length: this.remainingSlots }).fill(null);

    return Object.freeze({
      maxSlots: this.maxSlotCount,
      slots: Object.freeze([...occupiedSlots, ...emptySlots]),
    });
  }
}

export function createConveyor(maxSlots: number = DEFAULT_CONVEYOR_MAX_SLOTS): ConveyorSystem {
  return new ConveyorSystem(maxSlots);
}

function validateMaxSlots(maxSlots: number): void {
  if (!Number.isSafeInteger(maxSlots) || maxSlots <= 0) {
    throw new RangeError("Conveyor max slots must be a positive safe integer.");
  }
}

function validateBucket(bucket: Bucket): void {
  if (!(bucket instanceof Bucket)) {
    throw new TypeError("Conveyor bucket must be a Bucket instance.");
  }
}

function validateInstanceId(instanceId: string): void {
  if (typeof instanceId !== "string" || instanceId.length === 0) {
    throw new TypeError("Bucket instanceId must be a non-empty string.");
  }
}

function validateReplacementInstanceIds(instanceIds: readonly string[]): void {
  if (!Array.isArray(instanceIds)) {
    throw new TypeError("Replacement instance ids must be an array.");
  }

  if (instanceIds.length === 0) {
    throw new RangeError("Replacement requires at least one bucket instance id.");
  }

  const seen: string[] = [];
  for (const instanceId of instanceIds) {
    validateInstanceId(instanceId);
    if (seen.includes(instanceId)) {
      throw new Error(`Duplicate replacement bucket instanceId: ${instanceId}.`);
    }
    seen.push(instanceId);
  }
}

function validateSlotIndex(slotIndex: number, maxSlots: number): void {
  if (!Number.isSafeInteger(slotIndex)) {
    throw new RangeError("Conveyor slot index must be a safe integer.");
  }

  if (slotIndex < 0 || slotIndex >= maxSlots) {
    throw new RangeError(`Conveyor slot index is out of bounds: ${slotIndex}.`);
  }
}
