import type { ButtonModule } from '@/core/types';
import { getCurrentPartTitle, getVideoTitle } from '@/utils/api';
import { showToast } from '@/utils/dom';
import { errorLog } from '@/utils/debug';
import {
  fetchPlayUrlThroughBackground,
  getDashUrls,
  getProgressiveUrls,
  inferExtension,
  requestDownloadUrl,
  sanitizeFilename,
} from '@/utils/video-download';

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
      const progressive = await fetchPlayUrlThroughBackground({
        cid: videoInfo.cid,
        bvid: videoInfo.bvid,
        aid: videoInfo.aid,
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
          await requestDownloadUrl(progressiveUrls[0], `${namePrefix}${ext}`);
        } else {
          for (let i = 0; i < progressiveUrls.length; i++) {
            const url = progressiveUrls[i];
            const ext = inferExtension(url, '.mp4');
            await requestDownloadUrl(url, `${namePrefix}_seg${i + 1}${ext}`);
          }
        }
        showToast('✅ 已开始下载视频', 'success');
        return;
      }

      // 2) 退一步：DASH（通常分离音视频）
      const dashResp = await fetchPlayUrlThroughBackground({
        cid: videoInfo.cid,
        bvid: videoInfo.bvid,
        aid: videoInfo.aid,
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

      showToast('⚠️ 仅拿到 DASH：将下载音视频两个文件', 'info');

      if (videoUrl) {
        await requestDownloadUrl(videoUrl, `${namePrefix}_video.m4s`);
      }
      if (audioUrl) {
        await requestDownloadUrl(audioUrl, `${namePrefix}_audio.m4s`);
      }

      showToast('✅ 已开始下载（音/视频分开）', 'success');
    } catch (error: any) {
      errorLog('❌ 下载视频失败:', error);
      showToast(`❌ ${error.message || '下载视频失败'}`, 'error');
    }
  },

  enabled: true,
};
