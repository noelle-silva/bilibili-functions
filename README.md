# Bilibili 自定义按钮扩展

一个为 Bilibili 视频页面添加自定义功能按钮的 Chrome 扩展。

## ✨ 功能

- **复制字幕** 📋 - 一键复制当前视频的字幕到剪贴板
- **批量下载字幕** 📥 - 支持多P视频的字幕批量下载

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 构建扩展

```bash
npm run build
```

### 加载到 Chrome

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `dist` 目录

## 📖 使用

安装扩展后访问 Bilibili 视频页面，在视频下方会显示自定义按钮。

## 🔧 开发

### 调试模式

在 `src/utils/debug.ts` 中设置 `DEBUG = true` 可启用调试日志。

### 添加新功能

1. 在 `src/modules/` 下创建新模块
2. 实现 `ButtonModule` 接口
3. 在 `src/content/index.ts` 中注册模块

## 📝 技术栈

- TypeScript
- Chrome Extension Manifest V3
- Vite + @crxjs/vite-plugin
- Bilibili WBI API

## 📄 许可证

MIT License
