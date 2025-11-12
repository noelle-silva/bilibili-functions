import type { ModuleConfig } from '@/core/types';

const STORAGE_KEYS = {
  MODULE_CONFIG: 'module_config',
} as const;

/**
 * 获取模块配置
 */
export async function getModuleConfig(): Promise<ModuleConfig> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.MODULE_CONFIG);
  return result[STORAGE_KEYS.MODULE_CONFIG] || {};
}

/**
 * 保存模块配置
 */
export async function saveModuleConfig(config: ModuleConfig): Promise<void> {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.MODULE_CONFIG]: config,
  });
}

/**
 * 更新单个模块的配置
 */
export async function updateModuleConfig(
  moduleId: string,
  enabled: boolean,
  settings?: Record<string, any>
): Promise<void> {
  const config = await getModuleConfig();
  config[moduleId] = {
    enabled,
    settings: settings || config[moduleId]?.settings || {},
  };
  await saveModuleConfig(config);
}

/**
 * 获取单个模块的启用状态
 */
export async function isModuleEnabled(moduleId: string): Promise<boolean> {
  const config = await getModuleConfig();
  return config[moduleId]?.enabled ?? true; // 默认启用
}
