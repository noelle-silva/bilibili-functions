import type { ButtonModule } from '@/core/types';
import { getVideoPageList, getVideoSubtitleText, getVideoTitle } from '@/utils/api';
import { showToast, downloadTextFile } from '@/utils/dom';
import { createBatchDownloadDialog } from './dialog';

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
      showToast(`开始下载 ${selectedPages.length} 个字幕...`, 'info');

      const videoTitle = videoInfo.title || getVideoTitle();
      let successCount = 0;
      let failCount = 0;

      for (const page of selectedPages) {
        try {
          const subtitleText = await getVideoSubtitleText(
            page.cid,
            videoInfo.bvid,
            videoInfo.aid
          );

          // 生成文件名
          const sanitizedTitle = videoTitle.replace(/[\\/:*?"<>|]/g, '_');
          const sanitizedPart = page.part.replace(/[\\/:*?"<>|]/g, '_');
          const filename = `${sanitizedTitle}_P${page.page}_${sanitizedPart}.txt`;

          // 下载文件
          downloadTextFile(filename, subtitleText);

          successCount++;

          // 添加延迟，避免下载过快
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`下载 P${page.page} 字幕失败:`, error);
          failCount++;
        }
      }

      // 显示结果
      if (failCount === 0) {
        showToast(`✅ 成功下载 ${successCount} 个字幕文件`, 'success');
      } else {
        showToast(
          `⚠️ 下载完成：成功 ${successCount} 个，失败 ${failCount} 个`,
          'info'
        );
      }
    } catch (error: any) {
      console.error('批量下载失败:', error);
      showToast(`❌ ${error.message || '批量下载失败'}`, 'error');
    }
  },

  enabled: true,
};
