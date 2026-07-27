# Performance

## Goals

Performance targets from the raw spec are planning references, not frozen requirements.

可配置:

- Normal page draw-call target.
- Stable battle draw-call target.
- Heavy sand-animation draw-call target.
- Particle count limits.
- Low-performance mode behavior.

## Reference Targets

待验证:

- Normal pages: below 40 draw calls.
- Stable battle: below 80 draw calls.
- Heavy sand animation: below 120 draw calls.

These values should be validated on target WeChat devices before becoming frozen.

## Logic And Visual Separation

Frozen:

- Logical sand count is independent from visual particle count.
- Low-performance visual settings must not change gameplay logic.

可配置:

- Visual sand particle reduction ratio.
- Flow-line count.
- Background particles.
- Popup blur.
- Merge effect complexity.

## Validation

待验证:

- Target low-end device list.
- Frame-rate target.
- Memory budget.
- Texture atlas layout.
- Sand simulation step budget.
