# Game Design

## Product Direction

SandArtMatch is a portrait-mode WeChat mini game built around sand collection, color matching, bucket management, and limited conveyor slots.

Frozen:

- Platform: WeChat mini game.
- Orientation: portrait only.
- Base design resolution: 750 x 1334.
- Core interaction: single-tap bucket selection.
- Primary play goal: clear the sand artwork by collecting exposed same-color sand into buckets.

## Core Experience

Frozen:

1. Player observes exposed sand colors.
2. Player selects a sand bucket.
3. The selected bucket enters the conveyor.
4. Buckets automatically absorb exposed same-color sand.
5. Sand settles through deterministic gravity.
6. Full buckets leave and release slots.
7. Three same-color buckets can merge.
8. The player wins by clearing the sand artwork.

## MVP Scope

Frozen in MVP:

- Sand grid.
- Deterministic gravity.
- Exposed sand detection.
- Sand buckets.
- Conveyor.
- Three-bucket merge.
- Automatic sand absorption.
- Win/loss judgment.
- Deadlock judgment.
- Undo.
- Portrait battle UI.
- Test level.

Not included in MVP:

- Shop.
- Sign-in.
- Leaderboard.
- Daily challenge.
- Formal ad SDK.
- Social system.

## Post-MVP References

The raw spec includes pages and systems for collection, sign-in, shop, daily challenge, activity banners, ad rewards, and wider economy flows.

Status:

- Collection:待验证.
- Sign-in: excluded from MVP.
- Shop: excluded from MVP.
- Daily challenge: excluded from MVP.
- Formal ad SDK: excluded from MVP.
- Rewarded ad extra slot:待验证 unless implemented as a non-SDK placeholder.

## Source Deduplication Notes

The raw spec repeats the same product direction across V0.4 and V0.5. This document keeps only the frozen product direction and MVP boundary.
