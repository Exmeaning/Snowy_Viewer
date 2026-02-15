# Snowy Viewer

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

为了正常使用 Bilibili 动态功能（避免 -412 错误），需要在后端配置以下环境变量：

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
