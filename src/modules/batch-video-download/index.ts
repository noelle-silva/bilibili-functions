import type { ButtonModule } from '@/core/types';
import { getVideoPageList, getVideoTitle } from '@/utils/api';
import { showToast } from '@/utils/dom';
import { errorLog } from '@/utils/debug';
import { createBatchDownloadDialog } from '@/modules/batch-download/dialog';
import { openBatchProgressDialog } from '@/utils/batch-progress';
import { waitForDownloadCompletion } from '@/utils/download-tracker';
import {
  fetchPlayUrlThroughBackground,
  getDashUrls,
  getProgressiveUrls,
  inferExtension,
  requestDownloadUrl,
  sanitizeFilename,
} from '@/utils/video-download';

async function downloadPartVideo(args: {
  cid: string;
  bvid?: string;
  aid?: string;
  filenamePrefix: string;
}) {
  const downloadIds: number[] = [];

  // 1) Progressive（durl）优先：更可能是“单文件可播”的直链
  const progressive = await fetchPlayUrlThroughBackground({
    cid: args.cid,
    bvid: args.bvid,
    aid: args.aid,
    qn: 80,
    fnval: 0,
  });

  if (progressive.code !== 0) {
    throw new Error(progressive.message || '获取播放地址失败');
  }

  const progressiveUrls = getProgressiveUrls(progressive);
  if (progressiveUrls.length > 0) {
    if (progressiveUrls.length === 1) {
      const ext = inferExtension(progressiveUrls[0], '.mp4');
      const id = await requestDownloadUrl(progressiveUrls[0], `${args.filenamePrefix}${ext}`);
      if (id) downloadIds.push(id);
    } else {
      for (let i = 0; i < progressiveUrls.length; i++) {
        const url = progressiveUrls[i];
        const ext = inferExtension(url, '.mp4');
        const id = await requestDownloadUrl(url, `${args.filenamePrefix}_seg${i + 1}${ext}`);
        if (id) downloadIds.push(id);
      }
    }
    return {
      mode: 'progressive' as const,
      downloadIds,
      completion: Promise.all(downloadIds.map((id) => waitForDownloadCompletion(id))).then(() => {}),
    };
  }

  // 2) DASH：分离音视频
  const dashResp = await fetchPlayUrlThroughBackground({
    cid: args.cid,
    bvid: args.bvid,
    aid: args.aid,
    qn: 80,
    fnval: 16,
  });

  if (dashResp.code !== 0) {
    throw new Error(dashResp.message || '获取播放地址失败');
  }

  const { videoUrl, audioUrl } = getDashUrls(dashResp);

  if (!videoUrl && !audioUrl) {
    throw new Error('未能找到可下载的视频/音频地址（可能需要登录或该视频受限）');
  }

  if (videoUrl) {
    const id = await requestDownloadUrl(videoUrl, `${args.filenamePrefix}_video.m4s`);
    if (id) downloadIds.push(id);
  }
  if (audioUrl) {
    const id = await requestDownloadUrl(audioUrl, `${args.filenamePrefix}_audio.m4s`);
    if (id) downloadIds.push(id);
  }

  return {
    mode: 'dash' as const,
    downloadIds,
    completion: Promise.all(downloadIds.map((id) => waitForDownloadCompletion(id))).then(() => {}),
  };
}

/**
 * 批量下载分P视频模块
 * 功能：选择多个分P并批量发起视频下载
 */
export const batchVideoDownloadModule: ButtonModule = {
  id: 'batch-video-download',
  name: '批量下载视频',
  description: '选择多个分P并批量下载视频（可能分离音视频）',

  button: {
    text: '批量下载视频',
    position: 400,
  },

  async execute(context) {
    try {
      const { videoInfo } = context;

      showToast('正在获取分P列表...', 'info');
      const pageList = await getVideoPageList(videoInfo.bvid, videoInfo.aid);

      if (pageList.length === 0) {
        showToast('该视频没有分P信息', 'error');
        return;
      }

      const selectedPages = await createBatchDownloadDialog(pageList);
      if (selectedPages.length === 0) return;

      showToast(`开始处理 ${selectedPages.length} 个视频任务...`, 'info');

      const baseTitle = sanitizeFilename(getVideoTitle() || 'bilibili-video');

      openBatchProgressDialog({
        title: '批量下载视频 - 任务进度',
        items: selectedPages.map((page) => ({
          id: String(page.cid),
          label: `P${page.page}｜${page.part}`,
          meta: page,
        })),
        async runItem(item) {
          const page = item.meta as any;
          const partTitle = sanitizeFilename(page.part || '');
          const filenamePrefix = partTitle
            ? `${baseTitle}_P${page.page}_${partTitle}`
            : `${baseTitle}_P${page.page}`;

          const result = await downloadPartVideo({
            cid: String(page.cid),
            bvid: videoInfo.bvid,
            aid: videoInfo.aid,
            filenamePrefix,
          });

          // 轻微节流：下一项延迟一下再启动（不等下载完成）
          await new Promise((resolve) => setTimeout(resolve, 250));

          return { completion: result.completion };
        },
        autoStart: true,
      });
    } catch (error: any) {
      errorLog('❌ 批量下载视频失败:', error);
      showToast(`❌ ${error.message || '批量下载视频失败'}`, 'error');
    }
  },

  enabled: true,
};
