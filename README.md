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

表情包制作器参考了**Parallel-SEKAI**的PJSK-Sticker仓库 以及 **TheOriginalAyaka**的sekai-stickers仓库
[PJSK-Sticker](github.com/Parallel-SEKAI/PJSK-Sticker)
[sekai-stickers](github.com/TheOriginalAyaka/sekai-stickers)

谱面预览器参考了**watagashi-uni**的sekai-mmw-preview-web 及 mikumikuworld 的相关实现 [sekai-mmw-preview-web](https://github.com/watagashi-uni/sekai-mmw-preview-web)
[MikuMikuWorld](https://github.com/crash5band/MikuMikuWorld)

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