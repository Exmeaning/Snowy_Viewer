# Moesekai i18n 迁移进度与协作技术文档

> 更新时间：2026-05-20  
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
| 账号相关组件 | 已完成/进行中 | `AccountSelector`、`AccountSelectorBar`、`QuickBindForm` 等已大量接入 |

### 5.3 数据库/活动类页面

| 路由 | 状态 | 说明 |
|---|---:|---|
| `/cards` | 已完成表层 | 列表、筛选、卡片基础文案已迁移；详情仍需单独确认 |
| `/events` | 已完成表层 | 列表、筛选、活动状态等已迁移；详情仍需单独确认 |
| `/gacha` | 已完成表层 | 列表、筛选、扭蛋状态等已迁移；详情仍需单独确认 |
| `/music` | 已完成表层 | 列表基础文案已迁移；详情与复杂 metadata 仍需确认 |
| `/live` | 已完成表层 | 列表基础文案已迁移；详情仍需确认 |
| `/materials` | 已完成 | 列表、筛选、详情弹窗、metadata 已迁移 |
| `/exchanges` | 已完成 | 列表、筛选、metadata 已迁移 |
| `/exchanges/[id]` | 已完成 | 详情页、字段、奖励/成本区、metadata 已迁移 |
| `/honors` | 已完成 | 普通称号/羁绊称号列表、筛选、详情弹窗、metadata 已迁移 |

### 5.4 个人页/工具页

| 路由 | 状态 | 说明 |
|---|---:|---|
| `/profile` | 已完成 | 账号管理、危险操作、快捷入口等已迁移 |
| `/my-cards` | 已完成/进行中 | 主流程和空态已迁移，仍建议后续扫详情/分享功能 |
| `/my-musics` | 已完成/进行中 | 主流程和部分分享功能已迁移，仍建议后续扫图像生成文案 |
| `/my-materials` | 已完成/进行中 | 资源查询主体已迁移 |

## 6. 高风险/待推进区域

### 6.1 动态详情页

动态详情页通常比列表页复杂，原因：

- 字段多，且字段 label 容易散落在 JSX 内。
- 同时显示 masterdata 原文与 UI 文案，边界容易混淆。
- 详情页常有 metadata、OpenGraph、Twitter 文案。
- 有些详情页有图片下载、SVG 预览、分享、相关条目等额外功能。

建议优先级：

1. `/cards/[id]`
2. `/events/[id]`
3. `/gacha/[id]`
4. `/music/[id]`
5. `/live/[id]`
6. `/costumes/[id]`
7. `/mysekai/[id]`
8. story 相关动态路由

### 6.2 复杂工具页

复杂工具页有大量表单、状态机、错误提示和结果展示，迁移前建议先读一遍业务逻辑：

- `/deck-recommend`
- `/deck-comparator`
- `/score-control`
- `/sticker-maker`
- `/goods-gacha`
- `/guess-who`
- `/guess-jacket`
- `/chart-preview`
- `/mysekai-preview/scene`

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

最近一次完成迁移并验证的范围：

```text
web/src/app/materials/client.tsx
web/src/app/materials/page.tsx
web/src/app/exchanges/client.tsx
web/src/app/exchanges/page.tsx
web/src/app/exchanges/[id]/client.tsx
web/src/app/exchanges/[id]/page.tsx
web/src/app/honors/client.tsx
web/src/app/honors/page.tsx
web/src/components/honor/HonorFilters.tsx
web/src/components/honor/HonorDetailDialog.tsx
web/src/components/honor/BondsHonorDetailDialog.tsx
web/src/lib/exchanges.ts
web/src/types/honor.ts
```

验证结果：

- 中文残留扫描：通过。
- 定向 ESLint：通过。
- `npm run build:next --prefix web`：通过。

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

- [ ] `/cards/[id]`
- [ ] `/events/[id]`
- [ ] `/gacha/[id]`
- [ ] `/music/[id]`
- [ ] `/live/[id]`

### P1：完成数据库补充页

- [ ] `/character` 与 `/character/[id]`
- [ ] `/costumes` 与 `/costumes/[id]`
- [ ] `/sticker`
- [ ] `/comic`
- [ ] `/manga`
- [ ] `/mysekai` 与 `/mysekai/[id]`

### P2：复杂工具页

- [ ] `/deck-recommend`
- [ ] `/deck-comparator`
- [ ] `/score-control`
- [ ] `/sticker-maker`
- [ ] `/goods-gacha`
- [ ] `/guess-who`
- [ ] `/guess-jacket`
- [ ] `/chart-preview`

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
