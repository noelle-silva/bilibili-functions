# Bilibili 自定义按钮扩展 - 技术方案

## 1. 项目概述

开发一个模块化的 Chrome 扩展，在 Bilibili 视频详情页的操作按钮区域（点赞、投币等附近）动态插入自定义功能按钮。

### 核心特性
- 模块化、可热插拔的按钮系统
- 功能区隔离，互不干扰
- 易于扩展新功能
- 首个功能：复制视频字幕

---

## 2. Bilibili 字幕获取方案

### 2.1 字幕获取流程

```
1. 从页面 URL 提取视频标识（BV号 或 aid）
   URL 格式: https://www.bilibili.com/video/BV1xx411c7XD

2. 获取视频 cid（Content ID）
   API: https://api.bilibili.com/x/player/pagelist?bvid={bvid}&aid={aid}

3. 获取字幕信息
   API: https://api.bilibili.com/x/player/v2?cid={cid}&bvid={bvid}
   或: https://api.bilibili.com/x/player/wbi/v2?cid={cid}&bvid={bvid}

4. 从返回的 subtitle 字段获取字幕列表
   返回格式: { subtitle: { list: [{lan, subtitle_url, ...}] } }

5. 下载字幕文件（JSON 格式）
   字幕 URL: https://.../*.json
   格式: { body: [{from, to, content, ...}] }
```

### 2.2 字幕数据结构

```json
{
  "body": [
    {
      "from": 0.0,
      "to": 2.5,
      "content": "字幕文本",
      "location": 2
    }
  ]
}
```

---

## 3. 扩展架构设计

### 3.1 整体架构

```
bilibili-buttons/
├── manifest.json          # 扩展配置文件（Manifest V3）
├── src/
│   ├── core/              # 核心系统
│   │   ├── ButtonManager.ts      # 按钮管理器
│   │   ├── ModuleLoader.ts       # 模块加载器
│   │   ├── DOMInjector.ts        # DOM 注入器
│   │   └── types.ts              # 类型定义
│   │
│   ├── modules/           # 功能模块（可热插拔）
│   │   ├── subtitle-copy/        # 字幕复制模块
│   │   │   ├── index.ts          # 模块入口
│   │   │   ├── SubtitleFetcher.ts # 字幕获取逻辑
│   │   │   └── config.ts         # 模块配置
│   │   │
│   │   └── [future-modules]/     # 未来的功能模块
│   │
│   ├── content/           # Content Script
│   │   └── index.ts       # 页面注入入口
│   │
│   ├── background/        # Background Service Worker
│   │   └── index.ts       # 后台脚本
│   │
│   └── utils/             # 工具函数
│       ├── api.ts         # Bilibili API 封装
│       ├── dom.ts         # DOM 操作工具
│       └── storage.ts     # 存储管理
│
├── public/
│   └── icons/             # 扩展图标
│
├── package.json
├── tsconfig.json
├── vite.config.ts         # Vite 打包配置
└── README.md
```

### 3.2 核心模块设计

#### 3.2.1 按钮模块接口（Module Interface）

```typescript
interface ButtonModule {
  // 模块唯一标识
  id: string;

  // 模块名称
  name: string;

  // 按钮配置
  button: {
    text: string;           // 按钮文本
    icon?: string;          // 按钮图标（可选）
    className?: string;     // 自定义样式类
    position?: number;      // 插入位置（排序）
  };

  // 执行函数（点击按钮时调用）
  execute: (context: ExecutionContext) => Promise<void>;

  // 生命周期钩子
  onLoad?: () => void;      // 模块加载时
  onUnload?: () => void;    // 模块卸载时

  // 是否启用（可配置）
  enabled: boolean;
}

interface ExecutionContext {
  videoInfo: {
    bvid: string;
    aid: string;
    cid: string;
    title: string;
  };
  element: HTMLElement;     // 按钮 DOM 元素
  page: Document;           // 页面文档对象
}
```

#### 3.2.2 按钮管理器（ButtonManager）

```typescript
class ButtonManager {
  private modules: Map<string, ButtonModule> = new Map();
  private container: HTMLElement | null = null;

  // 注册模块
  register(module: ButtonModule): void;

  // 注销模块
  unregister(moduleId: string): void;

  // 渲染所有按钮
  render(targetElement: HTMLElement): void;

  // 重新渲染
  refresh(): void;

  // 获取所有模块
  getModules(): ButtonModule[];
}
```

#### 3.2.3 DOM 注入器（DOMInjector）

```typescript
class DOMInjector {
  // 查找目标容器（点赞、投币按钮区域）
  findTargetContainer(): HTMLElement | null;

  // 创建按钮容器
  createButtonContainer(): HTMLElement;

  // 监听页面变化（SPA 路由切换）
  observePageChanges(callback: () => void): MutationObserver;
}
```

---

## 4. 字幕复制模块实现

### 4.1 模块结构

```typescript
// modules/subtitle-copy/index.ts
export const subtitleCopyModule: ButtonModule = {
  id: 'subtitle-copy',
  name: '复制字幕',

  button: {
    text: '复制字幕',
    icon: '📋',
    position: 100
  },

  async execute(context) {
    const fetcher = new SubtitleFetcher(context.videoInfo);
    const subtitles = await fetcher.getSubtitles();
    const text = subtitles.map(s => s.content).join('\n');
    await navigator.clipboard.writeText(text);

    // 显示成功提示
    showToast('字幕已复制到剪贴板');
  },

  enabled: true
};
```

### 4.2 字幕获取器

```typescript
// modules/subtitle-copy/SubtitleFetcher.ts
class SubtitleFetcher {
  constructor(private videoInfo: VideoInfo) {}

  async getSubtitles(): Promise<Subtitle[]> {
    // 1. 获取字幕信息
    const playerInfo = await this.getPlayerInfo();

    // 2. 选择字幕语言（优先中文）
    const subtitleUrl = this.selectSubtitleUrl(playerInfo.subtitle.list);

    // 3. 下载字幕文件
    const subtitleData = await fetch(subtitleUrl).then(r => r.json());

    return subtitleData.body;
  }

  private async getPlayerInfo() {
    const url = `https://api.bilibili.com/x/player/v2?cid=${this.videoInfo.cid}&bvid=${this.videoInfo.bvid}`;
    return fetch(url).then(r => r.json());
  }

  private selectSubtitleUrl(list: SubtitleInfo[]): string {
    // 优先选择中文字幕
    const chinese = list.find(s => s.lan === 'zh-CN' || s.lan === 'zh-Hans');
    return chinese?.subtitle_url || list[0]?.subtitle_url || '';
  }
}
```

---

## 5. 技术栈选择

### 5.1 核心技术
- **Chrome Extension Manifest V3**（最新标准）
- **TypeScript**（类型安全、代码提示）
- **Vite**（快速开发、HMR 支持）

### 5.2 可选增强
- **TailwindCSS** / **UnoCSS**（样式方案）
- **Vue 3** / **React**（如果需要复杂 UI）
- **Pinia** / **Zustand**（状态管理，如有需要）

### 5.3 开发工具
- **crxjs/vite-plugin**（Vite Chrome 扩展插件）
- **ESLint + Prettier**（代码规范）
- **Chrome Extension DevTools**

---

## 6. 开发路线图

### Phase 1: 基础框架 ✅
- [ ] 初始化项目结构
- [ ] 配置 Manifest V3
- [ ] 实现 ButtonManager
- [ ] 实现 DOMInjector
- [ ] 实现 ModuleLoader

### Phase 2: 字幕复制功能 📋
- [ ] 实现 SubtitleFetcher
- [ ] 实现字幕格式转换
- [ ] 添加用户反馈（Toast 提示）
- [ ] 错误处理（无字幕、网络错误）

### Phase 3: 优化与扩展 🚀
- [ ] 添加配置页面（开启/关闭模块）
- [ ] 性能优化（缓存、防抖）
- [ ] 支持更多字幕格式（SRT、ASS）
- [ ] 添加更多功能模块

---

## 7. 关键技术点

### 7.1 页面注入时机
```typescript
// Bilibili 是 SPA，需要监听路由变化
function injectButtons() {
  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver(() => {
    if (isVideoPage() && !isButtonsInjected()) {
      buttonManager.render(targetElement);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
```

### 7.2 跨域请求处理
```json
// manifest.json
{
  "host_permissions": [
    "https://api.bilibili.com/*",
    "https://*.hdslb.com/*"
  ]
}
```

### 7.3 模块热加载
```typescript
// 动态导入模块
async function loadModule(modulePath: string) {
  const module = await import(modulePath);
  buttonManager.register(module.default);
}

// 支持运行时启用/禁用
function toggleModule(moduleId: string, enabled: boolean) {
  const module = buttonManager.getModule(moduleId);
  module.enabled = enabled;
  buttonManager.refresh();
}
```

---

## 8. 已确定的技术决策 ✅

1. **样式风格**：使用 Material Design 风格（MUI 风格），同时与 Bilibili 原生按钮保持视觉协调
2. **字幕格式**：仅支持纯文本格式（一行行文字）
3. **多 P 视频**：
   - 按钮 1：复制当前视频字幕到剪贴板
   - 按钮 2：选择选集并批量下载字幕 TXT 文件
4. **配置界面**：提供 Options 页面来管理模块的启用/禁用
5. **其他功能**：暂不考虑，专注于字幕相关功能

---

## 9. 参考资源

- [Chrome Extensions Manifest V3 文档](https://developer.chrome.com/docs/extensions/mv3/)
- [Bilibili API 收集](https://github.com/SocialSisterYi/bilibili-API-collect)
- [Vite Chrome Extension 插件](https://github.com/crxjs/chrome-extension-tools)
