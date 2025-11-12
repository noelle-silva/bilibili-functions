import type {
  VideoInfo,
  VideoPart,
  SubtitleInfo,
  SubtitleItem,
  VideoPageListResponse,
} from '@/core/types';
import { debugLog } from './debug';

/**
 * 从 URL 提取视频信息
 */
export function extractVideoInfo(url: string = window.location.href): Partial<VideoInfo> {
  const bvidMatch = url.match(/\/video\/(BV[\w]+)/);
  const aidMatch = url.match(/\/video\/av(\d+)/);
  const pageMatch = url.match(/[?&]p=(\d+)/);

  return {
    bvid: bvidMatch?.[1] || '',
    aid: aidMatch?.[1] || '',
    part: pageMatch ? parseInt(pageMatch[1]) : 1,
  };
}

/**
 * 获取完整的视频信息（包括 cid）
 * 通过 API 获取，不依赖页面全局变量
 */
export async function getCompleteVideoInfo(): Promise<VideoInfo> {
  const currentUrl = window.location.href;
  debugLog('📍 当前页面 URL:', currentUrl);

  const urlInfo = extractVideoInfo(currentUrl);
  debugLog('📍 从 URL 提取的信息:', urlInfo);

  if (!urlInfo.bvid && !urlInfo.aid) {
    throw new Error('无法从 URL 识别视频信息');
  }

  // 获取视频页面列表
  debugLog('📍 正在调用 getVideoPageList API...');
  const pageList = await getVideoPageList(urlInfo.bvid!, urlInfo.aid);
  debugLog('📍 获取到分P列表:', pageList);

  if (pageList.length === 0) {
    throw new Error('无法获取视频信息');
  }

  // 找到当前分P
  const currentPart = urlInfo.part || 1;
  debugLog('📍 当前分P:', currentPart);

  const pageInfo = pageList.find(p => p.page === currentPart) || pageList[0];
  debugLog('📍 匹配到的 pageInfo:', pageInfo);

  const result = {
    bvid: urlInfo.bvid || '',
    aid: urlInfo.aid || '',
    cid: String(pageInfo.cid),
    title: pageInfo.part || '视频',
    part: currentPart,
  };

  debugLog('📍 最终返回的视频信息:', result);
  return result;
}

/**
 * 获取视频分P列表
 */
export async function getVideoPageList(bvid: string, aid?: string): Promise<VideoPart[]> {
  const params = new URLSearchParams();
  if (bvid) params.append('bvid', bvid);
  if (aid) params.append('aid', aid);

  const url = `https://api.bilibili.com/x/player/pagelist?${params.toString()}`;
  const response = await fetch(url);
  const data: VideoPageListResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(`获取分P列表失败: ${data.message}`);
  }

  return data.data || [];
}

/**
 * 获取视频标题
 */
export function getVideoTitle(): string {
  const titleElement = document.querySelector('h1.video-title') ||
                       document.querySelector('.video-info-title');
  return titleElement?.textContent?.trim() || '未知标题';
}

/**
 * 获取当前分P标题
 */
export function getCurrentPartTitle(): string {
  const partElement = document.querySelector('.part-text') ||
                      document.querySelector('.page-title');
  return partElement?.textContent?.trim() || '';
}

/**
 * 获取字幕信息列表
 * 使用 WBI API（参考成功的 Python 实现）
 */
export async function getSubtitleList(
  cid: string,
  bvid?: string,
  aid?: string
): Promise<SubtitleInfo[]> {
  // 使用 WBI API - 这是B站新的字幕API
  const params = new URLSearchParams({
    cid,
    isGaiaAvoided: 'false',
    web_location: '1315873',
    w_rid: '364cdf378b75ef6a0cee77484ce29dbb', // WBI 签名参数
    wts: Math.floor(Date.now() / 1000).toString(), // 时间戳（秒）
  });

  if (bvid) params.append('bvid', bvid);
  if (aid) params.append('aid', aid);

  const url = `https://api.bilibili.com/x/player/wbi/v2?${params.toString()}`;
  debugLog('🔍 请求字幕 API (WBI) (通过Background):', url);

  // 通过 Background Script 请求，这样会携带 Cookie
  const response: any = await chrome.runtime.sendMessage({
    type: 'FETCH_SUBTITLE_API',
    data: { url, bvid }, // 传递 bvid 用于设置 Referer
  });

  if (!response.success) {
    throw new Error(`获取字幕信息失败: ${response.error}`);
  }

  const data = response.data;
  debugLog('📦 完整的 WBI API 响应:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`获取字幕信息失败: ${data.message}`);
  }

  debugLog('📝 字幕数据:', data.data?.subtitle);

  // 兼容不同的API响应格式
  const subtitles = data.data?.subtitle?.subtitles || data.data?.subtitle?.list || [];
  debugLog('✅ 找到字幕数量:', subtitles.length);

  if (subtitles.length > 0) {
    debugLog('📋 字幕列表:', subtitles);
  }

  return subtitles;
}

/**
 * 下载字幕文件（通过 Background Script 避免 CORS）
 */
export async function fetchSubtitleFile(subtitleUrl: string): Promise<SubtitleItem[]> {
  // 如果 subtitle_url 为空，抛出明确的错误
  if (!subtitleUrl || subtitleUrl.trim() === '') {
    throw new Error('字幕 URL 为空，B站可能已更改 API 或该视频的字幕暂不可用');
  }

  // 如果是相对路径，补全协议
  const url = subtitleUrl.startsWith('//') ? `https:${subtitleUrl}` : subtitleUrl;

  debugLog('📥 请求下载字幕文件 (通过Background):', url);

  // 通过 Background Script 下载，避免 CORS 问题
  const response: any = await chrome.runtime.sendMessage({
    type: 'FETCH_SUBTITLE_FILE',
    data: { url },
  });

  if (!response.success) {
    throw new Error(`下载字幕文件失败: ${response.error}`);
  }

  const data = response.data;
  debugLog('✅ 字幕文件下载完成，条目数:', data.body?.length || 0);

  return data.body || [];
}

/**
 * 选择字幕（优先中文）
 */
export function selectPreferredSubtitle(subtitles: SubtitleInfo[]): SubtitleInfo | null {
  if (subtitles.length === 0) return null;

  debugLog('🎯 开始选择字幕，可用列表:', subtitles.map(s => ({ lan: s.lan, lan_doc: s.lan_doc })));

  // 优先级：
  // 1. AI中文字幕 (ai-zh)
  // 2. 普通中文字幕 (zh-CN, zh-Hans)
  // 3. 繁体中文 (zh-TW, zh-Hant)
  // 4. 第一个
  const aiChinese = subtitles.find(s => s.lan === 'ai-zh');
  const chinese = subtitles.find(s => s.lan === 'zh-CN' || s.lan === 'zh-Hans');
  const traditionalChinese = subtitles.find(s => s.lan === 'zh-TW' || s.lan === 'zh-Hant');

  const selected = aiChinese || chinese || traditionalChinese || subtitles[0];

  debugLog('✅ 选择的字幕:', { lan: selected.lan, lan_doc: selected.lan_doc });

  return selected;
}

/**
 * 获取视频的完整字幕（纯文本）
 */
export async function getVideoSubtitleText(
  cid: string,
  bvid?: string,
  aid?: string
): Promise<string> {
  // 使用实时 API 获取字幕列表（确保数据一致性）
  const { getSubtitleListHybrid } = await import('./subtitle-extractor');
  const subtitleList = await getSubtitleListHybrid(cid, bvid, aid);

  if (subtitleList.length === 0) {
    throw new Error('该视频没有字幕');
  }

  const preferredSubtitle = selectPreferredSubtitle(subtitleList);
  if (!preferredSubtitle) {
    throw new Error('无法选择合适的字幕');
  }

  const subtitleItems = await fetchSubtitleFile(preferredSubtitle.subtitle_url);

  // 将字幕拼接成纯文本
  return subtitleItems.map(item => item.content).join('\n');
}

/**
 * 格式化时间（秒 -> HH:MM:SS）
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}

/**
 * 格式化字幕为带时间轴的文本（可选功能）
 */
export function formatSubtitleWithTimestamp(items: SubtitleItem[]): string {
  return items
    .map(item => `[${formatTime(item.from)} -> ${formatTime(item.to)}] ${item.content}`)
    .join('\n');
}
