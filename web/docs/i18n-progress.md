# Moesekai i18n 迁移进度与协作技术文档

> 更新时间：2026-05-21（完成 QuickFilterContext / 卡牌筛选枚举 hooks 与音乐详情页用户可见文案 i18n，中文残留扫描与定向 ESLint 通过）  
> 适用范围：`web/` 前端 Next.js 应用  
> 当前目标：逐步将硬编码中文 UI 文案迁移到内置 i18n 字典，支持 `zh-CN` / `en-US`，并为后续更多语言预留结构。

## 1. 背景与现状

Moesekai 前端页面数量多，且包含大量列表页、详情页、筛选面板、弹窗、卡片、SEO metadata 与 masterdata 枚举标签。i18n 迁移不是单纯替换页面标题，而是需要覆盖：

- 表层路由页面：例如 `/cards`、`/events`、`/materials`、`/exchanges`、`/honors`。
- 动态详情页：例如 `/cards/[id]`、`/exchanges/[id]`、`/live/[id]`。
- 复用组件：导航、筛选器、账号选择器、弹窗、快捷键帮助、Footer 等。
- 类型/工具层枚举：卡牌属性、活动类型、兑换所状态、称号稀有度等。
- 个人工具页：`/profile`、`/my-cards`、`/my-musics`、`/my-materials`。
- metadata / OpenGraph / Twitter 描述等非正文 UI。

当前已经建立了基础 i18n 系统，并完成多个核心数据库页与个人页的迁移。剩余工作仍然很大，尤其是动态详情页和复杂工具页。

## 2. 当前 i18n 架构

### 2.1 核心目录

```text
web/src/lib/i18n/
├── format.ts                  # 字典路径读取与 {token} 插值
├── index.ts                   # i18n 入口导出
├── locales.ts                 # locale 定义、默认语言、localStorage key、document lang
└── messages/
    ├── index.ts               # messagesByLocale / fallbackMessages
    ├── types.ts               # MessageTree 类型
    ├── zh-CN/index.ts         # 简体中文文案
    └── en-US/index.ts         # 英文文案

web/src/contexts/I18nContext.tsx
```

### 2.2 使用方式

客户端组件中使用：

```tsx
import { useI18n } from "@/contexts/I18nContext";

function Example() {
    const { t, formatDate, formatNumber, locale, setLocale } = useI18n();

    return (
        <>
            <h1>{t("page.cards.title")}</h1>
            <p>{t("page.cards.allLoaded", { count: 100 })}</p>
            <time>{formatDate(Date.now())}</time>
            <span>{formatNumber(12345)}</span>
        </>
    );
}
```

### 2.3 字典 fallback 行为

`t(key)` 会按以下顺序查找：

1. 当前 locale 字典。
2. fallback 字典。
3. 如果仍找不到，直接返回 key 字符串。

因此可以用以下方式判断是否缺失：

```ts
const key = `common.exchange.rewardTypes.${resourceType}`;
const label = t(key);
return label === key ? resourceType.replace(/_/g, " ") : label;
```

### 2.4 插值格式

当前插值由 `interpolateMessage` 处理，格式为 `{name}`：

```ts
// zh-CN
allLoaded: "已显示全部 {count} 张卡牌"

// use
 t("page.cards.allLoaded", { count: cards.length })
```

目前只支持简单 token 替换，不支持 ICU plural。英文复数需要通过文案规避，例如 `Showing all {count} cards`。

## 3. 字典组织规范

### 3.1 顶层分区

当前字典主要分为：

```ts
export const zhCNMessages = {
    common: { ... },   // 通用动作、状态、筛选、枚举、字段名
    layout: { ... },   // 导航、面包屑、Footer、分组页
    search: { ... },   // 命令面板等搜索功能
    page: { ... },     // 具体页面文案
} as const satisfies MessageTree;
```

### 3.2 common 适用范围

放入 `common` 的内容应满足至少一项：

- 多个页面复用。
- 枚举标签会被列表页和详情页同时使用。
- 字段名通用，例如 `name`、`type`、`rarity`、`description`。
- 状态通用，例如 `loading`、`noData`、`loadingFailed`。

常见路径：

```ts
common.action.close
common.state.loading
common.filter.all
common.field.name
common.exchange.statuses.active
common.honor.rarities.low
common.materialTypes.common
```

### 3.3 page 适用范围

只属于某个页面或路由的文案放在 `page.<module>`：

```ts
page.materials.badge
page.materials.filterPanelTitle.materials
page.exchanges.noDataDescription
page.honors.tabs.bonds
page.profile.dangerZone
```

### 3.4 命名建议

- 使用稳定语义，不使用 UI 位置命名。
  - 推荐：`page.exchanges.loadFailed`
  - 不推荐：`page.exchanges.redBoxText`
- 枚举按数据字段名组织。
  - 推荐：`common.exchange.rewardTypes.mysekai_material`
- 动态 tab 使用对象：

```ts
filterTitle: {
    normal: "称号筛选",
    bonds: "羁绊称号筛选",
}
```

调用：

```ts
t(`page.honors.filterTitle.${activeTab}`)
```

## 4. 迁移原则

### 4.1 什么应该迁移

必须迁移：

- 页面标题、描述、副标题、按钮、空态、错误提示。
- 筛选器 section label、placeholder、sort option label。
- badge / chip / status 文案。
- 弹窗标题、字段名、说明标题。
- `page.tsx` metadata 的固定中文标题和描述。
- 共享枚举标签，例如活动类型、称号类型、兑换所状态。

建议迁移：

- title / aria-label / alt 中的人类可读固定文案。
- tooltip 中的固定文案。
- 工具函数输出的资源 fallback 名称。

不迁移或谨慎迁移：

- masterdata 自带的名称、描述、剧情正文、活动名、歌曲名、卡牌名。
- 用户输入内容。
- API 返回的服务端错误原文，除非已有 error code 可映射。
- 搜索索引内部字段，除非这些字段直接显示给用户。

### 4.2 masterdata 文案边界

Project SEKAI masterdata 中的 `name`、`description`、`flavorText` 等属于游戏数据，不应无条件翻译。当前 i18n 只处理 UI 框架文案。若未来要支持 masterdata 多语言，应单独设计数据源与 fallback 规则。

### 4.3 工具层枚举处理

如果工具函数会被多个页面调用，推荐让它支持可选 `t` 参数：

```ts
export function getRewardTypeLabel(resourceType: string, t?: ExchangeTranslationFn): string {
    return translateLabel(REWARD_TYPE_LABEL_KEYS[resourceType], resourceType.replace(/_/g, " "), t);
}
```

页面侧调用：

```tsx
const { t } = useI18n();
<Badge label={getRewardTypeLabel(reward.resourceType, t)} />
```

这样可以避免工具层直接依赖 React context，也避免在工具层保留中文硬编码。

## 5. 已完成进度

> 注：这里记录的是已做过 i18n 迁移或已纳入字典的主要模块。仍建议每次提交前按第 8 节命令重新扫描目标文件。

### 5.1 基础设施

| 模块 | 状态 | 说明 |
|---|---:|---|
| `I18nContext` | 已完成 | 提供 `t`、`formatDate`、`formatNumber`、locale 切换与持久化 |
| `lib/i18n/format.ts` | 已完成 | 支持 key path 读取与 `{token}` 插值 |
| `lib/i18n/messages/zh-CN` | 进行中 | 已覆盖大量通用与页面文案 |
| `lib/i18n/messages/en-US` | 进行中 | 与中文结构同步维护 |
| `SettingsPanel` locale 切换 | 已完成 | UI 可切换语言 |

### 5.2 布局与共享组件

| 模块 | 状态 | 说明 |
|---|---:|---|
| `MainNavbar` / `Sidebar` | 已完成 | 导航项、分组名接入 i18n |
| `Breadcrumb` / `BreadcrumbGroupPage` | 已完成 | 面包屑与分组页文案接入 i18n |
| `MainFooter` | 已完成 | Footer 固定文案接入 i18n |
| `CommandPalette` | 已完成 | 命令面板基础文案接入 i18n |
| `BaseFilters` | 已完成 | 搜索、排序、重置、折叠等基础文案接入 i18n |
| 图片预览/复制下载共享组件 | 已完成 | `useSvgPreviewActions`、`useImageUrlActions`、`ImagePreviewModal` 固定中文文案已接入 `common.imageActions`，中文残留扫描与定向 ESLint 通过 |
| 共享弹窗/快捷筛选/分组页 | 已完成 | `Modal` 关闭按钮、`QuickFilterButton` aria-label 已接入 i18n；`BreadcrumbGroupPage` 已移除中文描述 fallback，改为完全依赖 `layout.groupPages` 字典，中文残留扫描与定向 ESLint 通过 |
| 全局错误页 | 已完成 | `app/error.tsx` 标题、描述、刷新/重试按钮已接入 `common.errorBoundary` / `common.action.retry`，中文残留扫描与定向 ESLint 通过 |
| 快捷筛选 Context / 卡牌筛选枚举 hooks | 已完成 | `QuickFilterContext` 默认标题改为 `common.filter.title`；`useCardSupplyTypeMapping` / `useSkillMapping` 改为仅返回稳定枚举 id，显示文案由现有 `common.cardSupplyTypes` / `common.skillTypes` 字典负责，中文残留扫描与定向 ESLint 通过 |
| 账号相关组件 | 已完成/进行中 | `AccountSelector`、`AccountSelectorBar`、`QuickBindForm` 等已大量接入 |

### 5.3 数据库/活动类页面

| 路由 | 状态 | 说明 |
|---|---:|---|
| `/cards` | 已完成 | 列表、筛选、卡片基础文案、详情页（`/cards/[id]`）均已完全迁移至新 i18n 字典，支持卡池/活动关联与服装展示 |
| `/events` 与 `/events/[id]` | 已完成 | 列表、筛选、活动状态已迁移；详情页（含 EventBgmPlayer）已完全迁移 |
| `/gacha` 与 `/gacha/[id]` | 已完成 | 列表、筛选、扭蛋状态等已迁移；详情页完全迁移（包含基本信息、概率、模拟器、自选 Wish 机制与 404 反馈） |
| `/music` 与 `/music/[id]` | 已完成 | 列表基础文案、详情页 404、详情页基础信息/封面预览/META 排行/难度区/演唱版本/相关活动/返回按钮均已迁移；音乐详情页中文残留扫描与定向 ESLint 通过，复杂 metadata 仍需确认 |
| `/live` 与 `/live/[id]` | 已完成 | 列表与详情页（包含演出时间表、节目单、相关活动和 metadata）已全部迁移 |
| `/materials` | 已完成 | 列表、筛选、详情弹窗、metadata 已迁移 |
| `/exchanges` | 已完成 | 列表、筛选、metadata 已迁移 |
| `/exchanges/[id]` | 已完成 | 详情页、字段、奖励/成本区、metadata 已迁移 |
| `/honors` | 已完成 | 普通称号/羁绊称号列表、筛选、详情弹窗、metadata 已迁移 |
| `/mysekai` 与 `/mysekai/[id]` | 已完成 | 列表页、筛选器、详情页字段/状态、genre/tag 显示名、metadata 与 404 反馈已迁移 |
| `/story/**` | 已完成/待构建 | 剧情总入口、主线剧情、活动剧情、卡牌剧情、区域对话、自我介绍与特殊剧情列表/详情/阅读页 metadata 与固定 UI 文案已接入 `page.story`；共享 `StoryPageHeader`、`StoryReader`、`StorySnippet` 已迁移；story 目标范围中文残留扫描与定向 ESLint 通过，待后续统一 Next 构建确认 |
| `/character` 与 `/character/[id]` | 已完成 | 列表页、详情页、metadata 与详情页广告标题已迁移 |
| `/costumes` 与 `/costumes/[id]` | 已完成 | 列表页、筛选器（CostumeFilters）、详情页、metadata 与共享枚举（partTypes/sources/rarities/genders）已迁移 |
| `/sticker` | 已完成 | 列表页、筛选、预览弹窗、metadata 已迁移 |
| `/comic` | 已完成 | 列表页、筛选、预览弹窗、metadata 已迁移 |
| `/manga` 与 `/manga/[id]` | 已完成 | 列表页、详情页、上下话跳转、贡献者/来源信息、metadata 已迁移 |

### 5.4 个人页/工具页

| 路由 | 状态 | 说明 |
|---|---:|---|
| `/profile` | 已完成 | 账号管理、危险操作、快捷入口等已迁移；metadata 已改为英文兜底并接入 `getPageKeywords("profile")`；`client.tsx` 调试日志/注释中文残留已清理 |
| `/deck-recommend` | 已完成 | 主页面、metadata、Event/Music 选择器、结果区、校验错误与 worker 进度文案已迁移；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/deck-comparator` | 已完成 | 主页面、metadata、结果区、历史记录、校验错误与 calculator 工具错误/注释已迁移；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/score-control` | 已完成 | 主页面、metadata、控分组卡、无限查找、结果区、错误提示、calculator 与 deck-builder worker 注释已迁移；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/sticker-maker` | 已完成 | metadata 已改为英文兜底；主 UI、控件、空态、上传/复制下载提示、license 声明已接入 `page.stickerMaker` 字典；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/goods-gacha` | 已完成 | metadata 已改为英文兜底；主 UI、卡池选择、抽选按钮、统计、重置确认、空态、图片 alt 与免责声明已接入 `page.goodsGacha` 字典；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/guess-who` 与 `/guess-who/multiplayer` | 已完成 | metadata 已改为英文兜底；单人页设置/对战/结算、联机大厅/房间/加载/对战反馈/结算/错误提示已接入 `page.guessWho` 字典；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/guess-jacket` 与 `/guess-jacket/multiplayer` | 已完成 | metadata 已改为英文兜底；单人页设置/对战/结算、联机大厅/房间/加载/对战反馈/结算/错误提示已接入 `page.guessJacket` 字典；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/chart-preview` | 已完成 | metadata 已改为英文兜底；页面头部、模式切换、歌曲/URL 表单、预览页按钮、播放器加载状态、音频提示、控制栏、iOS 提示与 credits 文案已接入 `page.chartPreview` 字典；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/mysekai-preview`、`/mysekai-preview/ranking`、`/mysekai-preview/scene` | 已完成 | 已新增 `page.mysekaiPreview` 中英字典；列表/排行详情/UID+JSON 入口页、metadata、共享 `MysekaiScenePreview` 控制面板与 `lib/mysekai-preview/runtime.ts` 浮层/状态/错误文案已迁移；中文残留扫描、定向 ESLint 与 Next 构建均通过 |
| `/my-cards` | 已完成/进行中 | 主流程和空态已迁移；metadata 已改为英文兜底并接入 `getPageKeywords("my_cards")`；仍建议后续扫详情/分享功能 |
| `/my-musics` | 已完成/进行中 | 主流程和部分分享功能已迁移；metadata 已改为英文兜底并接入 `getPageKeywords("my_musics")`；`client.tsx` 数据源/排序注释中文残留已清理；仍建议后续扫图像生成文案 |
| `/my-materials` | 已完成/进行中 | 资源查询主体已迁移；metadata 已改为英文兜底并接入 `getPageKeywords("my_materials")` |

## 6. 高风险/待推进区域

### 6.1 动态详情页

动态详情页通常比列表页复杂，原因：

- 字段多，且字段 label 容易散落在 JSX 内。
- 同时显示 masterdata 原文与 UI 文案，边界容易混淆。
- 详情页常有 metadata、OpenGraph、Twitter 文案。
- 有些详情页有图片下载、SVG 预览、分享、相关条目等额外功能。

建议优先级：

1. story 相关动态路由（已完成本轮目标范围：`/story` 入口、`/story/unit/**`、`/story/event/**`、`/story/card/**`、`/story/area/**`、`/story/self/**`、`/story/special/**`；后续建议统一跑 Next 构建）
2. 个人页详情/分享生成相关动态逻辑
3. 其他新增长尾详情页

已完成的核心动态详情页包括 `/cards/[id]`、`/events/[id]`、`/gacha/[id]`、`/music/[id]`、`/live/[id]`、`/costumes/[id]`、`/manga/[id]`、`/mysekai/[id]`。

### 6.2 复杂工具页

复杂工具页有大量表单、状态机、错误提示和结果展示，迁移前建议先读一遍业务逻辑：

- `/mysekai-preview/scene`（已完成：页面、metadata、共享 3D 预览组件与 runtime 均已迁移）

### 6.3 图片/分享生成逻辑

例如 Best30 分享图片、进度图、截图模式等，文案可能在 canvas/SVG 绘制逻辑中，不会被普通 JSX 搜索完全覆盖。需要特别检查：

- 文本绘制函数。
- 分享图 footer/source 文案。
- 下载/复制按钮状态。
- 生成进度状态文案。

## 7. 推荐迁移流程

每次迁移一个页面或一个小模块，按以下步骤执行。

### Step 1：定位硬编码中文

```bash
# 单文件
npm run lint --prefix web -- src/app/materials/client.tsx

# 中文残留扫描：推荐使用 ripgrep / Grep 工具
rg -n "[\p{Han}]" web/src/app/<route> web/src/components/<related>
```

在 NarraFork/Claude 环境中优先用 `Grep` 工具，不要用 shell `grep`。

### Step 2：判断文案归属

- 多处复用：放入 `common`。
- 仅页面使用：放入 `page.<route>`。
- 导航/布局：放入 `layout`。
- 搜索命令面板：放入 `search`。

### Step 3：同步中英字典

必须同时修改：

```text
web/src/lib/i18n/messages/zh-CN/index.ts
web/src/lib/i18n/messages/en-US/index.ts
```

如果 key 缺失，`t()` 会返回 key 字符串，页面会出现 `page.xxx.yyy`。

### Step 4：替换组件文案

客户端组件：

```tsx
const { t } = useI18n();
```

日期/数字：

```tsx
const { formatDate, formatNumber } = useI18n();
```

枚举：

```tsx
getExchangeStatusLabel(status, t)
getRewardTypeLabel(type, t)
```

### Step 5：保留 masterdata 原文

例如：

```tsx
// 保留游戏数据原文
<h1>{card.prefix}</h1>
<p>{event.name}</p>
<p>{material.flavorText}</p>

// 只翻译 UI 标签
<InfoRow label={t("common.field.name")} value={card.prefix} />
```

### Step 6：扫残留、lint、build

见第 8 节。

## 8. 校验命令

### 8.1 中文残留扫描

示例：

```bash
rg -n "[\p{Han}]" web/src/app/materials web/src/app/exchanges web/src/app/honors web/src/components/honor web/src/lib/exchanges.ts web/src/types/honor.ts
```

注意：扫描到中文不一定都是错误，例如：

- 中文 locale 字典本身。
- 中文 README / 文档。
- masterdata fixture 或测试数据。
- 合法中文搜索 alias。

目标是目标页面/组件中不再有固定 UI 中文硬编码。

### 8.2 定向 lint

当前 ESLint 使用 flat config，不支持旧的 `--file` 参数。应使用路径参数：

```bash
npm run lint --prefix web -- \
  src/app/materials/client.tsx \
  src/app/exchanges/client.tsx \
  src/app/exchanges/[id]/client.tsx \
  src/app/honors/client.tsx
```

### 8.3 Next 构建

```bash
npm run build:next --prefix web
```

已知构建输出中可能出现：

```text
⚠ turbopack.root should be absolute
```

本次迁移中该警告不影响构建通过。

## 9. 最近一批已验证结果

最近一批推进的范围：

```text
web/src/contexts/QuickFilterContext.tsx
web/src/hooks/useCardSupplyType.ts
web/src/hooks/useSkillMapping.ts
web/src/app/music/[id]/client.tsx
web/src/lib/i18n/messages/zh-CN/index.ts (补充 page.music 详情页文案)
web/src/lib/i18n/messages/en-US/index.ts (补充 page.music 详情页文案)
```

阶段进度：

- 已将 `QuickFilterContext` 默认标题接入 `common.filter.title`，避免 Context 内残留中文 fallback。
- 已将 `useCardSupplyTypeMapping` / `useSkillMapping` 改为仅返回稳定枚举 id，卡牌筛选显示继续由 `common.cardSupplyTypes` / `common.skillTypes` 字典负责。
- 已补充 `page.music` 中英详情页字典，覆盖封面预览标题、点击放大、基础信息字段、解锁条件、META 排行 tab、难度详情、社区定数提示、谱面预览按钮、演唱版本、下载音频、相关活动与返回按钮。
- 已将 `/music/[id]` 详情页日期/数字格式化改为 `formatDate` / `formatNumber`，音乐 tag / category 显示改为读取现有 `common.musicTags` / `common.musicCategories` 字典。
- 中文残留扫描：通过（`web/src/app/music/[id]/client.tsx`、`web/src/contexts/QuickFilterContext.tsx`、`web/src/hooks/useCardSupplyType.ts`、`web/src/hooks/useSkillMapping.ts` 已无中文硬编码残留）。
- 定向 ESLint：通过（`npm run lint --prefix web -- src/app/music/[id]/client.tsx src/contexts/QuickFilterContext.tsx src/hooks/useCardSupplyType.ts src/hooks/useSkillMapping.ts src/lib/i18n/messages/zh-CN/index.ts src/lib/i18n/messages/en-US/index.ts`）。

## 10. 协作注意事项

### 10.1 避免大 PR 混杂

i18n 迁移很容易产生大量 diff。建议按模块拆 PR：

- 一个数据库页 + 相关详情页。
- 一个工具页。
- 一组共享组件。
- 一组枚举工具函数。

### 10.2 不要一次性改所有字典结构

字典已经较大。重构字典结构会造成大量冲突。建议：

- 先补 key，后续再整理。
- 保持 `zh-CN` 与 `en-US` 结构一致。
- 不要删除旧 key，除非已全局确认无引用。

### 10.3 小心工具函数中的 React Hook

不要在普通工具函数里调用 `useI18n()`。工具函数应接受可选 `t`：

```ts
export function getSomethingLabel(value: string, t?: TranslationFn): string
```

React 组件内再传入：

```tsx
const { t } = useI18n();
getSomethingLabel(value, t);
```

### 10.4 小心 `useMemo` / `useEffect` 依赖

如果在 `useMemo` 或 `useEffect` 中使用了 `t`、`formatDate`，依赖数组必须包含它们：

```tsx
const options = useMemo(() => buildOptions(t), [t]);

useEffect(() => {
    setError(t("page.xxx.loadFailed"));
}, [t]);
```

### 10.5 metadata 的限制

`page.tsx` metadata 是 server side/static 代码，当前不能直接用 `useI18n()`。现阶段策略：

- 固定 metadata 先使用英文兜底，避免中文硬编码残留。
- 如果未来需要 SEO 多语言，应单独设计 metadata locale 解析方案。

## 11. 后续 TODO 建议

### P0：继续完成核心动态详情页

- [x] `/cards/[id]`
- [x] `/events/[id]`
- [x] `/gacha/[id]`
- [x] `/music/[id]`（404 已标准化，复杂 metadata 仍待确认）
- [x] `/live/[id]`

### P1：完成数据库补充页

- [x] `/character` 与 `/character/[id]`
- [x] `/costumes` 与 `/costumes/[id]`
- [x] `/sticker`
- [x] `/comic`
- [x] `/manga` 与 `/manga/[id]`
- [x] `/mysekai` 与 `/mysekai/[id]`

### P2：复杂工具页

- [x] `/deck-recommend`
- [x] `/deck-comparator`
- [x] `/score-control`
- [x] `/sticker-maker`
- [x] `/goods-gacha`
- [x] `/guess-who`
- [x] `/guess-jacket`
- [x] `/chart-preview`
- [x] `/mysekai-preview`（含 `/ranking` 与 `/scene`）

### P3：自动化保障

- [ ] 增加脚本检查 `zh-CN` 与 `en-US` key 结构是否一致。
- [ ] 增加目标目录中文硬编码扫描脚本。
- [ ] 增加 `t("...")` key 是否存在的静态检查。
- [ ] 评估是否需要 ICU message / plural 支持。
- [ ] 评估是否需要服务端 metadata i18n。

## 12. 快速参考

### 新增页面 key 模板

```ts
page: {
    example: {
        badge: "Example Database",
        title: "Example",
        titleHighlight: "Database",
        description: "Browse examples",
        filterTitle: "Example Filters",
        searchPlaceholder: "Search example name or ID...",
        countUnit: "items",
        loadFailed: "Failed to load example data",
        noResult: "No examples match the current filters",
        loadMore: "Load More",
        allLoaded: "Showing all {count} examples",
        loadingFallback: "Loading examples...",
    },
}
```

### 页面 header 模板

```tsx
function PageHeader() {
    const { t } = useI18n();

    return (
        <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                <span className="text-miku text-xs font-bold tracking-widest uppercase">
                    {t("page.example.badge")}
                </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                {t("page.example.title")} <span className="text-miku">{t("page.example.titleHighlight")}</span>
            </h1>
            <p className="text-slate-500 mt-2 max-w-2xl mx-auto text-sm">
                {t("page.example.description")}
            </p>
        </div>
    );
}
```

### 枚举 label helper 模板

```ts
type TranslationFn = ReturnType<typeof useI18n>["t"];

function formatFallbackLabel(value: string): string {
    return value.replace(/_/g, " ");
}

function getExampleTypeLabel(type: string, t: TranslationFn): string {
    const key = `common.example.types.${type}`;
    const label = t(key);
    return label === key ? formatFallbackLabel(type) : label;
}
```

---

这份文档应随着每一批 i18n 迁移持续更新。尤其是“已完成进度”和“待推进区域”，需要在每次完成一个路由后同步维护。
