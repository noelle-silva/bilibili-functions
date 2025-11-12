// 视频信息
export interface VideoInfo {
  bvid: string;
  aid: string;
  cid: string;
  title: string;
  part?: number; // 分P编号
  partTitle?: string; // 分P标题
}

// 分P信息
export interface VideoPart {
  cid: string;
  page: number;
  part: string;
  duration: number;
}

// 字幕条目
export interface SubtitleItem {
  from: number;
  to: number;
  content: string;
  location?: number;
}

// 字幕信息
export interface SubtitleInfo {
  lan: string;
  lan_doc: string;
  subtitle_url: string;
  ai_status?: number;
  ai_type?: number;
}

// 按钮模块接口
export interface ButtonModule {
  // 模块唯一标识
  id: string;

  // 模块名称
  name: string;

  // 模块描述
  description?: string;

  // 按钮配置
  button: {
    text: string;
    icon?: string;
    className?: string;
    position?: number;
  };

  // 执行函数（点击按钮时调用）
  execute: (context: ExecutionContext) => Promise<void>;

  // 生命周期钩子
  onLoad?: () => void;
  onUnload?: () => void;

  // 是否启用
  enabled: boolean;
}

// 执行上下文
export interface ExecutionContext {
  videoInfo: VideoInfo;
  element: HTMLElement;
  page: Document;
}

// Bilibili API 响应类型
export interface BilibiliResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 视频分P列表响应
export interface VideoPageListResponse {
  code: number;
  message: string;
  data: VideoPart[];
}

// 播放器信息响应
export interface PlayerInfoResponse {
  code: number;
  message: string;
  data: {
    subtitle: {
      subtitles: SubtitleInfo[];
      list?: SubtitleInfo[]; // 兼容不同API版本
    };
  };
}

// 字幕文件响应
export interface SubtitleFileResponse {
  body: SubtitleItem[];
  font_size?: number;
  font_color?: string;
  background_alpha?: number;
  background_color?: string;
}

// 模块配置
export interface ModuleConfig {
  [moduleId: string]: {
    enabled: boolean;
    settings?: Record<string, any>;
  };
}
