// Background Service Worker

console.log('🔧 Bilibili Buttons - Background Service Worker 已启动');

// 监听扩展安装
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 扩展首次安装');
    // 可以在这里初始化默认配置
  } else if (details.reason === 'update') {
    console.log('🔄 扩展已更新');
  }
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('📨 收到消息:', request);

  // 可以在这里处理各种消息
  if (request.type === 'DOWNLOAD_SUBTITLE') {
    // 处理下载请求
    handleDownload(request.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true; // 异步响应
  }
});

/**
 * 处理下载
 */
async function handleDownload(data: { filename: string; content: string }) {
  try {
    const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url,
      filename: data.filename,
      saveAs: false,
    });

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('下载失败:', error);
    throw error;
  }
}
