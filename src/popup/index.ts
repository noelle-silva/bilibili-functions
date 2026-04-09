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
  {
    id: 'video-download',
    name: '下载视频',
    icon: '🎬',
    description: '一键下载当前分P视频（可能分离音视频）',
  },
];

/**
 * 更新统计信息
 */
async function updateStats() {
  const config = await getModuleConfig();

  const totalModules = MODULES.length;
  let enabledModules = 0;

  MODULES.forEach((module) => {
    const isEnabled = config[module.id]?.enabled ?? true;
    if (isEnabled) enabledModules++;
  });

  const disabledModules = totalModules - enabledModules;

  // 更新 DOM
  const totalEl = document.getElementById('totalModules');
  const enabledEl = document.getElementById('enabledModules');
  const disabledEl = document.getElementById('disabledModules');

  if (totalEl) totalEl.textContent = totalModules.toString();
  if (enabledEl) enabledEl.textContent = enabledModules.toString();
  if (disabledEl) disabledEl.textContent = disabledModules.toString();
}

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
      <div class="module-info">
        <div class="module-icon">${module.icon}</div>
        <div class="module-details">
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
        await updateStats();
        showStatusMessage(
          enabled ? `已启用「${module.name}」` : `已禁用「${module.name}」`,
          'success'
        );
      } catch (error) {
        console.error('更新配置失败:', error);
        showStatusMessage('更新配置失败', 'error');
        // 恢复原状态
        target.checked = !enabled;
      }
    });
  });

  // 更新统计信息
  await updateStats();
}

/**
 * 显示状态消息
 */
function showStatusMessage(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info'
) {
  const statusEl = document.getElementById('statusMessage');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status-message ${type === 'error' ? 'warning' : type}`;
  statusEl.style.display = 'block';

  // 2秒后自动隐藏
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 2000);
}

/**
 * 检查当前标签页是否在 Bilibili 视频页面
 */
async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const headerDesc = document.getElementById('headerDesc');

    if (tab?.url?.includes('bilibili.com/video/')) {
      if (headerDesc) {
        headerDesc.textContent = '当前在 Bilibili 视频页面 ✓';
      }
      showStatusMessage('当前页面已启用自定义按钮', 'success');
    } else {
      if (headerDesc) {
        headerDesc.textContent = '请在 Bilibili 视频页面使用';
      }
    }
  } catch (error) {
    console.error('检查当前页面失败:', error);
  }
}

/**
 * 打开设置页面
 */
function openSettingsPage() {
  chrome.runtime.openOptionsPage();
}

/**
 * 加载版本信息
 */
function loadVersion() {
  const versionEl = document.getElementById('version');
  if (versionEl) {
    const manifestData = chrome.runtime.getManifest();
    versionEl.textContent = `v${manifestData.version || '1.0.0'}`;
  }
}

/**
 * 初始化事件监听
 */
function initEventListeners() {
  // 打开设置页面
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  openSettingsBtn?.addEventListener('click', openSettingsPage);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
  loadVersion();
  await checkCurrentPage();
  await renderModuleList();
  initEventListeners();
});
