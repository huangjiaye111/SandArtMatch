# UI Spec

## Authority

The final project scheme is portrait only. UI decisions must follow `docs/DECISIONS.txt` first, then this document.

## Global UI Direction

Frozen:

- Orientation: portrait.
- Base design resolution: 750 x 1334.
- Battle UI layout: sand artwork at top, conveyor in the middle, bucket pool below, tool bar at bottom.
- Default conveyor display supports six visible slots.
- Bucket pool layout is 2 rows x 4 columns.

可配置:

- Exact colors, fonts, spacing, icon assets, animation curves, and final art style.
- Safe-area padding.
- Page-specific fit-width or fit-height behavior.

## MVP Screens

Frozen for MVP:

- Battle UI.
- Pause popup.
- Fail popup.
- Win popup.
- Toast or lightweight feedback.

待验证:

- Home screen for MVP.
- Level select for MVP.
- Settings screen for MVP.
- Tutorial UI for MVP.

Excluded from MVP:

- Shop.
- Sign-in.
- Daily challenge.
- Leaderboard.
- Social UI.

## Battle UI Components

Frozen:

- Sand artwork area.
- Conveyor area.
- Bucket selection area.
- Tool bar area.

可配置:

- Top HUD contents.
- Progress display format.
- Slot counter style.
- Bucket capacity label style.
- Button states.
- Toast text.

待验证:

- Whether battle HUD shows currency in MVP.
- Whether extra-slot button is enabled, hidden, or present as a disabled placeholder.

## Component States

可配置:

- Button states: normal, pressed, disabled, selected, loading.
- Bucket visual states: idle, selected, entering, waiting, absorbing, merge-ready, merging, completed, leaving, locked, frozen, unknown.
- Popup states: hidden, opening, visible, closing.

待验证:

- Exact state names used in code.
- Exact animation timing for state changes.

## Raw Spec Deduplication

The raw spec repeats UI rules in V0.4 and V0.5. This document keeps only the portrait baseline, MVP screen boundary, and status of uncertain UI items.
