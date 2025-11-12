/**
 * 显示 Toast 提示
 */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  const toast = document.createElement('div');
  toast.className = 'bilibili-buttons-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 100000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    animation: fadeInOut 3s ease-in-out;
  `;

  // 添加动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      10% { opacity: 1; transform: translateX(-50%) translateY(0); }
      90% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    style.remove();
  }, 3000);
}

/**
 * 等待元素出现
 */
export function waitForElement(
  selector: string,
  timeout: number = 10000
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`元素未找到: ${selector}`));
    }, timeout);
  });
}

/**
 * 检查是否为视频页面
 */
export function isVideoPage(): boolean {
  return /\/video\/(BV[\w]+|av\d+)/.test(window.location.href);
}

/**
 * 监听页面URL变化（SPA路由）
 */
export function observeUrlChange(callback: () => void): () => void {
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      callback();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 返回清理函数
  return () => observer.disconnect();
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * 下载文本文件
 */
export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 创建加载动画元素
 */
export function createLoadingSpinner(): HTMLElement {
  const spinner = document.createElement('div');
  spinner.className = 'bilibili-buttons-spinner';
  spinner.style.cssText = `
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(0,0,0,0.1);
    border-left-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-left: 8px;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  return spinner;
}
