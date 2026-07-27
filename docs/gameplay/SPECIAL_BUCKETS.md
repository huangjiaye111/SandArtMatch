# Special Buckets

## MVP Status

Frozen:

- Special buckets are not listed as part of the first MVP in `docs/DECISIONS.txt`.

Therefore, all special bucket rules below are either post-MVP references, 可配置, or 待验证.

## Question Bucket

Raw-spec idea:

- A bucket may hide some information until revealed.

待验证:

- Whether only color is hidden.
- Whether capacity remains visible.
- Reveal timing.
- Whether this belongs in the first post-MVP release.

## Key Bucket

Raw-spec idea:

- A key bucket may unlock another bucket or blocker.

待验证:

- Unlock target rules.
- Whether key buckets occupy conveyor slots normally.
- Whether key behavior affects deadlock checks.

## Locked Bucket

Raw-spec idea:

- A bucket may be unavailable until unlocked.

待验证:

- Lock condition.
- Unlock condition.
- Whether locked buckets appear in the bucket pool, conveyor, or both.

## Frozen Bucket

Raw-spec idea:

- A bucket may be temporarily frozen.

待验证:

- Freeze duration.
- Whether frozen buckets can absorb, merge, or leave.
- Whether freeze is turn-based, time-based, or settlement-based.

## Wild Bucket

Raw-spec idea:

- A bucket may match more than one color.

待验证:

- Whether wild buckets exist.
- Matching priority.
- Merge rules.
- Impact on deadlock detection.

## Documentation Rule

No special bucket behavior should be treated as implementation truth until promoted into `docs/DECISIONS.txt` or a specific active task.
