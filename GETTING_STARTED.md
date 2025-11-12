# 快速开始指南

## 📦 安装依赖

```bash
npm install
```

## 🎨 准备图标（可选）

在 `public/icons/` 目录下放置以下图标文件：
- icon-16.png (16x16)
- icon-48.png (48x48)
- icon-128.png (128x128)

如果暂时没有图标，扩展也能正常运行（Chrome 会使用默认图标）。

## 🛠️ 开发模式

```bash
npm run dev
```

开发模式会监听文件变化并自动重新构建。

## 📦 构建扩展

```bash
npm run build
```

构建产物会输出到 `dist` 目录。

## 🚀 加载到 Chrome

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 目录

## ✅ 测试功能

1. 访问任意 Bilibili 视频页面，例如：
   - https://www.bilibili.com/video/BV1xx411c7XD

2. 在视频下方的操作按钮区域（点赞、投币等位置）应该能看到：
   - 📋 复制字幕
   - 📥 批量下载

3. 点击按钮测试功能：
   - 复制字幕：点击后字幕会复制到剪贴板
   - 批量下载：点击后会弹出分P选择对话框

## ⚙️ 配置管理

1. 在 Chrome 扩展页面找到"Bilibili 自定义按钮"
2. 点击"详细信息"
3. 点击"扩展程序选项"
4. 在配置页面可以启用/禁用功能模块

## 🐛 调试技巧

### Content Script 调试
1. 在视频页面按 F12 打开开发者工具
2. 在 Console 可以看到扩展的日志输出
3. 查找以 🚀、✅、❌ 开头的日志

### Background Script 调试
1. 访问 `chrome://extensions/`
2. 找到扩展，点击"Service Worker"
3. 会打开 Background Script 的调试窗口

### 常见问题

**问题：按钮没有显示**
- 检查是否在视频页面（URL 包含 `/video/BV` 或 `/video/av`）
- 检查 Console 是否有错误日志
- 尝试刷新页面

**问题：获取字幕失败**
- 确认视频是否有字幕（有些视频没有）
- 检查网络请求是否被拦截
- 查看 Console 的错误信息

**问题：批量下载没有反应**
- 确保浏览器允许下载权限
- 检查是否是多P视频

## 📝 下一步

- 添加更多功能模块
- 自定义按钮样式
- 优化用户体验
- 发布到 Chrome Web Store

查看 `DESIGN.md` 了解详细的架构设计和开发指南。
