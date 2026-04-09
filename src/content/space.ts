import { observeUrlChange, isSpaceVideoPage } from '@/utils/dom';
import { initUpSubtitleBatch } from '@/modules/up-subtitle-batch';
import { debugLog } from '@/utils/debug';
import { isModuleEnabled } from '@/utils/storage';

const MODULE_ID = 'up-subtitle-batch';

let cleanup: (() => void) | null = null;

async function mount() {
  try {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    if (!isSpaceVideoPage()) return;

    const enabled = await isModuleEnabled(MODULE_ID);
    if (!enabled) return;

    cleanup = initUpSubtitleBatch();
  } catch (err) {
    debugLog('❌ Space content mount 失败:', err);
  }
}

debugLog('🚀 Bilibili 自定义按钮扩展：Space 脚本已加载');

mount();

observeUrlChange(() => {
  void mount();
});

