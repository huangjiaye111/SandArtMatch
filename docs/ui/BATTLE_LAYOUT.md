# Battle Layout

## Portrait Baseline

Frozen:

- Final layout is portrait only.
- Base design resolution is 750 x 1334.
- Battle layout has four main vertical zones:
  - Top: sand artwork.
  - Middle: conveyor.
  - Lower: bucket pool.
  - Bottom: tool bar.
- Default conveyor slots: 6.
- Bucket pool: 2 rows x 4 columns.

## Baseline Area Plan

可配置:

- Top HUD height.
- Sand artwork height.
- Conveyor height.
- Bucket pool height.
- Tool bar height.
- Safe-area margins.

Reference values from the raw spec:

- Top status: about 0 to 110.
- Sand area: about 110 to 700.
- Conveyor: about 700 to 885.
- Bucket selection: about 885 to 1190.
- Tool area: about 1190 to 1334.

These values are guidance, not frozen exact coordinates.

## Adaptation

Frozen:

- Important controls must avoid notch, rounded corner, and bottom gesture areas.
- Six conveyor slots must remain clearly visible in the default layout.

可配置:

- Fit Width behavior.
- Fit Height behavior.
- Maximum content width on tablets.
- Minimum sand-area height.

待验证:

- Exact adaptive layout algorithm.
- Whether the raw-spec 480px minimum sand-area recommendation is feasible on all target phones.

## Interaction Targets

可配置:

- Bucket tap area.
- Tool button tap area.
- Slot dimensions.

待验证:

- Final minimum tap area for all supported devices.

## Visual Constraints

可配置:

- Sand frame art style.
- Conveyor art style.
- Bucket artwork.
- Slot state highlights.

待验证:

- Whether capacity is always shown on the bucket body.
- Whether hint highlight conflicts with locked or frozen visuals once special buckets are implemented.
