export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: 'subtitle-copy',
    name: '复制字幕',
    description: '一键复制当前视频的字幕到剪贴板',
  },
  {
    id: 'batch-download',
    name: '批量下载字幕',
    description: '选择多个分P并批量下载字幕TXT文件',
  },
  {
    id: 'comment-download',
    name: '下载评论',
    description: '导出当前视频评论为 TXT（含楼中楼，过大自动拆分）',
  },
  {
    id: 'video-download',
    name: '下载视频',
    description: '一键下载当前分P视频（可能分离音视频）',
  },
  {
    id: 'batch-video-download',
    name: '批量下载视频',
    description: '选择多个分P并批量下载视频（可能分离音视频）',
  },
  {
    id: 'lights-off',
    name: '视频关灯',
    description: '在播放器内切换沉浸遮罩，并支持调节遮罩透明度',
  },
  {
    id: 'up-subtitle-batch',
    name: 'UP投稿批量字幕',
    description: '在UP投稿页进入批量选择模式，批量下载所选视频的字幕/视频',
  },
];
