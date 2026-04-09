import type { ButtonModule } from '@/core/types';
import { getVideoPageList, getVideoSubtitleText, getVideoTitle } from '@/utils/api';
import { showToast } from '@/utils/dom';
import { createBatchDownloadDialog } from './dialog';
import { openBatchProgressDialog } from '@/utils/batch-progress';
import { downloadTextThroughBackground } from '@/utils/text-download';
import { waitForDownloadCompletion } from '@/utils/download-tracker';
import { sanitizeFilename } from '@/utils/video-download';

/**
 * 批量下载字幕模块
 * 功能：选择多个分P并批量下载字幕文件
 */
export const batchDownloadModule: ButtonModule = {
  id: 'batch-download',
  name: '批量下载字幕',
  description: '选择多个分P并批量下载字幕TXT文件',

  button: {
    text: '批量下载',
    position: 200,
  },

  async execute(context) {
    try {
      const { videoInfo } = context;

      // 获取分P列表
      showToast('正在获取分P列表...', 'info');
      const pageList = await getVideoPageList(videoInfo.bvid, videoInfo.aid);

      if (pageList.length === 0) {
        showToast('该视频没有分P信息', 'error');
        return;
      }

      // 显示选择对话框
      const selectedPages = await createBatchDownloadDialog(pageList);

      if (selectedPages.length === 0) {
        return; // 用户取消了
      }

      // 批量下载
      showToast(`开始处理 ${selectedPages.length} 个字幕任务...`, 'info');

      const videoTitle = videoInfo.title || getVideoTitle();
      const baseTitle = sanitizeFilename(videoTitle);

      openBatchProgressDialog({
        title: '批量下载字幕 - 任务进度',
        items: selectedPages.map((page) => ({
          id: String(page.cid),
          label: `P${page.page}｜${page.part}`,
          meta: page,
        })),
        async runItem(item) {
          const page = item.meta as any;
          const subtitleText = await getVideoSubtitleText(page.cid, videoInfo.bvid, videoInfo.aid);

          const partTitle = sanitizeFilename(String(page.part || ''));
          const trimmedPart = partTitle && partTitle !== baseTitle ? partTitle : '';
          const filename = trimmedPart ? `P${page.page}_${trimmedPart}.txt` : `${baseTitle}_P${page.page}.txt`;
          const downloadId = await downloadTextThroughBackground(filename, subtitleText);

          await new Promise((resolve) => setTimeout(resolve, 250));

          if (downloadId) {
            return { completion: waitForDownloadCompletion(downloadId) };
          }
        },
        autoStart: true,
      });
    } catch (error: any) {
      console.error('批量下载失败:', error);
      showToast(`❌ ${error.message || '批量下载失败'}`, 'error');
    }
  },

  enabled: true,
};
