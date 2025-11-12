import type { ButtonModule } from '@/core/types';
import { getVideoPageList, getVideoSubtitleText } from '@/utils/api';
import { showToast, copyToClipboard } from '@/utils/dom';

/**
 * 字幕复制模块
 * 功能：复制当前视频的字幕到剪贴板
 */
export const subtitleCopyModule: ButtonModule = {
  id: 'subtitle-copy',
  name: '复制字幕',
  description: '复制当前视频的字幕到剪贴板',

  button: {
    text: '复制字幕',
    icon: '📋',
    position: 100,
  },

  async execute(context) {
    try {
      const { videoInfo } = context;

      // 显示加载提示
      showToast('正在获取字幕...', 'info');

      // 如果没有 cid，先获取
      let cid = videoInfo.cid;
      if (!cid) {
        const pageList = await getVideoPageList(videoInfo.bvid, videoInfo.aid);
        const currentPart = videoInfo.part || 1;
        const pageInfo = pageList.find(p => p.page === currentPart);

        if (!pageInfo) {
          throw new Error('无法获取视频信息');
        }

        cid = pageInfo.cid;
      }

      // 获取字幕文本
      const subtitleText = await getVideoSubtitleText(cid, videoInfo.bvid, videoInfo.aid);

      if (!subtitleText || subtitleText.trim() === '') {
        throw new Error('字幕内容为空');
      }

      // 复制到剪贴板
      await copyToClipboard(subtitleText);

      // 显示成功提示
      const lineCount = subtitleText.split('\n').length;
      showToast(`✅ 已复制 ${lineCount} 行字幕到剪贴板`, 'success');
    } catch (error: any) {
      console.error('复制字幕失败:', error);
      showToast(`❌ ${error.message || '复制字幕失败'}`, 'error');
    }
  },

  enabled: true,
};
