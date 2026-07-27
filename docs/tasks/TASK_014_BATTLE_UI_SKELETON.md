# TASK 014: Battle UI Skeleton

## 目标

搭建 Cocos Battle 场景的最小 UI 骨架，连接 `BattleStateMachine`，实现可点击、可刷新、可显示基础结果。

## 前置任务

- `TASK_013_LEVEL_LOADER.md`

## 实现范围

- 编写 Cocos 展示层组件。
- 展示沙画区域、6 个传送带槽、2 行 x 4 列桶池、底部工具栏。
- 点击桶时调用状态机 action。
- Undo 按钮调用状态机 undo action。
- 根据 view snapshot 刷新 UI。

## 明确不做的内容

- 不做正式美术。
- 不做复杂动画。
- 不做 Home、Level Select、Shop。
- 不做正式广告 SDK。

## 参考文档

- `docs/ui/UI_SPEC.md`
- `docs/ui/BATTLE_LAYOUT.md`
- `docs/gameplay/BATTLE_STATE_MACHINE.md`
- `docs/technical/ARCHITECTURE.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`

## 建议文件

- `assets/scripts/cocos/battle/BattleRoot.ts`
- `assets/scripts/cocos/battle/BattlePresenter.ts`
- `assets/scripts/cocos/battle/SandGridView.ts`
- `assets/scripts/cocos/battle/BucketPoolView.ts`
- `assets/scripts/cocos/battle/ConveyorView.ts`
- `assets/scripts/cocos/battle/ToolbarView.ts`
- 编辑器创建：`assets/prefabs/battle/*.prefab`
- 编辑器修改：`assets/scenes/Battle.scene`

## 验收条件

- Battle 场景为竖屏布局，基准 750 x 1334。
- 沙画区、传送带、桶池、工具栏可见。
- 默认 6 个传送带槽可见。
- 桶池为 2 行 x 4 列。
- 点击桶通过状态机，不直接改 domain。
- Undo 按钮通过状态机。

## 测试要求

- 运行 domain 自动化测试。
- 在 Cocos Creator 中手动验证点击桶、刷新沙画、Undo、胜负状态。
- 如有可用预览环境，截图确认布局不重叠。

## Cocos编辑器人工操作

- 创建并保存 Battle 场景节点层级。
- 创建桶、槽位、沙格或沙块 prefab。
- 挂载脚本组件并绑定 `@property` 引用。
- 配置 Canvas、Widget、UITransform、Button、Label、Sprite 或 Graphics。

## 禁止事项

- 禁止直接手写或重写 `.scene` / `.prefab` JSON。
- 禁止 UI 直接修改核心 battle state。
- 禁止把逻辑沙粒实现为必须依赖 Cocos Node 的结构。
- 禁止加入 MVP 外页面。
