import { getModuleConfig, updateModuleConfig } from '@/utils/storage';

// 模块定义（与实际模块保持一致）
const MODULES = [
  {
    id: 'subtitle-copy',
    name: '复制字幕',
    icon: '📋',
    description: '一键复制当前视频的字幕到剪贴板',
  },
  {
    id: 'batch-download',
    name: '批量下载字幕',
    icon: '📥',
    description: '选择多个分P并批量下载字幕TXT文件',
  },
];

/**
 * 渲染模块列表
 */
async function renderModuleList() {
  const moduleList = document.getElementById('moduleList');
  if (!moduleList) return;

  const config = await getModuleConfig();

  moduleList.innerHTML = '';

  if (MODULES.length === 0) {
    moduleList.innerHTML = `
      <div class="empty-state">
        <p>暂无可用模块</p>
      </div>
    `;
    return;
  }

  MODULES.forEach((module) => {
    const isEnabled = config[module.id]?.enabled ?? true;

    const item = document.createElement('div');
    item.className = 'module-item';

    item.innerHTML = `
      <div style="display: flex; align-items: flex-start;">
        <div class="module-icon">${module.icon}</div>
        <div class="module-info">
          <div class="module-name">${module.name}</div>
          <div class="module-description">${module.description}</div>
        </div>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          ${isEnabled ? 'checked' : ''}
          data-module-id="${module.id}"
        />
        <span class="slider"></span>
      </label>
    `;

    moduleList.appendChild(item);

    // 监听开关变化
    const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const moduleId = target.dataset.moduleId!;
      const enabled = target.checked;

      try {
        await updateModuleConfig(moduleId, enabled);
        showStatusBar(
          enabled ? `已启用「${module.name}」` : `已禁用「${module.name}」`,
          'success'
        );
      } catch (error) {
        console.error('更新配置失败:', error);
        showStatusBar('更新配置失败，请重试', 'error');
        // 恢复原状态
        target.checked = !enabled;
      }
    });
  });
}

/**
 * 显示状态提示
 */
function showStatusBar(message: string, type: 'success' | 'error' = 'success') {
  // 移除旧的状态条
  const oldBar = document.querySelector('.status-bar');
  if (oldBar) {
    oldBar.remove();
  }

  const statusBar = document.createElement('div');
  statusBar.className = `status-bar ${type}`;
  statusBar.textContent = message;

  const cardBody = document.querySelector('.card-body');
  if (cardBody) {
    cardBody.appendChild(statusBar);

    // 3秒后自动消失
    setTimeout(() => {
      statusBar.style.opacity = '0';
      statusBar.style.transition = 'opacity 0.3s';
      setTimeout(() => statusBar.remove(), 300);
    }, 3000);
  }
}

// 页面加载时渲染
document.addEventListener('DOMContentLoaded', () => {
  renderModuleList();
});
