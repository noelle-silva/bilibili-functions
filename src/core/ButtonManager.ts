import type { ButtonModule } from '@/core/types';
import { isModuleEnabled } from '@/utils/storage';
import { getCompleteVideoInfo } from '@/utils/api';
import { debugLog, errorLog } from '@/utils/debug';

/**
 * 按钮管理器
 */
export class ButtonManager {
  private modules: Map<string, ButtonModule> = new Map();
  private container: HTMLElement | null = null;
  private rendered: boolean = false;

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

    // 清空容器内的按钮
    const buttons = targetElement.querySelectorAll('.bilibili-custom-button');
    buttons.forEach((button) => button.remove());

    // 获取所有启用的模块
    const enabledModules: ButtonModule[] = [];
    for (const module of this.modules.values()) {
      const enabled = await isModuleEnabled(module.id);
      if (enabled) {
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
  private createButton(module: ButtonModule): HTMLElement {
    const button = document.createElement('button');
    button.className = `bilibili-custom-button ${module.button.className || ''}`;
    button.setAttribute('data-module-id', module.id);
    button.setAttribute('title', module.description || module.name);

    // 按钮内容
    const content = document.createElement('span');
    if (module.button.icon) {
      content.innerHTML = `${module.button.icon} ${module.button.text}`;
    } else {
      content.textContent = module.button.text;
    }
    button.appendChild(content);

    // 🎨 B站原生按钮风格
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid #e5e9ef;
      border-radius: 4px;
      color: #18191c;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 500;
      white-space: nowrap;
    `;

    // 悬停效果（模仿B站原生）
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f6f7f9';
      button.style.borderColor = '#00aeec';
      button.style.color = '#00aeec';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
      button.style.borderColor = '#e5e9ef';
      button.style.color = '#18191c';
    });

    // 点击事件
    button.addEventListener('click', async () => {
      try {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';

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
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
    });

    return button;
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
