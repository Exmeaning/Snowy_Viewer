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

## 5. 统一标准化迁移指南（Checklist for Future Pages）

未来为任一模块（如 `music/[id]`）实施迁移时，遵循以下 4 步法：

- [ ] **Step 1: 紧凑元数据提取**：在 `generate-metadata-map.mjs` 中为该实体提取 SEO 所需的核心文本与数值，写入对应本地元数据。
- [ ] **Step 2: 创建 Server Shell**：在对应组件目录创建 `<Module>DetailServerShell.tsx`，使用标准语义标签（`<h1>`、`<article>`、`<table>`、`<a>`）渲染首屏静态内容。
- [ ] **Step 3: 改造 Client 组件为 Island**：保留所有滑块、播放器、3D 模型等交互，将静态骨架交由 Server Shell 处理。
- [ ] **Step 4: 注册 Sitemap 与预热**：确保该路由在 `sitemap-details` 中注册，Go 端的 `WarmupEngine` 将自动纳入闲时预热列表。

---

## 6. SEO 描述文本与视觉隔离规范 (`DetailSeoSummary`)

### 6.1 痛点与历史成因
在旧版纯 CSR 时代，Next.js 服务端直出的 `<body>` 只有 `<div class="loading-spinner"></div>`。为了避免爬虫收到空页面，各详情页通过 `DetailSeoSummary` 组件在底部硬编码注入了一段模板文字（例如：`查看 MEIKO 的 Project SEKAI 卡牌「酔いどれ知らず」，包含卡牌稀有度、属性、技能、数值与高清卡面资源。 | PJSK WIKI`）。
但该组件此前被渲染为一个带有背景色、边框与阴影的独立卡片（`rounded-2xl border bg-white/55 shadow-sm`），在页面交互完成后显得格外机械化与突兀。

### 6.2 规范与改造策略
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
