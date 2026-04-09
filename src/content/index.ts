import { buttonManager } from '@/core/ButtonManager';
import { domInjector } from '@/core/DOMInjector';
import { isVideoPage } from '@/utils/dom';

// 导入模块
import { subtitleCopyModule } from '@/modules/subtitle-copy';
import { batchDownloadModule } from '@/modules/batch-download';
import { videoDownloadModule } from '@/modules/video-download';
import { batchVideoDownloadModule } from '@/modules/batch-video-download';

console.log('🚀 Bilibili 自定义按钮扩展已加载');

/**
 * 初始化扩展
 */
async function init() {
  if (!isVideoPage()) {
    console.log('⏭️  非视频页面，跳过初始化');
    return;
  }

  console.log('📺 检测到视频页面，开始初始化');

  try {
    // 注册模块
    buttonManager.register(subtitleCopyModule);
    buttonManager.register(batchDownloadModule);
    buttonManager.register(videoDownloadModule);
    buttonManager.register(batchVideoDownloadModule);

    // 注入按钮
    const container = await domInjector.inject();
    if (container) {
      await buttonManager.render(container);
      console.log('✅ 按钮渲染完成');
    } else {
      console.warn('⚠️  未能找到合适的注入位置');
    }
  } catch (error) {
    console.error('❌ 初始化失败:', error);
  }
}

/**
 * 清理并重新初始化
 */
async function reinit() {
  console.log('🔄 页面变化，重新初始化');

  // 清理旧的容器
  domInjector.remove();

  // 重新初始化
  await init();
}

// 首次加载
init();

// 监听 SPA 路由变化
domInjector.observePageChanges(() => {
  if (isVideoPage()) {
    reinit();
  } else {
    domInjector.remove();
  }
});
