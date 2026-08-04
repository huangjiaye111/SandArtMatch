import type { BattlePresentationEvent } from "./BattleViewContract";
import { BATTLE_PRESENTATION_CONFIG } from "./BattlePresentationConfig";

export interface PresentationStep {
  readonly events: readonly BattlePresentationEvent[];
  readonly durationMs: number;
}

const DURATIONS: Record<string, number> = Object.freeze({
  bucketClicked: 90,
  bucketEnteredConveyor: BATTLE_PRESENTATION_CONFIG.bucketFlyDurationSeconds * 1000,
  exposedSandHighlighted: 180,
  sandAbsorbed: 280,
  sandGravitySettled: 0,
  merge: BATTLE_PRESENTATION_CONFIG.mergeDurationSeconds * 1000,
  fullBucketLeft: BATTLE_PRESENTATION_CONFIG.fullBucketExitDurationSeconds * 1000,
  sandCanvasRedrawn: 0,
  invalidClick: 120,
  victory: 220,
  deadlock: 220,
});

export function createPresentationQueue(events: readonly BattlePresentationEvent[]): readonly PresentationStep[] {
  return Object.freeze(
    events.map((event) => Object.freeze({
      events: Object.freeze([event]),
      durationMs: DURATIONS[event.type] ?? 120,
    })),
  );
}
