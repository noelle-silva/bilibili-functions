import type { ButtonModule } from '@/core/types';
import { getVideoTitle } from '@/utils/api';
import { showToast } from '@/utils/dom';
import { errorLog } from '@/utils/debug';
import { sanitizeFilename } from '@/utils/video-download';
import { buildVideoCommentsTxtFiles } from '@/utils/comment-export';
import { downloadTextThroughBackground } from '@/utils/text-download';

export const commentDownloadModule: ButtonModule = {
  id: 'comment-download',
  name: '下载评论',
  description: '导出当前视频评论为 TXT（含楼中楼，过大自动拆分）',

  button: {
    text: '下载评论',
    icon: 'comment-download',
    position: 250,
  },

  async execute(context) {
    try {
      const { videoInfo } = context;
      showToast('正在抓取评论...（全量含楼中楼，会比较慢）', 'info');

      const pageUrl = window.location.href;
      const titleFromDom = getVideoTitle();
      const videoTitle = titleFromDom || videoInfo.title || 'bilibili-video';
      const safeTitle = sanitizeFilename(videoTitle);

      const result = await buildVideoCommentsTxtFiles({
        aid: videoInfo.aid,
        bvid: videoInfo.bvid,
        pageUrl,
        videoTitle,
        sort: 'time',
        subConcurrency: 4,
      });

      const fileCount = result.files.length;
      for (const f of result.files) {
        const filename =
          fileCount === 1
            ? `${safeTitle}_评论.txt`
            : `${safeTitle}_评论_${String(f.index).padStart(2, '0')}.txt`;

        await downloadTextThroughBackground(filename, f.content, 'comment');
        await new Promise((r) => setTimeout(r, 120));
      }

      showToast(
        `✅ 已开始下载评论（总评论 ${result.stats.fetchedTotalCount} / 约 ${result.stats.expectedTotalCount}，${fileCount} 个文件）`,
        'success'
      );
    } catch (error: any) {
      errorLog('❌ 下载评论失败:', error);
      showToast(`❌ ${error.message || '下载评论失败'}`, 'error');
    }
  },

  enabled: true,
};
