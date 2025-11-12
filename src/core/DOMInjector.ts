import { waitForElement } from '@/utils/dom';

/**
 * DOM 注入器
 * 负责找到目标位置并注入按钮容器
 */
export class DOMInjector {
  private buttonContainer: HTMLElement | null = null;
  private observer: MutationObserver | null = null;

  /**
   * 查找目标容器（视频操作按钮区域）
   * Bilibili 的点赞、投币等按钮位置
   */
  async findTargetContainer(): Promise<HTMLElement | null> {
    try {
      // 可能的选择器（按优先级）
      const selectors = [
        '.video-toolbar-left', // 新版播放器
        '.ops', // 旧版播放器
        '.video-toolbar', // 备用
      ];

      for (const selector of selectors) {
        try {
          const element = await waitForElement(selector, 3000);
          if (element) {
            return element;
          }
        } catch {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('查找目标容器失败:', error);
      return null;
    }
  }

  /**
   * 创建按钮容器
   */
  createButtonContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'bilibili-custom-buttons-container';
    container.style.cssText = `
      display: inline-flex;
      align-items: center;
      margin-left: 12px;
    `;
    return container;
  }

  /**
   * 注入按钮容器
   */
  async inject(): Promise<HTMLElement | null> {
    // 如果已经注入，返回现有容器
    if (this.buttonContainer && document.contains(this.buttonContainer)) {
      return this.buttonContainer;
    }

    // 查找目标容器
    const targetContainer = await this.findTargetContainer();
    if (!targetContainer) {
      console.warn('未找到目标容器，无法注入按钮');
      return null;
    }

    // 创建并注入按钮容器
    this.buttonContainer = this.createButtonContainer();
    targetContainer.appendChild(this.buttonContainer);

    console.log('✅ 按钮容器已注入');
    return this.buttonContainer;
  }

  /**
   * 监听页面变化（处理 SPA 路由切换）
   */
  observePageChanges(callback: () => void): void {
    let lastUrl = window.location.href;

    this.observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('📍 页面URL变化:', currentUrl);
        callback();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 移除按钮容器
   */
  remove(): void {
    if (this.buttonContainer && document.contains(this.buttonContainer)) {
      this.buttonContainer.remove();
      this.buttonContainer = null;
    }
  }

  /**
   * 停止监听
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * 清理
   */
  destroy(): void {
    this.remove();
    this.disconnect();
  }

  /**
   * 获取当前按钮容器
   */
  getContainer(): HTMLElement | null {
    return this.buttonContainer;
  }
}

// 导出单例
export const domInjector = new DOMInjector();
