import type { ButtonModule } from '@/core/types';
import { getVideoPageList, getVideoTitle } from '@/utils/api';
import { showToast } from '@/utils/dom';
import { errorLog } from '@/utils/debug';
import { createBatchDownloadDialog } from '@/modules/batch-download/dialog';
import { openBatchProgressDialog } from '@/utils/batch-progress';
import { downloadPartVideo } from '@/utils/part-video-download';
import {
  sanitizeFilename,
} from '@/utils/video-download';

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
    icon: 'video-batch-download',
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

          if (result.downloadIds.length > 0) {
            return { completion: result.completion };
          }
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
