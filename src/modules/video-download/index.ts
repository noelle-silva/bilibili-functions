import type { ButtonModule } from '@/core/types';
import { getCurrentPartTitle, getVideoTitle } from '@/utils/api';
import { showToast } from '@/utils/dom';
import { debugLog, errorLog } from '@/utils/debug';

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

type PlayUrlResponse = {
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

function sanitizeFilename(name: string) {
  return (name || 'bilibili-video')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

function pickFirstUrl(item?: PlayUrlDurlItem) {
  if (!item) return '';
  return item.url || item.backup_url?.[0] || '';
}

function pickBestDashUrl(streams?: PlayUrlDashStream[]) {
  if (!streams || streams.length === 0) return '';
  const sorted = [...streams].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
  const best = sorted[0];
  return best.baseUrl || best.base_url || '';
}

async function fetchPlayUrl(
  args: { bvid?: string; aid?: string; cid: string; qn: number; fnval: number }
): Promise<PlayUrlResponse> {
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

async function downloadByUrl(url: string, filename: string) {
  const response: any = await chrome.runtime.sendMessage({
    type: 'DOWNLOAD_URL',
    data: { url, filename },
  });

  if (!response?.success) {
    throw new Error(response?.error || '发起下载失败');
  }
}

/**
 * 视频下载模块
 * 功能：一键发起当前分P的视频下载
 *
 * 说明：
 * - 优先尝试拿到单文件（durl）下载链接
 * - 若只返回 DASH（分离音视频），会分别下载 video/audio 两个文件
 */
export const videoDownloadModule: ButtonModule = {
  id: 'video-download',
  name: '下载视频',
  description: '一键下载当前分P视频（可能分离音视频）',

  button: {
    text: '下载视频',
    icon: '🎬',
    position: 300,
  },

  async execute(context) {
    try {
      const { videoInfo } = context;

      if (!videoInfo.cid) {
        throw new Error('无法获取视频 CID，请刷新页面后重试');
      }

      const baseTitle = sanitizeFilename(getVideoTitle() || videoInfo.title || 'bilibili-video');
      const partTitle = sanitizeFilename(getCurrentPartTitle() || '');
      const partSuffix = videoInfo.part ? `P${videoInfo.part}` : 'P1';
      const namePrefix =
        partTitle && partTitle !== baseTitle
          ? `${baseTitle}_${partSuffix}_${partTitle}`
          : `${baseTitle}_${partSuffix}`;

      showToast('正在获取下载地址...', 'info');

      // 1) 尝试获取可直接下载的单文件链接（durl）
      const progressive = await fetchPlayUrl({
        cid: videoInfo.cid,
        bvid: videoInfo.bvid,
        aid: videoInfo.aid,
        qn: 80,
        fnval: 0,
      });

      if (progressive.code !== 0) {
        throw new Error(progressive.message || '获取播放地址失败');
      }

      const durl = progressive.data?.durl;
      const directUrl = pickFirstUrl(durl?.[0]);
      if (directUrl) {
        await downloadByUrl(directUrl, `${namePrefix}.mp4`);
        showToast('✅ 已开始下载视频', 'success');
        return;
      }

      // 2) 退一步：DASH（通常分离音视频）
      const dashResp = await fetchPlayUrl({
        cid: videoInfo.cid,
        bvid: videoInfo.bvid,
        aid: videoInfo.aid,
        qn: 80,
        fnval: 16,
      });

      if (dashResp.code !== 0) {
        throw new Error(dashResp.message || '获取播放地址失败');
      }

      const videoUrl = pickBestDashUrl(dashResp.data?.dash?.video);
      const audioUrl = pickBestDashUrl(dashResp.data?.dash?.audio);

      if (!videoUrl && !audioUrl) {
        throw new Error('未能找到可下载的视频/音频地址（可能需要登录或该视频受限）');
      }

      showToast('⚠️ 仅拿到 DASH：将下载音视频两个文件', 'info');

      if (videoUrl) {
        await downloadByUrl(videoUrl, `${namePrefix}_video.m4s`);
      }
      if (audioUrl) {
        await downloadByUrl(audioUrl, `${namePrefix}_audio.m4s`);
      }

      showToast('✅ 已开始下载（音/视频分开）', 'success');
    } catch (error: any) {
      errorLog('❌ 下载视频失败:', error);
      showToast(`❌ ${error.message || '下载视频失败'}`, 'error');
    }
  },

  enabled: true,
};

