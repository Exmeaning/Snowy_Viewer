# Moesekai (原Snowy SekaiViewer)

这是一个基于 Next.js 和 Go 的 Project Sekai 查看器项目。

> ⚠️ **注意 / Note**
>
> 作者能力有限，本项目仅作为个人练习与探索。代码中可能存在大量非最佳实践，敬请包涵。
> The author has limited capabilities; this project is for personal practice and exploration. Please be aware that the code may contain non-optimal practices.

## 参考与致谢 / Credits

本项目参考了 [Sekai Viewer](https://github.com/Sekai-World/sekai-viewer) 的设计与实现。
Sekai Viewer 采用 **GPLv3** 开源协议。

This project is inspired by and references [Sekai Viewer](https://github.com/Sekai-World/sekai-viewer).
Sekai Viewer is licensed under **GPLv3**.

[sekai-calculator](https://github.com/xfl03/sekai-calculator) 项目提供的组卡算法支持
sekai-calculator 采用 **LGPL-2.1** 开源协议。

项目算法也参考了**Luna茶**的相关组卡代码实现[sekai-deck-recommend-cpp](https://github.com/NeuraXmy/sekai-deck-recommend-cpp)
## 免责声明 / Disclaimer

**本项目包含大量由人工智能（AI）辅助生成的代码。**

- 代码可能包含潜在的错误、逻辑漏洞或非最佳实践。
- 使用者请自行承担风险，建议在生产环境部署前进行充分的审查和测试。
- 维护者不对因使用本项目代码而导致的任何问题负责。

**This project contains a significant amount of code generated with the assistance of Artificial Intelligence (AI).**

- The code may contain potential errors, logical flaws, or non-best practices.
- Users should use it at their own risk and are advised to conduct thorough review and testing before deploying in a production environment.
- The maintainers are not responsible for any issues arising from the use of this project's code.

## License

本项目的开源协议遵循所参考项目的要求（如适用），当前采用 AGPL-3.0。
AGPL-3.0

## 环境变量 / Environment Variables

### 基础后端配置

- **PORT**: 后端监听端口（默认 `8080`）
- **REDIS_URL**: Redis 地址（默认 `localhost:6379`）
- **MASTER_DATA_PATH**: 本地 masterdata 路径（默认 `./data/master`）

### 翻译校对系统（新后端）

- **TRANSLATOR_ACCOUNTS**: 翻译账号，格式 `user1:pass1,user2:pass2`。为空时翻译系统关闭。
- **JWT_SECRET**: 翻译系统 JWT 签名密钥（务必在生产环境设置强随机值）。
- **TRANSLATION_PATH**: 翻译文件目录。
  - 本地开发建议：`./web/public/data/translations`
  - Docker 生产镜像建议：`/app/nextjs/web/public/data/translations`
- **GITHUB_TOKEN**: 用于触发 GitHub Actions 的 Token（需要 Actions write 权限）。
- **GITHUB_REPO**: 目标仓库，格式 `owner/repo`（例如 `yourname/Snowy_Viewer`）。
- **GITHUB_WORKFLOW_FILE**: 要触发的 workflow 文件名（默认 `sync-translations-from-deploy.yml`）。
- **GITHUB_WORKFLOW_REF**: 触发 workflow 使用的分支或 tag（默认 `main`）。
- **TRANSLATION_AUTO_PUSH_ENABLED**: 是否开启容器内定时触发 workflow（默认 `false`，建议生产保持关闭）。

### 前端转发相关

- **NEXT_PUBLIC_API_URL**: 前端请求 API 的公开地址前缀（为空时走同源 `/api/...`，推荐）。
- **INTERNAL_API_BASE_URL**: Next.js rewrite 用于容器内转发 API 的地址（默认 `http://127.0.0.1:8080`）。
  - 单容器可用默认值
  - 多容器请设为 `http://backend:8080`

### Bilibili 认证配置

*推荐仅配置 `BILIBILI_SESSDATA`*

- **BILIBILI_SESSDATA**: (推荐) 您的 Bilibili SESSDATA Cookie 值。
- **BILIBILI_COOKIE**: (可选) 完整的 Bilibili Cookie 字符串。如果配置了此项，将优先使用。

**获取方法**:
1. 浏览器登录 Bilibili。
2. F12 打开开发者工具 -> Application -> Cookies。
3. 找到 `SESSDATA` 复制其值。

**示例 (Docker)**:
```bash
docker run -e BILIBILI_SESSDATA=xxxxxx ...
```

## 持久化路径 / Persistent Paths

翻译校对系统会直接写入 JSON 文件，容器部署时必须做持久化挂载：

- **必须持久化**: `TRANSLATION_PATH` 对应目录
  - 生产镜像默认建议挂载：`/app/nextjs/web/public/data/translations`
  - 包含：`*.json`、`*.full.json`、`eventStory/*.json`

如果启用“自动推送 GitHub”，还需要：

- 在运行环境配置 `GITHUB_TOKEN`、`GITHUB_REPO`、`GITHUB_WORKFLOW_FILE`、`GITHUB_WORKFLOW_REF`
- 确保目标 workflow 支持 `workflow_dispatch`

## Docker 热更新开发 / Hot Reload (Dev)

已提供开发用编排：`docker-compose.dev.yml`

```bash
docker compose -f docker-compose.dev.yml up --build
```

- 后端：`air` 监听 Go 代码热重载
- 前端：`next dev` + `WATCHPACK_POLLING=true`
- 多容器 API 转发通过 `INTERNAL_API_BASE_URL=http://backend:8080`

## GitHub Actions 同步翻译 / Sync Workflow

已提供两个互不相干的工作流：

1) `.github/workflows/sync-translations-from-deploy.yml`

- 默认每 15 分钟从 `https://snowyviewer.exmeaning.com` 同步：
  - `web/public/data/translations/*.json`
  - `web/public/data/translations/*.full.json`
  - `web/public/data/translations/eventStory/event_*.json`
  - `web/public/data/search-index.json`

2) `.github/workflows/update-translations-via-script.yml`

- 默认每 6 小时执行一次，使用 `scripts/translate.py` 更新翻译（支持 LLM）
- 默认模式：`llm-gemini`
- 可在 `workflow_dispatch` 手动选择模式：
  - `cn-only`
  - `llm-qwen`（需配置 `SILICONFLOW_API_KEY`）
  - `llm-gemini`（需配置 `GEMINI_API_KEY`）
- 直接使用仓库内的 `scripts/translate.py`

必需仓库权限：`contents: write`（用于自动 commit / push）
