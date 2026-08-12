import { _decorator, Color, Component, error, Graphics, Label, Node, tween, Tween, UIOpacity, UITransform, Vec3 } from "cc";
import { BattlePhase } from "../../domain/battle/BattleState";
import {
  getBuiltInLevelConfigByCatalogLevelId,
  getDisplayLevelText,
  getLevelCatalogEntry,
  getLevelCatalogEntryByConfigLevelId,
} from "../../domain/config/LevelCatalog";
import { createBattleSimulationFromLevel } from "../../domain/config/LevelLoader";
import { DEFAULT_BATTLE_SIMULATION_CONFIG } from "../../domain/battle/BattleSimulationConfig";
import type { BattleSimulation, BattleSimulationFrame } from "../../domain/battle/BattleSimulation";
import type { BattleViewSnapshot } from "../../domain/battle/BattleState";
import type { BucketState } from "../../domain/bucket/Bucket";
import type { BattleView } from "./BattleViewContract";
import { BucketPoolView } from "./BucketPoolView";
import { ConveyorView } from "./ConveyorView";
import { createPresentationQueue } from "./PresentationQueueModel";
import { SandGridView } from "./SandGridView";
import { SimulationFrameQueue, type RenderPresentationFrame } from "./SimulationFrameQueue";
import { ToolbarView } from "./ToolbarView";
import type { BattlePresentationEvent } from "./BattleViewContract";
import type { AbsorptionPresentationEvent } from "./BattleViewContract";
import { createAbsorptionMotionPlan } from "./AbsorptionMotionModel";
import { createBucketExitPresentationTasks, createBucketMergePresentationTasks } from "./BucketPresentationTaskModel";
import { createGravityTimelinePlan, groupGravityMovesByIteration, type GravityIterationStep } from "./GravityMotionModel";
import { getSandCanvasPaletteEntry } from "./SandCanvasModel";
import { BATTLE_PRESENTATION_CONFIG } from "./BattlePresentationConfig";
import { getRuntimeGameNavigator, getRuntimeGameSession } from "../navigation/RuntimeGameServices";
import { createThemeRuntime } from "../../theme/ThemeRuntime";
import type { ThemeConfig } from "../../theme/ThemeTypes";
import type { LevelCatalogEntry } from "../../domain/config/LevelCatalog";

const { ccclass, property } = _decorator;

type GravityPresentationEvent = Extract<BattlePresentationEvent, { readonly type: "sandGravitySettled" }>;
type SandCanvasMotionTask = {
  readonly type: "settlement";
  readonly absorptionEvents: readonly AbsorptionPresentationEvent[];
  readonly gravityEvent: GravityPresentationEvent | null;
  readonly finalGrid: BattleViewSnapshot["grid"] | null;
};

let battleTutorialShown = false;

const WORKSHOP_BG_SIZE = Object.freeze({ width: 750, height: 1334 });

@ccclass("BattleRoot")
export class BattleRoot extends Component implements BattleView {
  @property(SandGridView)
  public sandGridView: SandGridView | null = null;

  @property(ConveyorView)
  public conveyorView: ConveyorView | null = null;

  @property(BucketPoolView)
  public bucketPoolView: BucketPoolView | null = null;

  @property(ToolbarView)
  public toolbarView: ToolbarView | null = null;

  @property
  public levelId = 1;

  @property
  public levelText = "Level 1";

  private simulation: BattleSimulation | null = null;
  private presentationToken = 0;
  private latestBuckets: readonly BucketState[] = [];
  private absorptionRevision = 0;
  private absorptionQueue: SandCanvasMotionTask[] = [];
  private absorptionPlaying = false;
  private particlePool: Node[] = [];
  private particleProgressTargets = new Map<Node, { value: number }>();
  private activeParticleCount = 0;
  private simulationAccumulator = 0;
  private visiblePresentationAccumulator = 0;
  private readonly simulationFrameQueue = new SimulationFrameQueue({
    maxQueueSize: DEFAULT_BATTLE_SIMULATION_CONFIG.maxPresentationFrameQueueSize,
    maxVisibleTicksMerged: DEFAULT_BATTLE_SIMULATION_CONFIG.maxVisibleTicksMerged,
  });
  private debugStatsWindowSeconds = 0;
  private debugStatsTicks = 0;
  private debugStatsVisibleFrames = 0;
  private debugStatsMergedTicks = 0;
  private currentCatalogLevelId: string | null = null;
  private victorySaved = false;
  private navigationStarted = false;
  private runtimeDisposed = false;
  private tutorialHint: Node | null = null;
  private tutorialStage = 0;

  @property
  public debugBucketEntryFlowEnabled = false;

  @property
  public presentationDebugLogging = BATTLE_PRESENTATION_CONFIG.presentationDebugLogging;

  public onLoad(): void {
    this.hideResult();
    this.applyRuntimeLayout();
    this.ensureTutorialHint();
    const entry = this.resolveCatalogEntry();
    this.currentCatalogLevelId = entry.levelId;
    const session = getRuntimeGameSession();
    session.selectedLevelId = entry.levelId;
    session.currentLevelId = entry.levelId;
    session.currentThemeId = entry.themeId;
    this.applyRuntimeTheme(entry);
    this.levelText = getDisplayLevelText(entry);
    this.simulation = createBattleSimulationFromLevel(getBuiltInLevelConfigByCatalogLevelId(entry.levelId));
    this.bindChildActions();
    this.initialize(this.simulation.getSnapshot());
    this.setLevelText(this.levelText);
    if (!battleTutorialShown) {
      battleTutorialShown = true;
      this.showTutorialHint("先选一个颜色桶，让它接住同色沙粒", 4.5);
    }
  }

  protected onDestroy(): void {
    this.navigationStarted = true;
    this.disposeBattleRuntime();
  }

  protected onDisable(): void { this.cancelFeedback(); }

  public initialize(snapshot: BattleViewSnapshot): void {
    this.clear();
    this.renderSandGrid(snapshot.grid);
    this.renderConveyor(snapshot.conveyor, snapshot.buckets);
    this.renderBucketPool(snapshot.buckets);
    this.setInputEnabled(snapshot.phase === BattlePhase.WaitingInput);
  }

  public setLevelText(text: string): void { this.toolbarView?.setLevelText(text); }

  public setInputEnabled(enabled: boolean): void {
    this.bucketPoolView?.setInputEnabled(enabled);
  }

  public renderSandGrid(grid: BattleViewSnapshot["grid"]): void {
    this.sandGridView?.renderSandGrid(grid);
  }

  public renderConveyor(conveyor: BattleViewSnapshot["conveyor"], buckets: BattleViewSnapshot["buckets"]): void {
    this.latestBuckets = buckets;
    this.conveyorView?.renderConveyor(conveyor, buckets);
  }

  public renderBucketPool(buckets: BattleViewSnapshot["buckets"]): void {
    this.latestBuckets = buckets;
    this.bucketPoolView?.renderBucketPool(buckets);
  }

  public async playFeedback(events: readonly BattlePresentationEvent[]): Promise<void> {
    const token = this.presentationToken;
    const bucketFlightStarts = this.captureBucketFlightStarts(events);
    const hasAbsorption = events.some((event) => event.type === "sandAbsorbed");
    const hasGravity = events.some((event) => event.type === "sandGravitySettled");
    const hasSandCanvasMotion = hasAbsorption || hasGravity;
    this.playBucketFlights(events, bucketFlightStarts);
    this.enqueueAbsorptionEvents(events);
    this.updateTutorialHint(events);
    let elapsedSeconds = 0;
    for (const step of createPresentationQueue(events)) {
      this.scheduleOnce(() => {
        if (token !== this.presentationToken) {
          return;
        }
        const sandEvents = step.events.filter((event) =>
          event.type !== "sandAbsorbed" &&
          event.type !== "sandGravitySettled" &&
          (!hasSandCanvasMotion || event.type !== "sandCanvasRedrawn")
        );
        this.sandGridView?.playFeedback(sandEvents);
        this.conveyorView?.playFeedback(step.events);
        this.bucketPoolView?.playFeedback(step.events);
        this.toolbarView?.playFeedback(step.events);
      }, elapsedSeconds);
      elapsedSeconds += step.durationMs / 1000;
    }
  }

  public cancelFeedback(): void {
    this.presentationToken += 1;
    this.cancelAbsorptionFeedback();
    this.simulationFrameQueue.clear();
    this.simulationAccumulator = 0;
    this.visiblePresentationAccumulator = 0;
    this.unscheduleAllCallbacks();
    this.sandGridView?.cancelFeedback();
    this.conveyorView?.cancelFeedback();
    this.bucketPoolView?.cancelFeedback();
  }

  public showFeedback(message: string): void {
    this.toolbarView?.showFeedback(message);
  }

  public showWin(canStartNext = false): void {
    this.toolbarView?.showWin(canStartNext);
  }

  public showLose(reason?: string): void {
    this.toolbarView?.showLose(reason);
  }

  public hideResult(): void {
    this.toolbarView?.hideResult();
  }

  public clear(): void {
    this.cancelFeedback();
    this.sandGridView?.clear();
    this.conveyorView?.clear();
    this.bucketPoolView?.clear();
    this.toolbarView?.clear();
  }

  public onBucketTapped(bucketInstanceId: string): void {
    this.debugBucketEntryFlow(`BucketPool click -> bucketId=${bucketInstanceId}`);
    const simulation = this.simulation;
    if (simulation === null) {
      return;
    }
    const result = simulation.enqueueBucketSelection(bucketInstanceId);
    if (!result.accepted || result.slotIndex === null) {
      this.showFeedback(result.reason ?? "Input locked");
      this.bucketPoolView?.playFeedback([{ type: "invalidClick", message: result.reason ?? "Input locked" }]);
      return;
    }
    const event: BattlePresentationEvent = {
      type: "bucketEnteredConveyor",
      bucketInstanceId,
      slotIndex: result.slotIndex,
    };
    this.playBucketFlights([event], this.captureBucketFlightStarts([event]));
  }

  public onRestartTapped(): void {
    if (this.navigationStarted) {
      return;
    }
    const simulation = this.simulation;
    if (simulation === null) {
      return;
    }
    this.cancelFeedback();
    simulation.reset();
    this.hideResult();
    this.initialize(simulation.getSnapshot());
  }

  public onNextTapped(): void {
    if (this.navigationStarted) {
      return;
    }
    this.navigationStarted = true;
    this.disposeBattleRuntime();
    void this.navigateFromBattle("Next", () => getRuntimeGameNavigator().startNextLevel());
  }

  public onHomeTapped(): void {
    if (this.navigationStarted) {
      return;
    }
    this.navigationStarted = true;
    this.disposeBattleRuntime();
    void this.navigateFromBattle("Home", () => getRuntimeGameNavigator().goHome());
  }

  private async navigateFromBattle(action: string, navigate: () => Promise<unknown>): Promise<void> {
    try {
      const result = await navigate();
      if (typeof result === "object" && result !== null && "accepted" in result && result.accepted !== true) {
        error(`[BattleRoot] ${action} navigation rejected`, result);
      }
    } catch (reason: unknown) {
      error(`[BattleRoot] ${action} navigation failed`, reason);
    }
  }

  protected update(deltaTime: number): void {
    const simulation = this.simulation;
    if (simulation === null) {
      return;
    }
    const fixedDelta = 1 / DEFAULT_BATTLE_SIMULATION_CONFIG.simulationTickRate;
    const visibleDelta = (1 / BATTLE_PRESENTATION_CONFIG.presentationTextureUploadRate) *
      BATTLE_PRESENTATION_CONFIG.presentationDebugTimeScale;
    this.simulationAccumulator += deltaTime;
    this.visiblePresentationAccumulator += deltaTime;
    let ticks = 0;
    const phase = simulation.getSnapshot().phase;
    let simulationEnded = phase === BattlePhase.Won || phase === BattlePhase.Failed;
    while (
      !simulationEnded &&
      this.simulationAccumulator >= fixedDelta &&
      ticks < DEFAULT_BATTLE_SIMULATION_CONFIG.maxSimulationTicksPerRenderFrame
    ) {
      const frame = simulation.tick();
      this.simulationFrameQueue.enqueue(frame);
      simulationEnded = frame.won || frame.failed;
      this.simulationAccumulator -= fixedDelta;
      ticks += 1;
    }
    if (ticks >= DEFAULT_BATTLE_SIMULATION_CONFIG.maxSimulationTicksPerRenderFrame) {
      this.simulationAccumulator = Math.min(this.simulationAccumulator, fixedDelta);
    }
    this.debugStatsTicks += ticks;
    if (this.visiblePresentationAccumulator >= visibleDelta) {
      const frame = this.simulationFrameQueue.dequeueVisibleFrame();
      if (frame !== null) {
        this.applyRenderPresentationFrame(frame);
        this.debugStatsVisibleFrames += 1;
        this.debugStatsMergedTicks += frame.simulationFrameCount;
      }
      this.visiblePresentationAccumulator = Math.min(this.visiblePresentationAccumulator - visibleDelta, visibleDelta);
    }
    this.recordSimulationDebugStats(deltaTime, ticks);
  }

  private bindChildActions(): void {
    const actions = {
      selectBucket: (bucketInstanceId: string) => this.onBucketTapped(bucketInstanceId),
      restart: () => this.onRestartTapped(),
      next: () => this.onNextTapped(),
      home: () => this.onHomeTapped(),
    };
    this.bucketPoolView?.setActions(actions);
    this.toolbarView?.setActions(actions);
  }

  private applyRenderPresentationFrame(frame: RenderPresentationFrame): void {
    const frameSnapshot = frame.battleState;
    const sourcePositions = this.captureAbsorbedSourcePositions(frame.absorbedCellIndices);
    const mergeTasks = createBucketMergePresentationTasks({
      revision: frame.revisionEnd,
      tick: frame.tickEnd,
      mergeResults: frame.mergeResults,
    });
    const exitTasks = createBucketExitPresentationTasks({
      revision: frame.revisionEnd,
      tick: frame.tickEnd,
      completedBucketIds: frame.completedBucketIds,
      completedSlotIndexes: frame.completedSlotIndexes,
      exitResults: frame.exitResults,
    });

    this.conveyorView?.playBucketTransitionTasks(mergeTasks, exitTasks);
    this.sandGridView?.applySimulationCellChanges(frame.absorbedCellIndices, frame.gravityIterations, frame.tickEnd);
    this.renderConveyor(frameSnapshot.conveyor, frameSnapshot.buckets);
    this.renderBucketPool(frameSnapshot.buckets);
    this.conveyorView?.playMergeResultBounces(mergeTasks);
    this.playSimulationBucketFeedback(frame);
    this.spawnFrameAbsorbParticles(frame, sourcePositions);

    if (frame.won) {
      this.cancelFeedback();
      const victory = this.saveVictoryOnce();
      this.showWin(victory.canStartNext);
      this.setInputEnabled(false);
    } else if (frame.failed) {
      this.cancelFeedback();
      this.showLose("没有可吸收或可合并的操作");
      this.setInputEnabled(false);
    } else {
      this.hideResult();
      this.setInputEnabled(true);
    }
  }

  private captureAbsorbedSourcePositions(indices: readonly number[]): ReadonlyMap<number, Vec3> {
    const positions = new Map<number, Vec3>();
    for (const index of indices) {
      const position = this.sandGridView?.getCellWorldPositionByIndex(index) ?? null;
      if (position !== null) {
        positions.set(index, position);
      }
    }
    return positions;
  }

  private resolveCatalogEntry() {
    const sessionLevelId = getRuntimeGameSession().currentLevelId;
    if (sessionLevelId !== null) {
      return getLevelCatalogEntry(sessionLevelId);
    }
    return getLevelCatalogEntryByConfigLevelId(this.levelId);
  }

  private saveVictoryOnce(): { readonly canStartNext: boolean } {
    if (this.victorySaved) {
      const entry = this.currentCatalogLevelId === null ? null : getLevelCatalogEntry(this.currentCatalogLevelId);
      return { canStartNext: entry?.nextLevelId !== null && entry?.nextLevelId !== undefined };
    }
    this.victorySaved = true;
    return getRuntimeGameNavigator().completeCurrentLevelVictory();
  }

  private disposeBattleRuntime(): void {
    if (this.runtimeDisposed) {
      return;
    }
    this.runtimeDisposed = true;
    this.presentationToken += 1;
    this.cancelAbsorptionFeedback();
    this.cancelFeedback();
    this.simulation?.dispose();
    this.simulation = null;
    this.bucketPoolView?.clearActions();
    this.toolbarView?.clearActions();
    this.simulationFrameQueue.clear();
  }

  private playSimulationBucketFeedback(frame: Pick<BattleSimulationFrame, "bucketAmountDeltas">): void {
    for (const delta of frame.bucketAmountDeltas) {
      this.conveyorView?.setBucketPresentationAmount(delta.bucketInstanceId, delta.amountAfter);
      this.conveyorView?.playAbsorbPulse(delta.bucketInstanceId);
    }
  }

  private spawnFrameAbsorbParticles(
    frame: Pick<BattleSimulationFrame, "bucketAmountDeltas">,
    sourcePositions: ReadonlyMap<number, Vec3>,
  ): void {
    const revision = this.absorptionRevision;
    for (const delta of frame.bucketAmountDeltas) {
      if (this.conveyorView?.getBucketMouthWorldPosition(delta.bucketInstanceId) === null) {
        continue;
      }
      for (const index of delta.absorbedCellIndices) {
        if (this.activeParticleCount >= BATTLE_PRESENTATION_CONFIG.absorptionParticlePoolCapacity) {
          return;
        }
        const source = sourcePositions.get(index) ?? null;
        if (source !== null) {
          this.spawnAbsorbParticle(source, delta.bucketInstanceId, delta.colorId, revision);
        }
      }
    }
  }

  private applyRuntimeLayout(): void {
    const designContent = this.node.getChildByName("DesignContent");
    const sandArea = designContent?.getChildByName("SandArea") ?? null;
    const conveyorArea = designContent?.getChildByName("ConveyorArea") ?? null;
    const bucketPoolArea = designContent?.getChildByName("BucketPoolArea") ?? null;

    designContent?.setSiblingIndex(5);
    sandArea?.setPosition(0, 236, 0);
    conveyorArea?.setPosition(0, -118, 0);
    bucketPoolArea?.setPosition(0, -410, 0);

    sandArea?.getComponent(UITransform)?.setContentSize(680, 620);
    conveyorArea?.getComponent(UITransform)?.setContentSize(676, 132);
    bucketPoolArea?.getComponent(UITransform)?.setContentSize(704, 322);
  }

  private applyRuntimeTheme(entry: LevelCatalogEntry): void {
    const snapshot = createThemeRuntime(getRuntimeGameSession()).getCurrentSnapshot();
    this.ensureBattleWorkshopBackdrop(snapshot.theme);
    console.log(`[BattleRoot] level=${entry.levelId} theme=${snapshot.theme.id} (${snapshot.theme.displayName})`);
  }

  private ensureBattleWorkshopBackdrop(theme: ThemeConfig): void {
    let backdrop = this.node.getChildByName("WorkshopRuntimeBackdrop");
    if (backdrop === null) {
      backdrop = new Node("WorkshopRuntimeBackdrop");
      this.node.addChild(backdrop);
      backdrop.addComponent(UITransform);
      backdrop.addComponent(Graphics);
    }
    backdrop.active = true;
    backdrop.setPosition(0, 0, 0);
    backdrop.setSiblingIndex(0);
    backdrop.getComponent(UITransform)?.setContentSize(WORKSHOP_BG_SIZE.width, WORKSHOP_BG_SIZE.height);
    drawWorkshopRuntimeBackdrop(backdrop.getComponent(Graphics), theme);
  }

  private ensureTutorialHint(): void {
    if (this.tutorialHint !== null && this.tutorialHint.isValid) {
      return;
    }
    const hint = new Node("BattleTutorialHint");
    hint.addComponent(UITransform).setContentSize(560, 64);
    hint.addComponent(UIOpacity);
    const background = new Node("Background");
    background.addComponent(UITransform).setContentSize(560, 64);
    background.addComponent(Graphics);
    hint.addChild(background);
    const labelNode = new Node("Label");
    labelNode.addComponent(UITransform).setContentSize(520, 48);
    const label = labelNode.addComponent(Label);
    label.fontSize = 22;
    label.lineHeight = 28;
    label.color = new Color(38, 48, 45, 255);
    label.enableOutline = true;
    label.outlineColor = new Color(255, 255, 255, 220);
    label.outlineWidth = 2;
    hint.addChild(labelNode);
    this.node.addChild(hint);
    hint.setPosition(0, 80, 0);
    hint.setSiblingIndex(80);
    drawTutorialBackground(background.getComponent(Graphics));
    this.tutorialHint = hint;
  }

  private showTutorialHint(message: string, durationSeconds: number): void {
    this.ensureTutorialHint();
    const hint = this.tutorialHint;
    if (hint === null) {
      return;
    }
    const label = hint.getChildByName("Label")?.getComponent(Label) ?? null;
    const opacity = hint.getComponent(UIOpacity) ?? hint.addComponent(UIOpacity);
    if (label !== null) {
      label.string = message;
    }
    Tween.stopAllByTarget(opacity);
    opacity.opacity = 255;
    hint.active = true;
    this.unschedule(this.hideTutorialHint);
    this.scheduleOnce(this.hideTutorialHint, durationSeconds);
  }

  private hideTutorialHint = (): void => {
    const hint = this.tutorialHint;
    if (hint === null || !hint.isValid) {
      return;
    }
    const opacity = hint.getComponent(UIOpacity) ?? hint.addComponent(UIOpacity);
    Tween.stopAllByTarget(opacity);
    tween(opacity)
      .to(0.18, { opacity: 0 })
      .call(() => {
        if (hint.isValid) {
          hint.active = false;
        }
      })
      .start();
  };

  private updateTutorialHint(events: readonly BattlePresentationEvent[]): void {
    if (this.tutorialStage < 2 && events.some((event) => event.type === "merge")) {
      this.tutorialStage = 2;
      this.showTutorialHint("三桶同色会合并，先留意传送带上的颜色", 2.4);
      return;
    }
    if (this.tutorialStage < 1 && events.some((event) => event.type === "sandAbsorbed")) {
      this.tutorialStage = 1;
      this.showTutorialHint("同色沙粒会自动流入传送带上的桶", 1.8);
    }
  }

  private captureBucketFlightStarts(
    events: readonly BattlePresentationEvent[],
  ): ReadonlyMap<string, Vec3> {
    const starts = new Map<string, Vec3>();
    for (const event of events) {
      if (event.type !== "bucketEnteredConveyor") {
        continue;
      }
      const worldPosition = this.bucketPoolView?.getBucketWorldPosition(event.bucketInstanceId) ?? null;
      if (worldPosition !== null) {
        starts.set(event.bucketInstanceId, worldPosition.clone());
      }
    }
    return starts;
  }

  private playBucketFlights(
    events: readonly BattlePresentationEvent[],
    starts: ReadonlyMap<string, Vec3>,
  ): void {
    for (const event of events) {
      if (event.type !== "bucketEnteredConveyor") {
        continue;
      }
      const bucket = this.latestBuckets.find((candidate) => candidate.instanceId === event.bucketInstanceId);
      const startWorldPosition = starts.get(event.bucketInstanceId) ?? null;
      if (bucket !== undefined && startWorldPosition !== null) {
        this.debugBucketEntryFlow(
          `bucketEnteredConveyor event -> bucketId=${event.bucketInstanceId} targetSlotIndex=${event.slotIndex}`,
        );
        const started = this.conveyorView?.playBucketEntry(bucket, event.slotIndex, startWorldPosition, () => {
          this.bucketPoolView?.completeBucketFlight(event.bucketInstanceId);
          this.debugBucketEntryFlow(`Tween complete -> bucketId=${event.bucketInstanceId}`);
        }) ?? false;
        if (started) {
          this.bucketPoolView?.markBucketInFlight(event.bucketInstanceId);
        }
        this.debugBucketEntryFlow(
          started
            ? `MotionVisual created -> Tween start bucketId=${event.bucketInstanceId}`
            : `MotionVisual skipped -> bucketId=${event.bucketInstanceId}`,
        );
      }
    }
  }

  private enqueueAbsorptionEvents(events: readonly BattlePresentationEvent[]): void {
    const finalGrid = [...events].reverse().find((event): event is Extract<BattlePresentationEvent, { type: "sandCanvasRedrawn" }> => event.type === "sandCanvasRedrawn")?.grid ?? null;
    const absorptionEvents: AbsorptionPresentationEvent[] = [];
    const gravityEvent = events.find((event): event is GravityPresentationEvent => event.type === "sandGravitySettled") ?? null;
    for (const event of events) {
      if (event.type !== "sandAbsorbed") {
        continue;
      }
      for (const absorptionEvent of event.absorptionEvents) {
        absorptionEvents.push(absorptionEvent);
      }
    }
    if (absorptionEvents.length === 0 && gravityEvent === null && finalGrid === null) {
      return;
    }
    this.absorptionQueue.push({
      type: "settlement",
      absorptionEvents: Object.freeze(absorptionEvents),
      gravityEvent,
      finalGrid: gravityEvent?.grid ?? finalGrid,
    });
    this.playNextAbsorptionTask();
  }

  private playNextAbsorptionTask(): void {
    if (this.absorptionPlaying) {
      return;
    }
    const task = this.absorptionQueue.shift();
    if (task === undefined) {
      return;
    }
    this.absorptionPlaying = true;
    const revision = this.absorptionRevision;
    this.playSettlementTask(task, revision);
  }

  private playSettlementTask(task: SandCanvasMotionTask, revision: number): void {
    if (revision !== this.absorptionRevision) {
      this.finishAbsorptionTask();
      return;
    }
    const timelineRevision = this.sandGridView?.beginSettlementTimeline() ?? 0;
    const plans = task.absorptionEvents.map((event) => Object.freeze({
      event,
      plan: createAbsorptionMotionPlan({
        bucketInstanceId: event.bucketInstanceId,
        slotIndex: event.slotIndex,
        colorId: event.colorId,
        absorbedCells: event.absorbedCells,
        amountBefore: event.amountBefore,
        amountAfter: event.amountAfter,
        capacity: event.capacity,
        seed: event.revision,
      }),
    }));

    let lastAbsorbBatchStart = 0;
    let lastAbsorbDuration = 0;
    for (const entry of plans) {
      lastAbsorbDuration = Math.max(lastAbsorbDuration, entry.plan.durationSeconds);
      for (const batch of entry.plan.batches) {
        lastAbsorbBatchStart = Math.max(lastAbsorbBatchStart, batch.startSeconds);
        this.scheduleOnce(() => {
          if (!this.isSettlementCurrent(revision, timelineRevision)) {
            return;
          }
          this.sandGridView?.clearAbsorbedCells(batch.cells);
          this.conveyorView?.setBucketPresentationAmount(entry.plan.bucketInstanceId, batch.presentationAmount);
          if (this.conveyorView?.getBucketMouthWorldPosition(entry.plan.bucketInstanceId) !== null) {
            for (const cell of batch.particleCells) {
              const source = this.sandGridView?.getCellWorldPosition(cell) ?? null;
              if (source !== null) {
                this.spawnAbsorbParticle(source, entry.plan.bucketInstanceId, entry.plan.colorId, revision);
              }
            }
          }
        }, batch.startSeconds);
      }
      this.conveyorView?.playAbsorbPulse(entry.plan.bucketInstanceId);
    }

    const gravityStartSeconds = task.gravityEvent === null || task.gravityEvent.moves.length === 0
      ? lastAbsorbDuration
      : lastAbsorbBatchStart + BATTLE_PRESENTATION_CONFIG.absorptionBatchIntervalSeconds + BATTLE_PRESENTATION_CONFIG.gravityStartAfterLastAbsorbBatchSeconds;
    this.scheduleOnce(() => {
      if (!this.isSettlementCurrent(revision, timelineRevision)) {
        return;
      }
      this.playGravityIterations(task.gravityEvent, task.finalGrid, revision, timelineRevision, lastAbsorbDuration);
    }, gravityStartSeconds);
  }

  private playGravityIterations(
    gravityEvent: GravityPresentationEvent | null,
    finalGrid: BattleViewSnapshot["grid"] | null,
    revision: number,
    timelineRevision: number,
    minFinishSeconds: number,
  ): void {
    if (gravityEvent === null || gravityEvent.moves.length === 0) {
      void minFinishSeconds;
      this.finishSettlementTimeline(finalGrid, revision, timelineRevision, 0);
      return;
    }
    const plan = createGravityTimelinePlan({
      revision: gravityEvent.revision,
      actionId: gravityEvent.actionId,
      moves: gravityEvent.moves,
    });
    const steps = groupGravityMovesByIteration(gravityEvent.moves);
    let stepIndex = 0;
    const tick = (): void => {
      if (!this.isSettlementCurrent(revision, timelineRevision)) {
        return;
      }
      const chunk: GravityIterationStep[] = [];
      for (
        let count = 0;
        count < plan.maxIterationsPerFrame && stepIndex < steps.length;
        count += 1, stepIndex += 1
      ) {
        chunk.push(steps[stepIndex]);
      }
      this.sandGridView?.applyGravityIterations(chunk.map((step) => step.moves));
      if (stepIndex >= steps.length) {
        this.finishSettlementTimeline(finalGrid ?? gravityEvent.grid, revision, timelineRevision, 0);
        return;
      }
      this.scheduleOnce(tick, plan.frameIntervalSeconds);
    };
    tick();
  }

  private finishSettlementTimeline(
    finalGrid: BattleViewSnapshot["grid"] | null,
    revision: number,
    timelineRevision: number,
    delaySeconds: number,
  ): void {
    this.scheduleOnce(() => {
      if (!this.isSettlementCurrent(revision, timelineRevision)) {
        return;
      }
      if (finalGrid !== null) {
        this.sandGridView?.finishSettlementTimeline(finalGrid);
      } else {
        this.sandGridView?.cancelGravityMotion();
      }
      this.conveyorView?.clearPresentationOverrides();
      this.finishAbsorptionTask();
    }, delaySeconds);
  }

  private isSettlementCurrent(revision: number, timelineRevision: number): boolean {
    return revision === this.absorptionRevision && (this.sandGridView?.isSettlementTimelineCurrent(timelineRevision) ?? false);
  }

  private finishAbsorptionTask(): void {
    this.absorptionPlaying = false;
    this.playNextAbsorptionTask();
  }

  private cancelAbsorptionFeedback(): void {
    this.absorptionRevision += 1;
    this.absorptionQueue = [];
    this.absorptionPlaying = false;
    this.sandGridView?.cancelGravityMotion();
    this.conveyorView?.clearPresentationOverrides();
    for (const particle of this.particlePool) {
      const progress = this.particleProgressTargets.get(particle);
      if (progress !== undefined) {
        Tween.stopAllByTarget(progress);
      }
      Tween.stopAllByTarget(particle);
      particle.active = false;
      particle.setScale(1, 1, 1);
      particle.setPosition(0, 0, 0);
      (particle.getComponent(UIOpacity) ?? particle.addComponent(UIOpacity)).opacity = 255;
    }
    this.particleProgressTargets.clear();
    this.activeParticleCount = 0;
  }

  private spawnAbsorbParticle(sourceWorld: Vec3, bucketInstanceId: string, colorId: number, revision: number): void {
    if (revision !== this.absorptionRevision) {
      return;
    }
    const root = this.ensureAbsorbEffectRoot();
    const transform = root.getComponent(UITransform);
    if (transform === null) {
      return;
    }
    const particle = this.acquireAbsorbParticle();
    if (particle === null) {
      return;
    }
    const source = transform.convertToNodeSpaceAR(sourceWorld);
    particle.setPosition(source);
    particle.setScale(0.72, 0.72, 1);
    (particle.getComponent(UIOpacity) ?? particle.addComponent(UIOpacity)).opacity = 230;
    drawParticle(particle, colorId);
    particle.active = true;
    this.activeParticleCount += 1;
    const progress = { value: 0 };
    this.particleProgressTargets.set(particle, progress);
    tween(progress)
      .to(BATTLE_PRESENTATION_CONFIG.absorptionParticleTweenSeconds, { value: 1 }, {
        easing: "quadIn",
        onUpdate: () => {
          if (revision !== this.absorptionRevision || !particle.active) {
            return;
          }
          const targetWorld = this.conveyorView?.getBucketMouthWorldPosition(bucketInstanceId) ?? null;
          if (targetWorld === null) {
            this.recycleAbsorbParticle(particle);
            return;
          }
          const target = transform.convertToNodeSpaceAR(targetWorld);
          const control = new Vec3((source.x + target.x) / 2, Math.max(source.y, target.y) + 36, 0);
          const p = progress.value;
          const x = quadraticBezier(source.x, control.x, target.x, p);
          const y = quadraticBezier(source.y, control.y, target.y, p);
          particle.setPosition(x, y, 0);
          particle.setScale(0.72 - 0.28 * p, 0.72 - 0.28 * p, 1);
        },
      })
      .call(() => {
        this.particleProgressTargets.delete(particle);
        this.recycleAbsorbParticle(particle);
      })
      .start();
  }

  private ensureAbsorbEffectRoot(): Node {
    const existing = this.node.getChildByName("SandAbsorbEffectRoot");
    const root = existing ?? new Node("SandAbsorbEffectRoot");
    if (existing === null) {
      this.node.addChild(root);
    }
    root.setSiblingIndex(50);
    root.getComponent(UITransform) ?? root.addComponent(UITransform);
    root.getComponent(UITransform)?.setContentSize(750, 1334);
    root.setPosition(0, 0, 0);
    root.active = true;
    return root;
  }

  private acquireAbsorbParticle(): Node | null {
    const free = this.particlePool.find((particle) => !particle.active);
    if (free !== undefined) {
      return free;
    }
    if (this.particlePool.length >= BATTLE_PRESENTATION_CONFIG.absorptionParticlePoolCapacity) {
      return null;
    }
    const particle = new Node(`PooledSandParticle${this.particlePool.length + 1}`);
    particle.addComponent(UITransform).setContentSize(8, 8);
    particle.addComponent(UIOpacity);
    particle.addComponent(Graphics);
    particle.active = false;
    this.ensureAbsorbEffectRoot().addChild(particle);
    this.particlePool.push(particle);
    return particle;
  }

  private recycleAbsorbParticle(particle: Node): void {
    const progress = this.particleProgressTargets.get(particle);
    if (progress === undefined && !particle.active) {
      return;
    }
    if (progress !== undefined) {
      Tween.stopAllByTarget(progress);
      this.particleProgressTargets.delete(particle);
    }
    Tween.stopAllByTarget(particle);
    particle.active = false;
    particle.setPosition(0, 0, 0);
    particle.setScale(1, 1, 1);
    (particle.getComponent(UIOpacity) ?? particle.addComponent(UIOpacity)).opacity = 255;
    particle.getComponent(Graphics)?.clear();
    this.activeParticleCount = Math.max(0, this.activeParticleCount - 1);
  }

  private debugBucketEntryFlow(message: string): void {
    if (this.debugBucketEntryFlowEnabled) {
      console.log(`[BattleRoot] ${message}`);
    }
  }

  private recordSimulationDebugStats(deltaTime: number, ticksThisFrame: number): void {
    if (!this.presentationDebugLogging) {
      return;
    }
    this.debugStatsWindowSeconds += deltaTime;
    if (this.debugStatsWindowSeconds < 1) {
      return;
    }
    const tickRate = this.debugStatsTicks / this.debugStatsWindowSeconds;
    const visibleRate = this.debugStatsVisibleFrames / this.debugStatsWindowSeconds;
    const averageMerged = this.debugStatsVisibleFrames === 0 ? 0 : this.debugStatsMergedTicks / this.debugStatsVisibleFrames;
    console.log(
      `[BattleRoot] simTicks=${tickRate.toFixed(1)}/s visibleFrames=${visibleRate.toFixed(1)}/s ` +
      `avgMergedTicks=${averageMerged.toFixed(2)} queue=${this.simulationFrameQueue.size} ` +
      `dropped=${this.simulationFrameQueue.droppedFrameCount} lastFrameTicks=${ticksThisFrame}`,
    );
    this.debugStatsWindowSeconds = 0;
    this.debugStatsTicks = 0;
    this.debugStatsVisibleFrames = 0;
    this.debugStatsMergedTicks = 0;
  }
}

function quadraticBezier(start: number, control: number, end: number, progress: number): number {
  const inverse = 1 - progress;
  return inverse * inverse * start + 2 * inverse * progress * control + progress * progress * end;
}
function drawParticle(node: Node, colorId: number): void {
  const graphics = node.getComponent(Graphics);
  if (graphics === null) return;
  graphics.clear();
  graphics.fillColor = colorFromHex(getSandCanvasPaletteEntry(colorId).fill, 235);
  graphics.circle(0, 0, 3.2);
  graphics.fill();
}
function colorFromHex(hex: string, alpha = 255): Color {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const value = Number.parseInt(normalized, 16);
  return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha);
}

function drawTutorialBackground(graphics: Graphics | null): void {
  if (graphics === null) {
    return;
  }
  graphics.clear();
  graphics.fillColor = new Color(255, 248, 224, 238);
  graphics.strokeColor = new Color(125, 93, 48, 180);
  graphics.lineWidth = 3;
  graphics.roundRect(-280, -32, 560, 64, 20);
  graphics.fill();
  graphics.stroke();
}

function drawWorkshopRuntimeBackdrop(graphics: Graphics | null, theme: ThemeConfig): void {
  if (graphics === null) {
    return;
  }
  const background = colorFromHex(theme.placeholderBackgroundColor ?? "#F4F6F2", 220);
  const frame = colorFromHex(theme.placeholderFrameColor ?? "#B59E73", 120);
  graphics.clear();
  graphics.fillColor = background;
  graphics.rect(-WORKSHOP_BG_SIZE.width / 2, -WORKSHOP_BG_SIZE.height / 2, WORKSHOP_BG_SIZE.width, WORKSHOP_BG_SIZE.height);
  graphics.fill();

  graphics.fillColor = new Color(255, 255, 255, 44);
  graphics.roundRect(-356, 100, 712, 594, 34);
  graphics.fill();
  graphics.strokeColor = frame;
  graphics.lineWidth = 3;
  graphics.roundRect(-356, 100, 712, 594, 34);
  graphics.stroke();

  graphics.fillColor = new Color(255, 255, 255, 86);
  graphics.roundRect(-360, -212, 720, 166, 28);
  graphics.fill();
  graphics.strokeColor = colorFromHex(theme.placeholderFrameColor ?? "#82918A", 86);
  graphics.lineWidth = 2;
  graphics.roundRect(-360, -212, 720, 166, 28);
  graphics.stroke();

  graphics.fillColor = new Color(255, 255, 255, 108);
  graphics.roundRect(-360, -590, 720, 382, 32);
  graphics.fill();
  graphics.strokeColor = colorFromHex(theme.placeholderFrameColor ?? "#B59E73", 92);
  graphics.lineWidth = 3;
  graphics.roundRect(-360, -590, 720, 382, 32);
  graphics.stroke();

  graphics.strokeColor = colorFromHex(theme.placeholderFrameColor ?? "#B59E73", 42);
  graphics.lineWidth = 2;
  for (let y = -540; y <= -260; y += 58) {
    graphics.moveTo(-326, y);
    graphics.lineTo(326, y + 10);
    graphics.stroke();
  }
}
