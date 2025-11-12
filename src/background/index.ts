// Background Service Worker
import { debugLog, errorLog } from '@/utils/debug';

debugLog('🔧 Bilibili Buttons - Background Service Worker 已启动');

// 监听扩展安装
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    debugLog('🎉 扩展首次安装');
    // 可以在这里初始化默认配置
  } else if (details.reason === 'update') {
    debugLog('🔄 扩展已更新');
  }
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  debugLog('📨 收到消息:', request);

  // 处理字幕API请求（带Cookie）
  if (request.type === 'FETCH_SUBTITLE_API') {
    handleSubtitleAPI(request.data)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }

  // 处理字幕文件下载（避免 CORS）
  if (request.type === 'FETCH_SUBTITLE_FILE') {
    handleSubtitleFile(request.data)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }

  // 处理下载请求
  if (request.type === 'DOWNLOAD_SUBTITLE') {
    handleDownload(request.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }
});

/**
 * 处理字幕 API 请求（会携带 Cookie 和完整的 headers）
 * 参考成功的 Python 实现，使用完整的浏览器 headers
 */
async function handleSubtitleAPI(data: { url: string; bvid?: string }) {
  try {
    debugLog('🔍 Background 请求字幕 API:', data.url);

    // 构建完整的 headers（模拟浏览器请求）
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
    };

    // 如果有 bvid，设置 Referer 和 Origin
    if (data.bvid) {
      headers['Referer'] = `https://www.bilibili.com/video/${data.bvid}/`;
      headers['Origin'] = 'https://www.bilibili.com';
    }

    const response = await fetch(data.url, {
      credentials: 'include', // 携带 Cookie
      headers,
    });
    const result = await response.json();
    debugLog('✅ Background 获取到响应');
    return result;
  } catch (error) {
    errorLog('❌ Background 请求失败:', error);
    throw error;
  }
}

/**
 * 处理字幕文件下载（避免 CORS，禁用缓存）
 */
async function handleSubtitleFile(data: { url: string }) {
  try {
    // 添加时间戳破坏缓存
    const timestamp = Date.now();
    const separator = data.url.includes('?') ? '&' : '?';
    const url = `${data.url}${separator}_t=${timestamp}`;

    debugLog('📥 Background 下载字幕文件:', url);

    // 添加完整的 headers
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
    };

    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'include',
      headers,
    });
    const result = await response.json();

    debugLog('✅ Background 字幕文件下载完成');
    return result;
  } catch (error) {
    errorLog('❌ Background 下载字幕文件失败:', error);
    throw error;
  }
}

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
    errorLog('下载失败:', error);
    throw error;
  }
}
