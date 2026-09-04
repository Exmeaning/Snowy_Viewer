# 全站详情页静态化与 SEO 增强技术架构方案 (Detail Pages Static & SEO Architecture)

> **目标**：将网站内所有实体详情页（以 `/cards/:id` 为先导，后续推广至音乐、活动、扭蛋、角色、服装等）升级为**完全静态化预渲染**，外界列表页维持高效 CSR，实现极速首屏（<1ms 直出）、长尾关键词全覆盖与极致 SEO 表现，同时通过**“跨版本持久缓存”**与**“闲时抢占式预热引擎”**彻底杜绝爬虫风暴打穿服务器。

---

## 1. 核心价值与背景分析

### 1.1 现状痛点
- **Body 内容为空**：目前各详情页采用 `define<Kind>DetailClientPage`，由于是客户端组件（`"use client"`），在服务端 SSR 阶段初始状态为 `isLoading: true`，实际输出给爬虫的 HTML `<body>` 只有一个 `<div class="loading-spinner"></div>`。
- **搜索引擎索引受限**：虽然 `<head>` 拥有 Meta 标签与 JSON-LD，但百度、Bing、各类社交分享爬虫（Discord、Twitter/X）不执行 JS；Googlebot 属于两阶段渲染，在沙盒中拉取 10MB+ 的 Masterdata JSON 极易发生超时与丢包，导致关键长尾词（技能名、数值白值、作词作曲、加成属性等）无法被高效索引。

### 1.2 核心业务事实：Masterdata 不可变性（Immutability）
- **只增不减（Append-only）**：PJSK 官方数据为静态 Masterdata，历史发布的卡牌、歌曲、活动一旦定型，其基础属性永远不会变动。
- **版本强绑定**：数据变更仅在官方推新活动/新卡池时触发，项目已具备 [`.github/workflows/watch-master-data.yml`](../.github/workflows/watch-master-data.yml) 自动监听版本号并在更新时触发 CI/CD 部署。

---

## 2. 总体技术架构：双车道调度与持久化静态闭环

```mermaid
flowchart TD
    subgraph Gateway["Go 网关层 (main.go & internal/htmlcache)"]
        Req[外部请求: 真实用户 / 搜索引擎爬虫] --> CheckCache{Go 磁盘缓存是否命中?}
        CheckCache -- HIT (<1ms) --> RetCached[直接返回本地静态 HTML]
        CheckCache -- MISS --> MarkExtActive[原子计数: activeExternalRequests++]
        MarkExtActive --> HiPriBuild[高优直通车道: 立即调用 Next.js SSR 渲染]
        HiPriBuild --> SaveDisk[持久化存入磁盘缓存]
        SaveDisk --> DecExtActive[原子计数: activeExternalRequests--]
        DecExtActive --> RetLive[返回给客户端]
    end

    subgraph IdleWarmup["闲时后台预构建车道 (internal/htmlcache/warmup.go)"]
        Start[服务器就绪 / 自动部署上线] --> ScanDiff[读取 Sitemap: 仅找出未被缓存的页面]
        ScanDiff --> Loop[取出待预热 URL]
        Loop --> YieldCheck{是否有外部请求? activeExternalRequests > 0}
        YieldCheck -- 外部有流量 --> Backoff[立即避让挂起 200~300ms]
        Backoff --> YieldCheck
        YieldCheck -- 闲时完全无请求 --> LowPriBuild[受控节流调用 Next.js 预渲染 (单并发)]
        LowPriBuild --> SaveWarm[写入持久化磁盘缓存]
        SaveWarm --> Sleep[强制冷却 80ms (平滑 CPU)]
        Sleep --> Loop
    end
```

### 2.1 存量缓存免清空：跨版本持久化（Persistent Cache）
- **历史静态 Chunk 保护**：系统已在 [`scripts/start-container.sh`](../scripts/start-container.sh#L49-L67) 中实现了 `STATIC_ARCHIVE_DIR`，新构建发布时老版本的 `_next/static` chunks 会被自动归档并保留 30 天，由 Go 网关自动提供回退服务。
- **缓存目录持久化**：HTML 缓存固定存放在 `/app/data/html_cache` 持久卷中，容器重启或重新发布时不再清空该目录。已有上千张老卡在发布后**零重算、终身直接命中磁盘**。

### 2.2 闲时抢占式轮番预构建（Priority-Preemptive Warmup Engine）
- **外部请求绝对高优（High-Priority Preemption）**：
  - 用户或外部爬虫请求到达时，享有最高 CPU 优先级。
  - Go 原生的 `SingleFlight`（并发合并）自动拦截同一 URL 的并发击穿，50 个并发抓取合并为 1 次渲染。
- **闲时平滑默默预热（Low-Priority Pacing）**：
  - 后台 Goroutine 仅在 `activeExternalRequests == 0` 的闲时启动。
  - 单线程并发 + 每次渲染强制休眠 80ms，将服务器 CPU 占用平稳压制在 5%~10%。
  - 只要检测到有外部请求进入，后台任务**立刻自旋让步避让**，把 100% 算力留给真实请求。

### 2.3 前端渲染架构：Server Component Shell + Client Island
- **服务端（Server Component）**：以默认最佳状态输出语义化 HTML（大图 `<img>` 带完整 `alt`、白值属性表格、技能文字说明、关联活动/扭蛋/角色内链 `<a href="...">`）。
- **客户端（Client Island）**：组件水合（Hydration）后无缝激活富交互（特训前后立绘切换、数值滑动条实时计算、3D 试穿、全屏灯箱）。

---

## 3. 落地实施路线（以 `/cards/[id]` 为标杆先导）

### Phase 1: 卡牌详情服务端语义渲染改造
1. **扩展构建期轻量元数据**：
   - 在 [`web/scripts/generate-metadata-map.mjs`](../web/scripts/generate-metadata-map.mjs) 中补充卡牌的【满级三值与综合力、技能名、技能描述模板、关联活动/卡池 ID】。
   - 在 [`web/src/lib/metadata.ts`](../web/src/lib/metadata.ts) 扩展 `CardMeta`，实现 Node.js 服务端微秒级从内存直接读取，零网络请求。
2. **新建卡牌服务端语义组件**：
   - 创建 `CardDetailServerShell.tsx`，在首屏直接渲染结构化 HTML，代替原本的 loading spinner。
3. **改造客户端交互岛**：
   - 保持 [`web/src/app/cards/[id]/client.tsx`](../web/src/app/cards/%5Bid%5D/client.tsx) 的所有动态交互，首屏接收服务端预注入数据，消除白屏等待。

### Phase 2: Go 端缓存持久化与闲时预热引擎
1. **持久化改造**：
   - 调整 [`internal/htmlcache/htmlcache.go`](../internal/htmlcache/htmlcache.go)，启动时保留现有缓存目录并加载已有条目。
2. **构建预热引擎**：
   - 新增 `internal/htmlcache/warmup.go`，实现 `activeExternalRequests` 流量感知与闲时预热 Goroutine。
3. **缓存周期调整**：
   - [`web/src/lib/page-cache-policy.ts`](../web/src/lib/page-cache-policy.ts) 中的 `DETAIL_ORIGIN_MAX_AGE_SECONDS` 上调为长周期（如 180 天），与版本生命周期对齐。

---

## 4. 全站其他详情页迁移蓝图 (Multi-Page Migration Roadmap)

标杆落地并验证稳定后，其余 10 类详情页均可按照统一范式进行标准化平移：

| 模块路由 | 页面类型 | 服务端静态化语义核心（SEO 高价值内容） | 客户端交互岛保留（Client Island） |
|---|---|---|---|
| **`/cards/[id]`** | 卡牌详情 | 立绘大图、满级白值表格、技能全文本、角色与活动内链 | 特训前后立绘切换、等级滑块计算、3D 服装预览 |
| **`/music/[id]`** | 歌曲详情 | 封面大图、作词/作曲/编曲、各难度物量与等级表、关联活动 | 音频试听播放器、谱面预览切换、3D MV 查看器 |
| **`/events/[id]`** | 活动详情 | 横幅大图、活动类型、加成属性/角色、排名奖励、关联卡牌 | 活动倒计时、实时积分榜单、卡组加成计算器 |
| **`/gacha/[id]`** | 扭蛋详情 | 卡池 Logo/横幅、UP 卡牌清单、抽取规则、关联活动 | 模拟抽卡交互、天井兑换清单 |
| **`/costumes/[id]`** | 服装详情 | 服装名称、所属角色、获取方式、部件分类说明 | 3D 模型渲染器、染色切换、部件穿戴模拟 |
| **`/character/[id]`** | 角色详情 | 角色立绘、个人档案（生日/身高/性格）、所属乐团、代表曲目 | 语音试听、角色羁绊等级计算器、卡牌图鉴筛选 |
| **`/exchanges/[id]`** | 兑换所详情 | 兑换所分类、可兑换道具清单、所需代币、开启时间 | 道具兑换数量计算器、库存状态 |
| **`/live/[id]`** | Virtual Live | 演出海报、登场角色、曲目列表、场次时间表 | 场次提醒订阅、动作预览 |
| **`/manga/[id]`** | 漫画/四格 | 漫画正文图片（带 `alt`）、期数标题、登场角色关联 | 翻页阅读器、全屏放大、多语言译文切换 |
| **`/mysekai/[id]`** | 家具/设施 | 家具缩略图、分类、摆放限制、制作材料清单 | 3D 家具预览、制作资源计算器 |
| **`/guides/[id]`** | 攻略文章 | 完整 Markdown 文章正文、目录结构、作者、发布时间 | 评论区互动、目录滚动高亮、代码/图片交互 |

---

## 5. 区服独占与跨服冲突治理规范 (Regional Exclusivity & Server Conflict Protocol)

### 5.1 业务认知：为什么只有卡牌是简单的单向追赶？
在卡牌模块（`/cards/:id`）的改造中，日服（JP）是官方绝对的单一内容策源地，所有新卡牌均首发于日服，其他海外服（CN/TW/EN/KR）仅做单向线性追赶与翻译，**不存在任何外服独占卡牌**。因此卡牌可以简单通过日服回退（`isJpFallback`）+ `[日服先行]` 徽章实现 100% 静态 SSR 覆盖。

**然而，在卡牌之外的其他几乎所有实体中，均多多少少存在区服独占、联动定制或 ID 碰撞现象：**
- **音乐 (`/music/:id`)**：全服共 765 首乐曲，日服收录 714 首。另外 **51 首歌曲完全不存在于日服**：
  - 美服独占（EN Exclusives）：如 ID 479 (*MikuFiesta*), 514, 528, 535, 563 等 19 首。
  - 全球服共有（EN/TW/KR）：如 ID 371 (*sweety glitch*), 419, 453, 459, 694 等 5 首。
  - 国服独占（CN Exclusives）：如 ID 11001 (*Pick Me Up*), 11002~11017 等 17 首。
  - 韩服独占（KR Exclusives）：如 ID 10001 (*장산범*), 10002~10010 等 10 首。
  - *特别风险*：国服（11001+）与韩服（10001+）采用独立号段，但美服独占占用了常规三位数 ID（如 479、514、563 等），未来日服若实装同号主线曲将发生直接 ID 冲突。
- **活动 (`/events/:id`) 与 扭蛋 (`/gacha/:id`)**：外服拥有专属周年庆典、本土化限定联动活动与特权卡池（如海外服定制卡池），活动 ID 在不同服之间非一一对应映射。
- **服装 (`/costumes/:id`)**：不同服的大赛优胜服装、线下展会特典可能在特定区服先行实装或独占。
- **Virtual Live (`/live/:id`)**：各区服的跨年/周年演唱会时间轴与场次安排存在明显排期割裂。

---

### 5.2 核心处置金律 (The Golden Rule)

为了避免将某一特定服务器的独占数据错误持久化为跨端公用的静态 HTML 缓存，系统确立以下治理准则：

```mermaid
flowchart LR
    Entity[详情页实体 ID] --> Decide{是否属于主线共有集合?}
    Decide -- "是 (如 714 首主线曲)" --> DoSSR["走静态 SSR 预渲染<br/>• initialData = 完整元数据<br/>• 写入 180 天持久缓存<br/>• 首屏直出大图与结构化 HTML"]
    Decide -- "否 (如 51 首独占/冲突曲)" --> BypassSSR["坚决不走 SSR (Bypass)<br/>• initialData = null<br/>• 输出干净 Loading 骨架<br/>• 绝不缓存到磁盘"]
    BypassSSR --> ClientCSR["交给客户端动态探测 (CSR)<br/>• 玩家无论选什么服均不报错<br/>• 自动跨服嗅探 (Multi-Server Fallback)<br/>• 渲染 [美服独占] / [国服独占] 徽章"]
```

1. **主线共性内容（Canonical Master Pool）走 SSR**：
   - 包含于日服主线基准池、且跨服语义一致的实体（占 90%+ 绝对主流）。
   - 服务端 `get<Kind>Meta` 注入 `initialData`，输出结构化语义 HTML 与 `sr-only` 的 `DetailSeoSummary`。
   - 写入持久化磁盘缓存，享受 180 天秒开与长尾关键词索引。
2. **区服独占 / 潜在冲突内容坚决不走 SSR**：
   - 服务端 `get<Kind>Meta` 严格返回 `null`，向客户端注入 `initialData: null`。
   - **绝不使用静态缓存固化独占内容**。因为服务端无法知晓访问者在客户端的 `serverSource` 偏好（例如中文语言玩家可能主玩日服，或专门点击外链查看美服独占曲）。
   - 动态 `generateMetadata` 返回 `robots: noindex, follow`，保护全站权重免受孤岛/冲突数据干扰。
3. **客户端具备智能多服兜底引擎 (Multi-Server Fallback Engine)**：
   - 客户端优先从当前用户设置的 `serverSource` 拉取 Masterdata；
   - 若未找到该 ID，**绝不直接抛出 NotFound 崩溃**，而是按号段特征自动轮询候选区服（EN / TW / KR / CN / JP）；
   - 探测成功后无缝渲染，并在 UI 上自适应标注来源徽章：`[日服先行]`（amber）、`[美服独占]` / `[国服独占]` / `[韩服独占]` / `[台服独占]`（purple）。

---

## 6. 全站各详情页迁移进度与任务跟踪 (Progress & Checklist)

> **开发规范**：每次完成一个模块的代码改造与自动化验证后，必须及时在此处勾选 `[x]` 并更新完成日期。

| 模块路由 | 页面类型 | 区服独占/冲突考量 | 改造状态 | 完成日期 |
|---|---|---|:---:|:---:|
| **`/cards/[id]`** | 卡牌详情 | 纯日服超集，无独占冲突；支持 `[日服先行]` | **[x] 已完成** | 2026-09-04 |
| **`/music/[id]`** | 歌曲详情 | 存在 51 首区服独占曲；共性曲 SSR，独占曲 CSR 智能探测 | **[x] 已完成** | 2026-09-04 |
| **`/events/[id]`** | 活动详情 | 存在海外服独占联动与独立排期 | **[ ] 待迁移** | - |
| **`/gacha/[id]`** | 扭蛋详情 | 存在外服定制卡池与抽卡规则差异 | **[ ] 待迁移** | - |
| **`/costumes/[id]`** | 服装详情 | 存在设计大赛独占与各服实装差异 | **[ ] 待迁移** | - |
| **`/character/[id]`** | 角色详情 | 角色基础信息全服共有，档案按各服本地化呈现 | **[ ] 待迁移** | - |
| **`/exchanges/[id]`** | 兑换所详情 | 各服兑换道具库存与时效存在差异 | **[ ] 待迁移** | - |
| **`/live/[id]`** | Virtual Live | 各服演出场次时间表存在时区与排期差异 | **[ ] 待迁移** | - |
| **`/manga/[id]`** | 漫画/四格 | 各服官方翻译进度不同，台服/美服有不同进度 | **[ ] 待迁移** | - |
| **`/mysekai/[id]`** | 家具/设施 | 日服先行实装较多，家具属性相对固定 | **[ ] 待迁移** | - |
| **`/lyrics/[musicId]`** | 歌词详情 | 与 `/music/[id]` 联动，独占曲按相同分流策略 | **[ ] 待迁移** | - |
| **`/guides/[id]`** | 攻略文章 | 站内内容，无 Masterdata 区服冲突 | **[ ] 待迁移** | - |

---

## 7. SEO 描述文本与视觉隔离规范 (`DetailSeoSummary`)

### 7.1 痛点与历史成因
在旧版纯 CSR 时代，Next.js 服务端直出的 `<body>` 只有 `<div class="loading-spinner"></div>`。为了避免爬虫收到空页面，各详情页通过 `DetailSeoSummary` 组件在底部硬编码注入了一段模板文字（例如：`查看 MEIKO 的 Project SEKAI 卡牌「酔いどれ知らず」，包含卡牌稀有度、属性、技能、数值与高清卡面资源。 | PJSK WIKI`）。
但该组件此前被渲染为一个带有背景色、边框与阴影的独立卡片（`rounded-2xl border bg-white/55 shadow-sm`），在页面交互完成后显得格外机械化与突兀。

### 7.2 规范与改造策略
- **爬虫与屏幕阅读器保留**: 保留 `<aside aria-label={title}><p>{description}</p></aside>` 语义树结构，以便搜索引擎蜘蛛（Googlebot、Bing 等）和无障碍设备提取内容。
- **视觉完全隐藏 (`sr-only`)**: 组件使用 Tailwind 的 `sr-only` 类，在浏览器可视化渲染流中占位为 0 像素，对人类真实用户完全隐形，消除任何不自然的突兀卡片感：
  ```tsx
  export default function DetailSeoSummary({ title, description }: DetailSeoSummaryProps) {
      return (
          <aside aria-label={title} className="sr-only">
              <p>{description}</p>
          </aside>
      );
  }
  ```
- **全模块继承**: 所有经过 `defineSeoDetailPage` 包装的详情页统一自动继承此规范，新迁移模块无需做额外处理。

