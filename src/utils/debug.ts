/**
 * 调试配置
 * 在开发时设置为 true，生产环境设置为 false
 */
const DEBUG = false;

/**
 * 调试日志输出
 */
export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * 调试信息输出
 */
export function debugInfo(...args: any[]) {
  if (DEBUG) {
    console.info(...args);
  }
}

/**
 * 调试警告输出
 */
export function debugWarn(...args: any[]) {
  if (DEBUG) {
    console.warn(...args);
  }
}

/**
 * 错误日志（始终输出）
 */
export function errorLog(...args: any[]) {
  console.error(...args);
}
