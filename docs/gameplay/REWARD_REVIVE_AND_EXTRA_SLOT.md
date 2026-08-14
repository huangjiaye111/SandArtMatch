# Rewarded Revive And Extra Slot

## TASK032 Frozen Rules

Rewarded revive is a mocked rewarded-ad flow that can restore a failed battle only after the failure panel is shown. It does not change normal victory flow.

Extra carrier slot is an optional feature-gated runtime capability. It must not change the default conveyor capacity of 6 unless the explicit feature flag is enabled.

## Revive

- Ad type: `extra_carrier` for the current mock flow.
- Entry point: failure panel revive action.
- Acceptance: a successful rewarded ad grants one revive attempt for the current failed battle.
- Rejection: closed, failed, or unavailable ad results keep the battle in the failed state and keep the revive action available if the panel remains visible.
- Scope: mock ad service only for this task.

## Extra Slot

- Feature flag: `battle.extraCarrierSlot`.
- Default: disabled.
- Default conveyor capacity remains `6`.
- When enabled, the current battle can start with one additional conveyor slot, but only through the explicit flag.
- The flag must not affect unrelated game modes or the base conveyor implementation.
