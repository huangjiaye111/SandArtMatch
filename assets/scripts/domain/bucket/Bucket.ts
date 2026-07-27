import type { SandColorId } from "../config/LevelConfig";

export type BucketStatus = "available" | "inConveyor" | "completed";

export interface BucketConfig {
  readonly colorId: SandColorId;
  readonly capacity: number;
}

export interface BucketState {
  readonly instanceId: string;
  readonly colorId: SandColorId;
  readonly capacity: number;
  readonly amount: number;
  readonly status: BucketStatus;
}

export interface BucketRuntimeInit {
  readonly currentAmount?: number;
}

export interface BucketFillResult {
  readonly requestedAmount: number;
  readonly acceptedAmount: number;
  readonly rejectedAmount: number;
  readonly bucket: BucketState;
}

export class Bucket {
  public readonly instanceId: string;
  public readonly colorId: SandColorId;
  public readonly capacity: number;

  private amount: number;
  private statusValue: BucketStatus;

  public constructor(instanceId: string, config: BucketConfig, runtime: BucketRuntimeInit = {}) {
    validateInstanceId(instanceId);
    validateBucketConfig(config);
    validateBucketRuntimeInit(runtime, config.capacity);

    this.instanceId = instanceId;
    this.colorId = config.colorId;
    this.capacity = config.capacity;
    this.amount = runtime.currentAmount ?? 0;
    this.statusValue = "available";
  }

  public static fromConfig(instanceId: string, config: BucketConfig, runtime: BucketRuntimeInit = {}): Bucket {
    return new Bucket(instanceId, config, runtime);
  }

  public static fromSnapshot(snapshot: BucketState): Bucket {
    validateBucketState(snapshot);

    const bucket = new Bucket(
      snapshot.instanceId,
      {
        colorId: snapshot.colorId,
        capacity: snapshot.capacity,
      },
      {
        currentAmount: snapshot.amount,
      },
    );
    bucket.statusValue = snapshot.status;
    return bucket;
  }

  public get currentAmount(): number {
    return this.amount;
  }

  public get remainingCapacity(): number {
    return this.capacity - this.amount;
  }

  public get status(): BucketStatus {
    return this.statusValue;
  }

  public isEmpty(): boolean {
    return this.amount === 0;
  }

  public isFull(): boolean {
    return this.remainingCapacity === 0;
  }

  public fill(amountToAdd: number): BucketFillResult {
    validateFillAmount(amountToAdd);
    if (this.statusValue === "completed") {
      throw new Error("Completed buckets cannot be filled.");
    }

    const acceptedAmount = Math.min(amountToAdd, this.remainingCapacity);
    this.amount += acceptedAmount;

    return Object.freeze({
      requestedAmount: amountToAdd,
      acceptedAmount,
      rejectedAmount: amountToAdd - acceptedAmount,
      bucket: this.snapshot(),
    });
  }

  public moveToConveyor(): void {
    this.transitionTo("inConveyor");
  }

  public completeAndLeave(): void {
    this.transitionTo("completed");
  }

  public transitionTo(nextStatus: BucketStatus): void {
    validateStatus(nextStatus);

    if (!canTransition(this.statusValue, nextStatus)) {
      throw new Error(`Invalid bucket status transition: ${this.statusValue} -> ${nextStatus}.`);
    }

    if (nextStatus === "completed" && !this.isFull()) {
      throw new Error("Only full buckets can transition to completed.");
    }

    this.statusValue = nextStatus;
  }

  public snapshot(): BucketState {
    return Object.freeze({
      instanceId: this.instanceId,
      colorId: this.colorId,
      capacity: this.capacity,
      amount: this.amount,
      status: this.statusValue,
    });
  }

  public clone(): Bucket {
    return Bucket.fromSnapshot(this.snapshot());
  }
}

export function createBucket(instanceId: string, config: BucketConfig, runtime: BucketRuntimeInit = {}): Bucket {
  return Bucket.fromConfig(instanceId, config, runtime);
}

function validateBucketConfig(config: BucketConfig): void {
  if (typeof config !== "object" || config === null) {
    throw new TypeError("Bucket config is required.");
  }

  validateColorId(config.colorId);
  validateCapacity(config.capacity);
}

function validateBucketRuntimeInit(runtime: BucketRuntimeInit, capacity: number): void {
  if (typeof runtime !== "object" || runtime === null) {
    throw new TypeError("Bucket runtime init must be an object.");
  }

  validateAmount(runtime.currentAmount ?? 0, capacity);
}

function validateBucketState(state: BucketState): void {
  if (typeof state !== "object" || state === null) {
    throw new TypeError("Bucket state is required.");
  }

  validateInstanceId(state.instanceId);
  validateColorId(state.colorId);
  validateCapacity(state.capacity);
  validateAmount(state.amount, state.capacity);
  validateStatus(state.status);
  if (state.status === "completed" && state.amount !== state.capacity) {
    throw new RangeError("Completed bucket state must be full.");
  }
}

function validateInstanceId(instanceId: string): void {
  if (typeof instanceId !== "string" || instanceId.length === 0) {
    throw new TypeError("Bucket instanceId must be a non-empty string.");
  }
}

function validateColorId(colorId: SandColorId): void {
  if (!Number.isSafeInteger(colorId) || colorId <= 0) {
    throw new RangeError("Bucket color id must be a positive safe integer.");
  }
}

function validateCapacity(capacity: number): void {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError("Bucket capacity must be a positive safe integer.");
  }
}

function validateAmount(amount: number, capacity: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("Bucket amount must be a non-negative safe integer.");
  }

  if (amount > capacity) {
    throw new RangeError("Bucket amount must not exceed capacity.");
  }
}

function validateFillAmount(amountToAdd: number): void {
  if (!Number.isSafeInteger(amountToAdd)) {
    throw new RangeError("Bucket fill amount must be a safe integer.");
  }

  if (amountToAdd < 0) {
    throw new RangeError("Bucket fill amount must not be negative.");
  }
}

function validateStatus(status: BucketStatus): void {
  if (status !== "available" && status !== "inConveyor" && status !== "completed") {
    throw new Error(`Unsupported bucket status: ${String(status)}.`);
  }
}

function canTransition(current: BucketStatus, next: BucketStatus): boolean {
  if (current === next) {
    return true;
  }

  if (current === "available") {
    return next === "inConveyor";
  }

  if (current === "inConveyor") {
    return next === "completed";
  }

  return false;
}
