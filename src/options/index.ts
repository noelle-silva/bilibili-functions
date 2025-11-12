import { getModuleConfig, updateModuleConfig, saveModuleConfig } from '@/utils/storage';
import type { ModuleConfig } from '@/core/types';

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
        await updateStats();
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

  // 更新统计信息
  await updateStats();
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

/**
 * 显示确认对话框
 */
function showConfirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  isDanger = false
): void {
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal show';

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${message}</div>
      <div class="modal-footer">
        <button class="modal-btn" id="cancelBtn">取消</button>
        <button class="modal-btn ${isDanger ? 'danger' : 'primary'}" id="confirmBtn">确定</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 绑定事件
  const cancelBtn = modal.querySelector('#cancelBtn');
  const confirmBtn = modal.querySelector('#confirmBtn');

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  cancelBtn?.addEventListener('click', closeModal);
  confirmBtn?.addEventListener('click', () => {
    onConfirm();
    closeModal();
  });

  // 点击背景关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

/**
 * 全部启用
 */
async function enableAll() {
  try {
    const config = await getModuleConfig();

    MODULES.forEach((module) => {
      config[module.id] = {
        enabled: true,
        settings: config[module.id]?.settings || {},
      };
    });

    await saveModuleConfig(config);
    await renderModuleList();
    showStatusBar('✅ 已启用所有模块', 'success');
  } catch (error) {
    console.error('启用所有模块失败:', error);
    showStatusBar('操作失败，请重试', 'error');
  }
}

/**
 * 全部禁用
 */
async function disableAll() {
  showConfirmDialog(
    '确认禁用所有模块？',
    '禁用后，所有自定义按钮将不会在 Bilibili 视频页面显示。',
    async () => {
      try {
        const config = await getModuleConfig();

        MODULES.forEach((module) => {
          config[module.id] = {
            enabled: false,
            settings: config[module.id]?.settings || {},
          };
        });

        await saveModuleConfig(config);
        await renderModuleList();
        showStatusBar('⏸️ 已禁用所有模块', 'success');
      } catch (error) {
        console.error('禁用所有模块失败:', error);
        showStatusBar('操作失败，请重试', 'error');
      }
    }
  );
}

/**
 * 重置设置
 */
async function resetSettings() {
  showConfirmDialog(
    '确认重置所有设置？',
    '这将清除所有配置，恢复到默认状态（所有模块启用）。此操作不可恢复！',
    async () => {
      try {
        await saveModuleConfig({});
        await renderModuleList();
        showStatusBar('🔄 设置已重置', 'success');
      } catch (error) {
        console.error('重置设置失败:', error);
        showStatusBar('操作失败，请重试', 'error');
      }
    },
    true
  );
}

/**
 * 导出配置
 */
async function exportConfig() {
  try {
    const config = await getModuleConfig();

    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      config,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `bilibili-buttons-config-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showStatusBar('📤 配置已导出', 'success');
  } catch (error) {
    console.error('导出配置失败:', error);
    showStatusBar('导出失败，请重试', 'error');
  }
}

/**
 * 导入配置
 */
function importConfig() {
  const fileInput = document.getElementById('importFile') as HTMLInputElement;
  if (!fileInput) return;

  fileInput.click();
}

/**
 * 处理导入的文件
 */
async function handleImportFile(file: File) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 验证数据格式
    if (!data.config || typeof data.config !== 'object') {
      throw new Error('配置文件格式不正确');
    }

    showConfirmDialog(
      '确认导入配置？',
      `将导入配置文件（版本: ${data.version || '未知'}）。这将覆盖当前所有设置！`,
      async () => {
        try {
          await saveModuleConfig(data.config as ModuleConfig);
          await renderModuleList();
          showStatusBar('📥 配置已导入', 'success');
        } catch (error) {
          console.error('保存导入的配置失败:', error);
          showStatusBar('导入失败，请重试', 'error');
        }
      },
      true
    );
  } catch (error) {
    console.error('读取配置文件失败:', error);
    showStatusBar('❌ 配置文件格式不正确', 'error');
  }
}

/**
 * 加载版本信息
 */
function loadVersion() {
  const versionEl = document.getElementById('version');
  if (versionEl) {
    // 从 manifest 获取版本（如果可用）
    const manifestData = chrome.runtime.getManifest();
    versionEl.textContent = manifestData.version || '1.0.0';
  }
}

/**
 * 初始化事件监听
 */
function initEventListeners() {
  // 全部启用
  const enableAllBtn = document.getElementById('enableAllBtn');
  enableAllBtn?.addEventListener('click', enableAll);

  // 全部禁用
  const disableAllBtn = document.getElementById('disableAllBtn');
  disableAllBtn?.addEventListener('click', disableAll);

  // 重置设置
  const resetBtn = document.getElementById('resetBtn');
  resetBtn?.addEventListener('click', resetSettings);

  // 导出配置
  const exportBtn = document.getElementById('exportBtn');
  exportBtn?.addEventListener('click', exportConfig);

  // 导入配置
  const importBtn = document.getElementById('importBtn');
  importBtn?.addEventListener('click', importConfig);

  // 文件上传处理
  const fileInput = document.getElementById('importFile') as HTMLInputElement;
  fileInput?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      handleImportFile(file);
      // 重置文件输入，以便可以重复选择同一文件
      target.value = '';
    }
  });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  renderModuleList();
  loadVersion();
  initEventListeners();
});
