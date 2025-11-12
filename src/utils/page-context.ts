/**
 * 页面上下文工具
 * 用于在页面主世界（Main World）中执行代码，访问页面的全局变量
 */

/**
 * 在页面上下文中执行函数并获取结果
 */
export function executeInPageContext<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    // 生成唯一的事件ID
    const eventId = `bilibili-buttons-${Date.now()}-${Math.random()}`;

    // 监听来自页面的响应
    const messageHandler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data.type !== 'BILIBILI_BUTTONS_RESPONSE') return;
      if (event.data.eventId !== eventId) return;

      window.removeEventListener('message', messageHandler);

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.result);
      }
    };

    window.addEventListener('message', messageHandler);

    // 创建并注入脚本
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        try {
          const fn = ${fn.toString()};
          const result = fn();
          window.postMessage({
            type: 'BILIBILI_BUTTONS_RESPONSE',
            eventId: '${eventId}',
            result: result
          }, '*');
        } catch (error) {
          window.postMessage({
            type: 'BILIBILI_BUTTONS_RESPONSE',
            eventId: '${eventId}',
            error: error.message
          }, '*');
        }
      })();
    `;

    document.documentElement.appendChild(script);
    script.remove();

    // 超时处理
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('执行超时'));
    }, 5000);
  });
}

/**
 * 从页面上下文获取视频信息
 */
export async function getVideoInfoFromPage() {
  return executeInPageContext(() => {
    const initialState = (window as any).__INITIAL_STATE__;

    if (initialState?.videoData) {
      return {
        bvid: initialState.videoData.bvid || '',
        aid: String(initialState.videoData.aid || ''),
        cid: String(initialState.videoData.cid || ''),
        title: initialState.videoData.title || '未知标题',
        part: initialState.videoData.p || 1,
      };
    }

    throw new Error('页面全局变量中没有视频数据');
  });
}
