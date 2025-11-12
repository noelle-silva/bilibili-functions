import type {
  VideoInfo,
  VideoPart,
  SubtitleInfo,
  SubtitleItem,
  VideoPageListResponse,
  PlayerInfoResponse,
  SubtitleFileResponse,
} from '@/core/types';

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
 */
export async function getSubtitleList(
  cid: string,
  bvid?: string,
  aid?: string
): Promise<SubtitleInfo[]> {
  const params = new URLSearchParams({ cid });
  if (bvid) params.append('bvid', bvid);
  if (aid) params.append('aid', aid);

  const url = `https://api.bilibili.com/x/player/v2?${params.toString()}`;
  const response = await fetch(url);
  const data: PlayerInfoResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(`获取字幕信息失败: ${data.message}`);
  }

  // 兼容不同的API响应格式
  return data.data?.subtitle?.subtitles || data.data?.subtitle?.list || [];
}

/**
 * 下载字幕文件
 */
export async function fetchSubtitleFile(subtitleUrl: string): Promise<SubtitleItem[]> {
  // 如果是相对路径，补全协议
  const url = subtitleUrl.startsWith('//') ? `https:${subtitleUrl}` : subtitleUrl;

  const response = await fetch(url);
  const data: SubtitleFileResponse = await response.json();

  return data.body || [];
}

/**
 * 选择字幕（优先中文）
 */
export function selectPreferredSubtitle(subtitles: SubtitleInfo[]): SubtitleInfo | null {
  if (subtitles.length === 0) return null;

  // 优先级：中文（中国） > 中文（繁体） > 第一个
  const chinese = subtitles.find(s => s.lan === 'zh-CN' || s.lan === 'zh-Hans');
  const traditionalChinese = subtitles.find(s => s.lan === 'zh-TW' || s.lan === 'zh-Hant');

  return chinese || traditionalChinese || subtitles[0];
}

/**
 * 获取视频的完整字幕（纯文本）
 */
export async function getVideoSubtitleText(
  cid: string,
  bvid?: string,
  aid?: string
): Promise<string> {
  const subtitleList = await getSubtitleList(cid, bvid, aid);

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
