import type { SubtitleInfo } from '@/core/types';
import { debugLog } from './debug';

/**
 * 从页面的播放器数据中提取字幕信息
 * 检查页面全局变量，并验证是否为当前视频
 */
export async function getSubtitleFromPage(currentBvid: string, currentCid: string): Promise<SubtitleInfo[]> {
  console.log('🔍 检查页面全局变量...', { currentBvid, currentCid });

  // 方案1: 从 window.__INITIAL_STATE__ 获取
  const initialState = (window as any).__INITIAL_STATE__;
  if (initialState?.videoData) {
    const bvid = initialState.videoData.bvid;
    const cid = initialState.videoData.cid;

    console.log('📦 __INITIAL_STATE__ 中的视频信息:', { bvid, cid });

    // 验证是否为当前视频
    if (bvid === currentBvid && String(cid) === String(currentCid)) {
      const subtitles = initialState.videoData.subtitle?.list || [];
      if (subtitles.length > 0) {
        console.log('✅ 从 __INITIAL_STATE__ 获取到字幕（已验证匹配）');
        return subtitles;
      }
    } else {
      console.warn('⚠️  __INITIAL_STATE__ 的视频信息不匹配，跳过');
    }
  }

  // 方案2: 从 window.__playinfo__ 获取
  const playinfo = (window as any).__playinfo__;
  if (playinfo?.data) {
    const bvid = playinfo.data.bvid;
    const cid = playinfo.data.cid;

    console.log('📦 __playinfo__ 中的视频信息:', { bvid, cid });

    // 验证是否为当前视频
    if (bvid === currentBvid && String(cid) === String(currentCid)) {
      const subtitles = playinfo.data.subtitle?.subtitles || [];
      if (subtitles.length > 0) {
        console.log('✅ 从 __playinfo__ 获取到字幕（已验证匹配）');
        return subtitles;
      }
    } else {
      console.warn('⚠️  __playinfo__ 的视频信息不匹配，跳过');
    }
  }

  // 方案3: 从 window.player 获取
  const player = (window as any).player;
  if (player?.getSubtitle) {
    try {
      const subtitle = player.getSubtitle();
      if (subtitle && Array.isArray(subtitle)) {
        console.log('✅ 从 player 对象获取到字幕');
        return subtitle;
      }
    } catch (e) {
      console.warn('⚠️ 从 player 获取字幕失败:', e);
    }
  }

  console.log('⚠️ 页面全局变量中未找到匹配的字幕数据');
  return [];
}

/**
 * 统一方案：总是使用实时 API 获取字幕（通过 Background Script）
 * 修复：移除页面缓存逻辑，避免缓存和实时数据不一致的问题
 */
export async function getSubtitleListHybrid(
  cid: string,
  bvid?: string,
  aid?: string
): Promise<SubtitleInfo[]> {
  debugLog('🎯 使用实时 API 获取字幕（确保数据一致性）...');

  // 总是使用 Background Script 请求 API（会携带 Cookie）
  // 这样可以确保每次都获取最新的字幕数据，避免缓存问题
  const { getSubtitleList } = await import('./api');
  return getSubtitleList(cid, bvid, aid);
}
