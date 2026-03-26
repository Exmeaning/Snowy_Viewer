# 魔改版 sekai-calculator

基于 [sekai-calculator](https://www.npmjs.com/package/sekai-calculator) 的魔改版本，参考 [sekai-deck-recommend-cpp](https://github.com/) C++ 优化版进行了多项计算精度和功能增强。

## 魔改内容

### 1. BFES 卡牌花前花后多技能处理

**问题**：原版将花前/花后技能合并处理，只取最大值，无法精确找到最优的花前花后组合。

**优化**：
- `card-skill-calculator.ts`：为花前（原始技能）和花后（觉醒后特殊技能）分别生成独立的 `DeckCardSkillDetailPrepare`，每个技能记录 `skillId` 和 `isAfterTraining` 标记
- `deck-calculator.ts`：通过 bitmask 枚举所有双技能卡的花前/花后组合，对每种组合分别计算实际技能效果，自动选择最优方案
- 结果中返回每张卡是否使用花前技能（`isPreTrainingSkill`）以及卡面状态（`defaultImage`）

### 2. 吸技能策略（SkillReferenceChooseStrategy）

**问题**：原版固定取其他卡中最高的被吸技能值，不够灵活。

**优化**：支持三种吸技能选择策略：
- `Max`：取最大值（乐观估计）
- `Min`：取最小值（保守估计）
- `Average`：取平均值（默认，贴近实际期望）

### 3. 烤森组卡（Mysekai Deck Recommend）

**新增功能**：推荐烤森（My SEKAI）获取活动 PT 用的最优卡组。

**公式**（来源 @SYLVIA0x0）：
```
powerBonus = floor((1 + power / 450000) * 10) / 10
eventBonusRate = floor(eventBonus) / 100
mysekaiEventPoint = floor(powerBonus * (1 + eventBonusRate)) * 500
```

**相关文件**：
- `src/mysekai-information/mysekai-event-calculator.ts`：烤森活动点数计算
- `src/deck-recommend/mysekai-deck-recommend.ts`：烤森组卡推荐入口

### 4. 控分组卡（指定活动加成组卡）

支持以特定目标活动加成（数值完全准确）的卡牌推荐，包括：
- 非 WL 活动：按 `(bonus*2, characterId)` 分组 + 分层过滤 + 上下界剪枝
- WL 活动：按 `(bonus*2, characterId, attr)` 分组 + 异色加成 + 分层过滤

**相关文件**：
- `src/deck-recommend/event-bonus-deck-recommend.ts`

### 5. 推荐优化目标（RecommendTarget）

新增多种优化目标：
| 目标 | 说明 |
|------|------|
| `Score` | 分数最高（默认） |
| `Power` | 综合力最高 |
| `Skill` | 技能实效最高 |
| `Bonus` | 指定活动加成 |
| `Mysekai` | 烤森活动点数最高 |

### 6. 新增配置项（DeckRecommendConfig）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `target` | `RecommendTarget` | `Score` | 推荐优化目标 |
| `skillReferenceChooseStrategy` | `SkillReferenceChooseStrategy` | `Average` | 吸技能选择策略 |
| `keepAfterTrainingState` | `boolean` | `false` | 是否保持用户设置的花前花后状态 |
| `bestSkillAsLeader` | `boolean` | `true` | 是否自动将技能最高的卡放到队长位 |

## 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/card-information/card-skill-calculator.ts` | 重构 | 花前花后独立技能处理 |
| `src/card-information/card-detail-map-skill.ts` | 重构 | 适配新的技能查询接口 |
| `src/card-information/card-calculator.ts` | 修改 | CardDetail 新增 defaultImage 字段 |
| `src/deck-information/deck-calculator.ts` | 重构 | 花前花后枚举 + 吸技能策略 + multiLiveScoreUp |
| `src/deck-recommend/base-deck-recommend.ts` | 修改 | 新增 RecommendTarget、新配置项透传 |
| `src/deck-recommend/find-best-cards-ga.ts` | 修改 | GA 算法透传新参数 |
| `src/deck-recommend/event-bonus-deck-recommend.ts` | 已有 | 控分组卡（非WL + WL） |
| `src/mysekai-information/mysekai-event-calculator.ts` | 新增 | 烤森活动点数计算 |
| `src/deck-recommend/mysekai-deck-recommend.ts` | 新增 | 烤森组卡推荐 |
| `src/index.ts` | 修改 | 导出新模块 |

## 参考

- C++ 优化版：`refer/sekai-deck-recommend-cpp-master/`
- 原版 sekai-calculator：[npm](https://www.npmjs.com/package/sekai-calculator)

---

# sekai-calculator (原版说明)

Project SEKAI Calculator for deck power, live score, event point and more.
Moreover, it can recommend deck and music to get higher score or event point.

This project is fully developed with TypeScript, while reducing `any` as possible.

Both ECMAScript Module `index.mjs` and CommonJS `index.cjs` are provided with types `index.d.ts` for TypeScript.

## Quick Start
### Install
```shell
# npm
npm i sekai-calculator
# yarn
yarn add sekai-calculator
# pnpm
pnpm add sekai-calculator
```
### Usage
A `DataProvider` implementation is required for providing `UserData`, `MasterData` and `MusicMeta`.
Basically, `UserArea`, `UserCard`, `UserCharacter` and `UserHonor` are required in `UserData`.

## Development
### Release
```shell
pnpm release
