import { waitForElement } from '@/utils/dom';

/**
 * DOM 注入器
 * 负责找到目标位置并注入按钮容器
 */
export class DOMInjector {
  private buttonContainer: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private updatePositionBound: (() => void) | null = null;

  /**
   * 查找目标容器（视频操作按钮区域）
   * 找到toolbar作为参考点
   */
  async findTargetContainer(): Promise<HTMLElement | null> {
    try {
      // 查找点赞投币按钮区域
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
   * 创建按钮容器（绝对定位，跟随toolbar）
   */
  createButtonContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'bilibili-custom-buttons-container';
    container.className = 'bilibili-custom-buttons-container';

    // 添加标记
    container.setAttribute('data-v-inspector-ignore', 'true');
    container.setAttribute('data-custom-extension', 'true');

    // 🎨 绝对定位，初始不可见
    container.style.cssText = `
      position: absolute;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    return container;
  }

  /**
   * 注入按钮容器（添加到body，绝对定位跟随toolbar）
   */
  async inject(): Promise<HTMLElement | null> {
    // 先检查是否已经存在
    const existingContainer = document.getElementById('bilibili-custom-buttons-container');
    if (existingContainer) {
      console.log('✅ 按钮容器已存在，复用现有容器');
      this.buttonContainer = existingContainer as HTMLElement;
      this.updatePosition();
      return this.buttonContainer;
    }

    // 如果已经注入，返回现有容器
    if (this.buttonContainer && document.contains(this.buttonContainer)) {
      this.updatePosition();
      return this.buttonContainer;
    }

    // 查找toolbar作为位置参考
    const toolbar = await this.findTargetContainer();
    if (!toolbar) {
      console.warn('未找到视频工具栏');
      return null;
    }

    // 创建按钮容器
    this.buttonContainer = this.createButtonContainer();

    try {
      // ✅ 直接添加到body，完全脱离Vue DOM树
      document.body.appendChild(this.buttonContainer);

      // 计算并设置位置
      this.updatePosition();

      // 绑定事件处理函数
      this.updatePositionBound = () => this.updatePosition();

      // 监听窗口大小变化和滚动，动态更新位置
      window.addEventListener('resize', this.updatePositionBound);
      window.addEventListener('scroll', this.updatePositionBound, true);

      // 显示容器
      setTimeout(() => {
        if (this.buttonContainer) {
          this.buttonContainer.style.opacity = '1';
        }
      }, 100);

      console.log('✅ 按钮容器已创建（绝对定位跟随toolbar）');
      return this.buttonContainer;
    } catch (error) {
      console.error('❌ 注入按钮容器失败:', error);
      this.buttonContainer = null;
      return null;
    }
  }

  /**
   * 更新容器位置，跟随toolbar
   */
  private updatePosition(): void {
    if (!this.buttonContainer) return;

    const toolbar = document.querySelector('.video-toolbar-left') as HTMLElement;
    if (!toolbar) return;

    const rect = toolbar.getBoundingClientRect();

    // 计算位置：在toolbar右侧
    this.buttonContainer.style.left = `${rect.right + 12}px`;
    this.buttonContainer.style.top = `${rect.top + window.scrollY}px`;
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

    // 清理事件监听器
    if (this.updatePositionBound) {
      window.removeEventListener('resize', this.updatePositionBound);
      window.removeEventListener('scroll', this.updatePositionBound, true);
      this.updatePositionBound = null;
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
