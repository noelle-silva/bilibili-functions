import type { ButtonModule, ToolbarButtonConfig } from '@/core/types';
import { isModuleEnabled } from '@/utils/storage';
import { getCompleteVideoInfo } from '@/utils/api';
import { debugLog, errorLog } from '@/utils/debug';

type ToolbarButtonModule = ButtonModule & {
  button: ToolbarButtonConfig;
  execute: NonNullable<ButtonModule['execute']>;
};

function hasToolbarButton(module: ButtonModule): module is ToolbarButtonModule {
  return Boolean(module.button && module.execute);
}

/**
 * 按钮管理器
 */
export class ButtonManager {
  private modules: Map<string, ButtonModule> = new Map();
  private container: HTMLElement | null = null;
  private rendered: boolean = false;
  private styleInstalled: boolean = false;

  /**
   * 注册模块
   */
  register(module: ButtonModule): void {
    if (this.modules.has(module.id)) {
      debugLog(`模块 ${module.id} 已存在，将被覆盖`);
    }

    this.modules.set(module.id, module);

    // 调用生命周期钩子
    module.onLoad?.();

    // 如果已经渲染过，重新渲染
    if (this.rendered && this.container) {
      this.render(this.container);
    }
  }

  /**
   * 注销模块
   */
  unregister(moduleId: string): void {
    const module = this.modules.get(moduleId);
    if (module) {
      // 调用生命周期钩子
      module.onUnload?.();

      this.modules.delete(moduleId);

      // 重新渲染
      if (this.rendered && this.container) {
        this.render(this.container);
      }
    }
  }

  /**
   * 渲染所有按钮
   */
  async render(targetElement: HTMLElement): Promise<void> {
    this.container = targetElement;
    this.rendered = true;
    this.ensureStyles();

    // 清空容器内的按钮
    const buttons = targetElement.querySelectorAll('.bilibili-custom-button');
    buttons.forEach((button) => button.remove());

    // 获取所有启用的模块
    const enabledModules: ToolbarButtonModule[] = [];
    for (const module of this.modules.values()) {
      const enabled = await isModuleEnabled(module.id);
      if (enabled && hasToolbarButton(module)) {
        enabledModules.push(module);
      }
    }

    // 按位置排序
    enabledModules.sort((a, b) => (a.button.position || 0) - (b.button.position || 0));

    // 渲染按钮
    for (const module of enabledModules) {
      const button = this.createButton(module);
      targetElement.appendChild(button);
    }
  }

  /**
   * 创建按钮元素（B站原生风格）
   */
  private createButton(module: ToolbarButtonModule): HTMLElement {
    const button = document.createElement('button');
    button.className = `bilibili-custom-button ${module.button.className || ''}`;
    button.setAttribute('data-module-id', module.id);
    button.setAttribute('title', module.description || module.name);

    // 按钮内容
    const content = document.createElement('span');
    content.textContent = module.button.text;
    button.appendChild(content);

    // 点击事件
    button.addEventListener('click', async () => {
      try {
        button.disabled = true;

        // 获取视频信息（异步从页面上下文获取）
        const videoInfo = await this.getVideoInfo();

        // 执行模块功能
        await module.execute({
          videoInfo,
          element: button,
          page: document,
        });
      } catch (error) {
        errorLog(`模块 ${module.id} 执行失败:`, error);
        // 错误会在模块内部处理和显示
      } finally {
        button.disabled = false;
      }
    });

    return button;
  }

  private ensureStyles() {
    if (this.styleInstalled) return;
    this.styleInstalled = true;

    const styleId = 'bilibili-custom-buttons-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .bilibili-custom-buttons-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      .bilibili-custom-button {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 32px;
        padding: 0 14px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(229, 233, 239, 0.95);
        border-radius: 999px;
        color: #18191c;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        white-space: nowrap;
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, color 0.12s ease, background 0.12s ease, opacity 0.12s ease;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
        backdrop-filter: saturate(160%) blur(10px);
      }

      .bilibili-custom-button:hover:not(:disabled) {
        background: #ffffff;
        border-color: rgba(0, 174, 236, 0.75);
        color: #00aeec;
        box-shadow: 0 10px 28px rgba(0, 174, 236, 0.18);
        transform: translateY(-1px);
      }

      .bilibili-custom-button:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.10);
      }

      .bilibili-custom-button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(0, 174, 236, 0.25);
        border-color: rgba(0, 174, 236, 0.9);
      }

      .bilibili-custom-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 获取当前视频信息
   * 唯一方案：通过 API 获取完整信息（从 URL 提取 bvid，然后调用 API 获取 cid）
   */
  private async getVideoInfo() {
    debugLog('🔍 通过 API 获取视频信息...');

    try {
      const videoInfo = await getCompleteVideoInfo();
      debugLog('✅ 成功获取视频信息:', videoInfo);
      return videoInfo;
    } catch (error) {
      errorLog('❌ 获取视频信息失败:', error);
      throw new Error('无法获取视频信息，请刷新页面后重试');
    }
  }

  /**
   * 刷新按钮
   */
  refresh(): void {
    if (this.container) {
      this.render(this.container);
    }
  }

  /**
   * 获取所有模块
   */
  getModules(): ButtonModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * 获取单个模块
   */
  getModule(moduleId: string): ButtonModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * 清理
   */
  destroy(): void {
    // 调用所有模块的卸载钩子
    for (const module of this.modules.values()) {
      module.onUnload?.();
    }

    this.modules.clear();
    this.container = null;
    this.rendered = false;
  }
}

// 导出单例
export const buttonManager = new ButtonManager();
