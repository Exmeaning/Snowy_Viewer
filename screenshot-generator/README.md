# Snowy Screenshot Generator

自动生成所有详情页面的截图，支持增量更新。

## 📁 目录结构

```
screenshot-generator/     # Puppeteer 脚本
├── package.json
└── index.js

Dockerfile.screenshot            # 截图生成器 Docker 镜像
docker-compose.screenshot.yml    # 完整的截图生成环境

screenshots-output/       # 生成的截图输出目录
├── cards/
│   ├── 1.webp
│   └── ...
├── events/
├── gacha/
├── music/
└── metadata.json
```

## 🚀 使用方法

### 方式一：Docker Compose (推荐)

```bash
# 创建输出目录
mkdir -p screenshots-output

# 运行截图生成
docker-compose -f docker-compose.screenshot.yml up --build

# 查看生成的截图
ls screenshots-output/
```

### 方式二：手动运行

```bash
# 1. 启动 web 应用
cd web && npm run build && npm start &

# 2. 安装依赖
cd screenshot-generator
npm install

# 3. 运行生成器
WEB_URL=http://localhost:3000 OUTPUT_DIR=./output node index.js

# 4. 强制重新生成所有截图
node index.js --force
```

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEB_URL` | `http://localhost:3000` | Web 应用地址 |
| `OUTPUT_DIR` | `/screenshots` | 截图输出目录 |
| `CONCURRENCY` | `3` | 并行截图数量 |
| `BUILD_VERSION` | `dev` | 构建版本号 |

## 📊 输出

生成完成后，`metadata.json` 包含统计信息：

```json
{
  "generatedAt": "2024-01-13T12:00:00.000Z",
  "version": "1.1.0",
  "stats": {
    "cards": { "total": 1500, "generated": 50, "skipped": 1450 },
    "events": { "total": 200, "generated": 5, "skipped": 195 },
    "gacha": { "total": 300, "generated": 10, "skipped": 290 },
    "music": { "total": 500, "generated": 20, "skipped": 480 }
  }
}
```

## 🔄 CI/CD 集成

### GitHub Actions 示例

```yaml
name: Generate Screenshots

on:
  workflow_dispatch:  # 手动触发
  schedule:
    - cron: '0 0 * * 0'  # 每周日

jobs:
  screenshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Create output directory
        run: mkdir -p screenshots-output
        
      - name: Generate screenshots
        run: |
          docker-compose -f docker-compose.screenshot.yml up --build --abort-on-container-exit
        env:
          BUILD_VERSION: ${{ github.sha }}
          
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: screenshots-${{ github.sha }}
          path: screenshots-output/
          retention-days: 30
```

## ⏱️ 预计耗时

| 类型 | 数量 | 首次全量 | 增量更新 |
|------|------|---------|---------|
| 卡牌 | ~1500 | ~45分钟 | ~5分钟 |
| 活动 | ~200 | ~10分钟 | <1分钟 |
| 扭蛋 | ~300 | ~15分钟 | ~2分钟 |
| 音乐 | ~500 | ~20分钟 | ~3分钟 |
| **合计** | | **~90分钟** | **<15分钟** |
