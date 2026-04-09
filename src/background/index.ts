// Background Service Worker
import { debugLog, errorLog } from '@/utils/debug';

debugLog('🔧 Bilibili Buttons - Background Service Worker 已启动');

const downloadIdToTabId = new Map<number, number>();

type DownloadTaskKind = 'subtitle' | 'video' | 'unknown';
type DownloadTaskState = 'in_progress' | 'complete' | 'interrupted';
type DownloadTask = {
  downloadId: number;
  kind: DownloadTaskKind;
  filename: string;
  url?: string;
  state: DownloadTaskState;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const downloadTasks = new Map<number, DownloadTask>();
const DOWNLOAD_TASKS_KEY = 'download_tasks_v1';
let saveTimer: number | null = null;

function getSessionStorageArea(): chrome.storage.StorageArea {
  const session = (chrome.storage as any).session as chrome.storage.StorageArea | undefined;
  return session || chrome.storage.local;
}

async function loadDownloadTasks() {
  try {
    const area = getSessionStorageArea();
    const result = await area.get(DOWNLOAD_TASKS_KEY);
    const raw = result[DOWNLOAD_TASKS_KEY] as DownloadTask[] | undefined;
    if (!raw || !Array.isArray(raw)) return;

    downloadTasks.clear();
    raw.forEach((t) => {
      if (!t || typeof t.downloadId !== 'number') return;
      downloadTasks.set(t.downloadId, t);
    });
  } catch (err) {
    errorLog('加载下载任务失败:', err);
  }
}

async function saveDownloadTasks() {
  try {
    const area = getSessionStorageArea();
    const list = Array.from(downloadTasks.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 200);
    await area.set({ [DOWNLOAD_TASKS_KEY]: list });
  } catch (err) {
    errorLog('保存下载任务失败:', err);
  }
}

function scheduleSaveDownloadTasks() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveDownloadTasks();
  }, 500) as any;
}

function trackDownloadCreated(args: {
  downloadId: number;
  kind: DownloadTaskKind;
  filename: string;
  url?: string;
}) {
  const now = Date.now();
  downloadTasks.set(args.downloadId, {
    downloadId: args.downloadId,
    kind: args.kind,
    filename: args.filename,
    url: args.url,
    state: 'in_progress',
    createdAt: now,
    updatedAt: now,
  });
  scheduleSaveDownloadTasks();
}

function trackDownloadChanged(args: { downloadId: number; state?: string; error?: string }) {
  const t = downloadTasks.get(args.downloadId);
  if (!t) return;

  if (args.state === 'complete' || args.state === 'interrupted') {
    t.state = args.state;
  }
  if (args.error) t.error = args.error;
  t.updatedAt = Date.now();
  scheduleSaveDownloadTasks();
}

void loadDownloadTasks();

chrome.downloads.onChanged.addListener((delta) => {
  try {
    const tabId = downloadIdToTabId.get(delta.id);

    const state = delta.state?.current;
    const error = delta.error?.current;

    // 把下载状态推送给对应 tab 的 content script（如果有的话）
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'DOWNLOAD_CHANGED',
        data: {
          downloadId: delta.id,
          state,
          error,
        },
      });
    }

    trackDownloadChanged({ downloadId: delta.id, state, error });

    if (state === 'complete' || state === 'interrupted') {
      if (tabId) downloadIdToTabId.delete(delta.id);
    }
  } catch (err) {
    errorLog('下载状态推送失败:', err);
  }
});

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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    const tabId = sender.tab?.id;
    handleDownload(request.data, tabId)
      .then((downloadId) => sendResponse({ success: true, data: { downloadId } }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }

  // 处理播放地址 API 请求（带 Cookie）
  if (request.type === 'FETCH_PLAYURL_API') {
    handlePlayUrlAPI(request.data)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }

  // 处理远程文件下载（直接 url -> chrome.downloads）
  if (request.type === 'DOWNLOAD_URL') {
    const tabId = sender.tab?.id;
    handleUrlDownload(request.data, tabId)
      .then((downloadId) => sendResponse({ success: true, data: { downloadId } }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }

  // 下载管理：列出当前任务
  if (request.type === 'LIST_DOWNLOAD_TASKS') {
    const tasks = Array.from(downloadTasks.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    sendResponse({ success: true, data: { tasks } });
    return;
  }

  // 打开系统下载页面
  if (request.type === 'OPEN_CHROME_DOWNLOADS') {
    chrome.tabs.create({ url: 'chrome://downloads/' });
    sendResponse({ success: true });
    return;
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
 * 处理播放地址 API 请求（会携带 Cookie 和完整的 headers）
 */
async function handlePlayUrlAPI(data: { url: string; bvid?: string }) {
  try {
    debugLog('🎬 Background 请求播放地址 API:', data.url);

    const headers: HeadersInit = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
    };

    if (data.bvid) {
      headers['Referer'] = `https://www.bilibili.com/video/${data.bvid}/`;
      headers['Origin'] = 'https://www.bilibili.com';
    }

    const response = await fetch(data.url, {
      credentials: 'include',
      headers,
    });

    const result = await response.json();
    debugLog('✅ Background 获取到播放地址响应');
    return result;
  } catch (error) {
    errorLog('❌ Background 请求播放地址失败:', error);
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
async function handleDownload(data: { filename: string; content: string }, tabId?: number) {
  try {
    // MV3 background(service worker) 环境不支持 URL.createObjectURL
    // 用 data: URL 直接交给 chrome.downloads
    const url = `data:text/plain;charset=utf-8,${encodeURIComponent(data.content)}`;
    if (url.length > 1_900_000) {
      throw new Error('字幕内容过大，无法通过 data URL 下载（建议拆分或改用离屏文档方案）');
    }

    const downloadId = await chrome.downloads.download({
      url,
      filename: data.filename,
      saveAs: false,
      conflictAction: 'uniquify',
    });

    trackDownloadCreated({
      downloadId,
      kind: 'subtitle',
      filename: data.filename,
      url: undefined,
    });

    if (typeof tabId === 'number') {
      downloadIdToTabId.set(downloadId, tabId);
    }

    return downloadId;
  } catch (error) {
    errorLog('下载失败:', error);
    throw error;
  }
}

/**
 * 处理远程文件下载
 */
async function handleUrlDownload(data: { url: string; filename: string }, tabId?: number) {
  try {
    const downloadId = await chrome.downloads.download({
      url: data.url,
      filename: data.filename,
      saveAs: false,
      conflictAction: 'uniquify',
    });

    trackDownloadCreated({
      downloadId,
      kind: 'video',
      filename: data.filename,
      url: data.url,
    });

    if (typeof tabId === 'number') {
      downloadIdToTabId.set(downloadId, tabId);
    }

    return downloadId;
  } catch (error) {
    errorLog('下载失败:', error);
    throw error;
  }
}
