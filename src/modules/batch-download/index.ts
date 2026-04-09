import type { ButtonModule } from '@/core/types';
import { getVideoPageList, getVideoSubtitleText, getVideoTitle } from '@/utils/api';
import { showToast, downloadTextFile } from '@/utils/dom';
import { createBatchDownloadDialog } from './dialog';
import { openBatchProgressDialog } from '@/utils/batch-progress';

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
    icon: '📥',
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
      const sanitizedTitle = videoTitle.replace(/[\\/:*?"<>|]/g, '_');

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

          const sanitizedPart = String(page.part || '').replace(/[\\/:*?"<>|]/g, '_');
          const filename = `${sanitizedTitle}_P${page.page}_${sanitizedPart || 'part'}.txt`;
          downloadTextFile(filename, subtitleText);

          await new Promise((resolve) => setTimeout(resolve, 250));
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
