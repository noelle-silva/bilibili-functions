import type { ButtonModule } from '@/core/types';
import { getVideoSubtitleText } from '@/utils/api';
import { showToast, copyToClipboard } from '@/utils/dom';
import { debugLog, errorLog } from '@/utils/debug';

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
      debugLog('📺 视频信息:', videoInfo);

      // 验证必要的视频信息
      if (!videoInfo.cid) {
        throw new Error('无法获取视频 CID，请刷新页面后重试');
      }

      // 显示加载提示
      showToast('正在获取字幕...', 'info');

      // 获取字幕文本
      const subtitleText = await getVideoSubtitleText(
        videoInfo.cid,
        videoInfo.bvid,
        videoInfo.aid
      );

      if (!subtitleText || subtitleText.trim() === '') {
        throw new Error('字幕内容为空');
      }

      // 复制到剪贴板
      await copyToClipboard(subtitleText);

      // 显示成功提示
      const lineCount = subtitleText.split('\n').length;
      showToast(`✅ 已复制 ${lineCount} 行字幕到剪贴板`, 'success');
    } catch (error: any) {
      errorLog('❌ 复制字幕失败:', error);
      showToast(`❌ ${error.message || '复制字幕失败'}`, 'error');
    }
  },

  enabled: true,
};
