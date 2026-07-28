# TASK 016: First Playable Hardening

## 目标

在不扩大 MVP 功能范围的前提下，稳定 TASK015 已交付的 First Playable 垂直切片，优先消除阻塞性和高频 Bug，并形成可重复执行的自动化与 Cocos 人工验收基线。

## 前置任务

- `TASK_015_FIRST_PLAYABLE.md`

## 背景和当前问题

TASK015 已经把固定测试关、`BattleStateMachine`、Cocos Battle UI、桶点击、自动吸沙、重力、合成、满桶离场、胜利/死局与 Undo 串成可玩闭环。当前自动测试和 TypeScript 检查通过，但 First Playable 仍处于最小可玩状态，尚未经过高频输入、长时间连续操作、重复进入场景、异常恢复、确定性重放和 Cocos Console 清洁度的集中验证。

Funplay Cocos MCP 场景校验显示 `Battle.scene` 可读取，脚本诊断通过，场景包含 `BattleRoot`、`ToolbarView`、`SandGridView`、`ConveyorView`、`BucketPoolView`、6 个传送带槽和 2 行 x 4 列桶池。但校验结果仍受项目日志错误影响，需要在下一阶段确认哪些是历史噪音，哪些是当前 Battle 场景风险。

## 实现范围

- 补强 `BattleStateMachine` 的异常恢复与稳定态保护。
- 补强输入锁定与重复点击行为，确保 UI 操作不会绕过或重入状态机结算。
- 补强 Undo 在吸沙、重力、合成、满桶离场、胜利/死局前后的完整性。
- 补强 First Playable 内置测试关的确定性重放与长操作序列回归。
- 补强胜利和死局判定边界，尤其是满槽但仍可吸沙、可合成、可离场或可重力结算的场景。
- 检查 Cocos Battle 场景重复进入后的监听注册与释放。
- 检查节点清理、结果面板显示/隐藏、按钮状态和反馈文本不会留下旧状态。
- 建立竖屏基础适配人工验收清单。
- 建立 First Playable 性能基线记录，包括节点数、组件数、帧率或可用替代指标。
- 清理或隔离与当前 Battle 场景相关的 Console 错误和不必要日志。

## 明确不做

- 不做商店。
- 不做签到。
- 不做排行榜。
- 不做每日挑战。
- 不接入正式广告 SDK。
- 不做社交系统。
- 不做大规模正式关卡制作。
- 不做正式美术重制。
- 不做与 First Playable 稳定性无关的架构重写。
- 不改变已冻结玩法规则，除非先更新决策文档并获得确认。

## 参考文档

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/INDEX.md`
- `docs/planning/MVP_ROADMAP.md`
- `docs/product/GAME_DESIGN.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/technical/ARCHITECTURE.md`
- `docs/technical/PERFORMANCE.md`
- `docs/ui/BATTLE_LAYOUT.md`
- `docs/gameplay/BATTLE_STATE_MACHINE.md`
- `docs/tasks/TASK_014_BATTLE_UI_SKELETON.md`
- `docs/tasks/TASK_015_FIRST_PLAYABLE.md`

## 建议文件

- `assets/scripts/domain/battle/BattleStateMachine.ts`
- `assets/scripts/domain/battle/Outcome.ts`
- `assets/scripts/domain/battle/Settlement.ts`
- `assets/scripts/domain/battle/UndoStack.ts`
- `assets/scripts/domain/bucket/Merge.ts`
- `assets/scripts/domain/bucket/Conveyor.ts`
- `assets/scripts/domain/config/TestLevels.ts`
- `assets/scripts/cocos/battle/BattleRoot.ts`
- `assets/scripts/cocos/battle/BattlePresenter.ts`
- `assets/scripts/cocos/battle/BucketPoolView.ts`
- `assets/scripts/cocos/battle/ToolbarView.ts`
- `tests/domain/BattleStateMachine.test.ts`
- `tests/domain/DeadlockDetector.test.ts`
- `tests/domain/Undo.test.ts`
- `tests/domain/LevelLoader.test.ts`
- `tests/domain/BattlePresenter.test.ts`
- Cocos 人工检查：`assets/scenes/Battle.scene`

## 领域约束

- Gameplay domain 必须继续保持纯 TypeScript。
- Gameplay domain 不得依赖 Cocos `Node`、`Component` 或场景资源。
- UI 不得直接修改 gameplay domain 状态。
- 玩家操作必须继续经由 `BattleStateMachine`。
- 不得在 gameplay domain 使用 `Math.random()`。
- 不得无声改变吸沙、重力、合成、满桶离场、胜利或死局规则。
- 异常恢复必须保证 grid、bucket、conveyor、random、merge sequence、phase、actionIndex 和 undo history 不进入半更新状态。

## Cocos层约束

- 保持竖屏。
- 保持 750 x 1334 基准设计分辨率。
- 默认传送带容量保持 6。
- 桶池保持 2 行 x 4 列。
- 保留 `.meta` 文件和 UUID 引用。
- 不直接手写或重写 `.scene` / `.prefab`。
- 需要场景调整时，优先给出明确编辑器操作说明，并在 Cocos 中检查引用。
- 组件销毁、重新进入 Battle、按钮重复绑定和节点清理必须可人工验证。

## 确定性要求

- 同一初始关卡、同一 seed、同一操作序列必须得到完全一致的 action result 和最终 snapshot。
- Undo 后重复执行同一操作必须得到与首次执行一致的结果。
- 长操作序列中不得引入不可复现随机源。
- 自动测试必须继续包含 domain 内无 `Math.random()` 的检查。

## 性能要求

- 建立当前 First Playable 的基线记录：节点数、组件数、Label/Button 数、可用内存或 MCP 可读指标。
- 长时间连续操作不应出现明显节点泄漏、监听泄漏或 UI 状态堆积。
- 性能优化只处理稳定性相关问题，不做正式特效和美术优化。
- 不得为了性能改变玩法结算结果。

## 自动测试要求

- 运行全部现有 domain 测试。
- 运行 TypeScript 检查。
- 新增 First Playable 确定性重放测试。
- 新增高频重复点击或输入锁测试。
- 新增 Undo 跨合成、吸沙、重力、满桶离场后的组合回归测试。
- 新增胜利和死局边界回归测试。
- 新增异常恢复后可继续操作的测试。
- 保持测试不需要加载 Cocos 场景。

## Cocos编辑器人工验收

- 打开 `Battle.scene`，确认所有 `@property` 引用未丢失。
- 运行 Battle 场景，完成至少一次完整通关。
- 运行 Battle 场景，触发至少一次死局或失败反馈。
- 在通关前多次 Undo，并继续操作到稳定结果。
- 连续快速点击同一桶、不同桶和 Undo，确认不会重复入队、重复扣状态或卡死。
- 连续进入、退出、重新进入 Battle 场景，确认按钮监听没有重复触发。
- 检查 ResultPanel 的显示和隐藏不会遮挡后续状态。
- 在至少两个竖屏尺寸下确认 sand area、6 个槽、2 行 x 4 列桶池和底部工具栏不重叠。
- 检查 Cocos Console，记录并处理与当前 Battle 场景相关的 error/warning。
- 使用 Funplay MCP 或 Cocos 可用工具记录场景校验结果和性能基线。

## 验收条件

- First Playable 固定测试关仍可从 Battle 场景开始玩到胜利或死局。
- 所有玩家输入仍通过 `BattleStateMachine`。
- 高频点击不会导致重复入队、重复 Undo、状态机重入或 UI 与 domain 不一致。
- Settlement 异常会回滚到操作前稳定快照，并且之后仍能继续合法操作。
- Undo 能完整恢复 sand、bucket、conveyor、random、merge sequence、phase、actionIndex 和 undo history。
- 吸沙、重力、合成、满桶离场、胜利和死局回归测试通过。
- 满槽不会被误判为立即失败。
- 胜利优先级高于死局。
- 同 seed 同操作序列重放结果一致。
- Battle 场景重复进入后不会出现按钮监听重复触发。
- Battle 场景人工验收记录无阻塞性 Console 错误。
- 性能基线已记录，且未发现明显节点或监听泄漏。
- `npm.cmd test` 通过。
- `npm.cmd run typecheck` 通过。

## 禁止事项

- 禁止新增生产依赖。
- 禁止实现非 MVP 系统。
- 禁止修改商店、签到、排行榜、每日挑战、广告 SDK 或社交系统。
- 禁止大规模重写架构。
- 禁止直接重写 `.scene` / `.prefab` JSON。
- 禁止绕过 `BattleStateMachine` 演示玩法。
- 禁止使用不可复现随机。
- 禁止用日志掩盖状态不一致或异常。

## 完成后的里程碑判断

完成 TASK016 后，如果 First Playable 自动测试、Cocos 人工验收、Console 清洁度、确定性重放、生命周期和性能基线均通过，则项目可判断为进入 MVP Acceptance And Polish 后半段。下一阶段可以开始推进更真实的竖屏可读性与交互表现，或根据路线图准备 MVP 验收与微信预览打包。
