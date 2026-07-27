# TASK 015: First Playable

## 目标

交付首个可运行垂直切片：一个固定测试关卡从打开 Battle 场景到胜利或死局完整可玩。

## 前置任务

- `TASK_014_BATTLE_UI_SKELETON.md`

## 实现范围

- 串联测试关卡、状态机、沙画显示、传送带、桶池和 Undo。
- 完成基础胜利、失败、无效操作反馈。
- 确认自动吸沙、重力、合成、满桶离场、死局检查顺序。
- 做最小可接受的视觉反馈。

## 明确不做的内容

- 不做商店。
- 不做签到。
- 不做排行榜。
- 不做每日挑战。
- 不做正式广告 SDK。
- 不做社交系统。
- 不做多关卡流程。

## 参考文档

- `docs/product/GAME_DESIGN.md`
- `docs/planning/MVP_ROADMAP.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/ui/BATTLE_LAYOUT.md`
- `docs/technical/ARCHITECTURE.md`

## 建议文件

- `assets/scripts/domain/**`
- `assets/scripts/cocos/battle/**`
- `tests/domain/**`
- 编辑器修改：`assets/scenes/Battle.scene`
- 编辑器创建或修改：`assets/prefabs/battle/*.prefab`

## 验收条件

- 打开 Battle 场景即可玩固定测试关卡。
- 点击桶进入传送带并占槽。
- 桶自动吸收暴露同色沙。
- 沙粒按确定性重力下落。
- 满桶离场释放槽位。
- 三个同色桶可合成。
- 支持 Undo。
- 清空沙画显示胜利。
- 稳定结算后无可行动作显示失败或死局。
- 满槽不会立即失败。

## 测试要求

- 全部 domain 测试通过。
- 确认 domain 中无 `Math.random()`。
- 至少一次手动完整通关或触发死局。
- 手动验证 Undo 后继续操作结果正确。

## Cocos编辑器人工操作

- 打开并检查 Battle 场景。
- 确认所有组件引用未丢失。
- 预览竖屏布局。
- 手动操作完整流程并记录问题。

## 禁止事项

- 禁止扩大 MVP 到非战斗系统。
- 禁止直接手写 `.scene` / `.prefab`。
- 禁止为了演示绕过 `BattleStateMachine`。
- 禁止使用不可复现随机。
- 禁止 UI 直接修改 gameplay domain 状态。
