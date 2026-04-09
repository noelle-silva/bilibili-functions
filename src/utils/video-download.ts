import { debugLog } from '@/utils/debug';

type PlayUrlDurlItem = {
  url: string;
  backup_url?: string[];
};

type PlayUrlDashStream = {
  baseUrl?: string;
  base_url?: string;
  bandwidth?: number;
  id?: number;
};

export type PlayUrlResponse = {
  code: number;
  message: string;
  data?: {
    durl?: PlayUrlDurlItem[];
    dash?: {
      video?: PlayUrlDashStream[];
      audio?: PlayUrlDashStream[];
    };
  };
};

export function sanitizeFilename(name: string) {
  return (name || 'bilibili-video')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

export function normalizeMediaUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

export function inferExtension(url: string, fallback: string) {
  try {
    const normalized = normalizeMediaUrl(url);
    const pathname = new URL(normalized).pathname;
    const last = pathname.split('/').pop() || '';
    const match = last.match(/\.([a-zA-Z0-9]+)$/);
    if (!match) return fallback;
    const ext = match[1].toLowerCase();
    if (ext.length > 6) return fallback;
    return `.${ext}`;
  } catch {
    return fallback;
  }
}

function pickProgressiveUrl(item?: PlayUrlDurlItem) {
  if (!item) return '';
  return item.url || item.backup_url?.[0] || '';
}

function pickBestDashUrl(streams?: PlayUrlDashStream[]) {
  if (!streams || streams.length === 0) return '';
  const sorted = [...streams].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
  const best = sorted[0];
  return best.baseUrl || best.base_url || '';
}

export async function fetchPlayUrlThroughBackground(args: {
  bvid?: string;
  aid?: string;
  cid: string;
  qn: number;
  fnval: number;
}): Promise<PlayUrlResponse> {
  const params = new URLSearchParams({
    cid: args.cid,
    qn: String(args.qn),
    fnval: String(args.fnval),
    fnver: '0',
    fourk: '1',
    platform: 'html5',
    high_quality: '1',
    otype: 'json',
  });

  if (args.bvid) params.set('bvid', args.bvid);
  if (args.aid) params.set('aid', args.aid);

  const url = `https://api.bilibili.com/x/player/playurl?${params.toString()}`;
  debugLog('🎬 请求播放地址 (通过Background):', url);

  const response: any = await chrome.runtime.sendMessage({
    type: 'FETCH_PLAYURL_API',
    data: { url, bvid: args.bvid },
  });

  if (!response?.success) {
    throw new Error(response?.error || '获取播放地址失败');
  }

  return response.data as PlayUrlResponse;
}

export async function requestDownloadUrl(url: string, filename: string): Promise<number> {
  const normalizedUrl = normalizeMediaUrl(url);
  if (!normalizedUrl) throw new Error('下载地址为空');

  const response: any = await chrome.runtime.sendMessage({
    type: 'DOWNLOAD_URL',
    data: { url: normalizedUrl, filename },
  });

  if (!response?.success) {
    throw new Error(response?.error || '发起下载失败');
  }

  const downloadId = Number(response?.data?.downloadId);
  if (!downloadId) {
    // 兼容旧实现：如果 background 没回 downloadId，也不阻断流程
    return 0;
  }

  return downloadId;
}

export function getProgressiveUrls(resp: PlayUrlResponse) {
  const urls = (resp.data?.durl || [])
    .map((item) => normalizeMediaUrl(pickProgressiveUrl(item)))
    .filter(Boolean);
  return urls;
}

export function getDashUrls(resp: PlayUrlResponse) {
  const videoUrl = normalizeMediaUrl(pickBestDashUrl(resp.data?.dash?.video));
  const audioUrl = normalizeMediaUrl(pickBestDashUrl(resp.data?.dash?.audio));
  return { videoUrl, audioUrl };
}
