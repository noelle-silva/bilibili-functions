import { waitForDownloadCompletion } from '@/utils/download-tracker';
import {
  fetchPlayUrlThroughBackground,
  getDashUrls,
  getProgressiveUrls,
  inferExtension,
  requestDownloadUrl,
} from '@/utils/video-download';

export async function downloadPartVideo(args: {
  cid: string;
  bvid?: string;
  aid?: string;
  filenamePrefix: string;
  qn?: number;
}) {
  const downloadIds: number[] = [];
  const qn = args.qn ?? 80;

  // 1) Progressive（durl）优先：更可能是“单文件可播”的直链
  const progressive = await fetchPlayUrlThroughBackground({
    cid: args.cid,
    bvid: args.bvid,
    aid: args.aid,
    qn,
    fnval: 0,
  });

  if (progressive.code !== 0) {
    throw new Error(progressive.message || '获取播放地址失败');
  }

  const progressiveUrls = getProgressiveUrls(progressive);
  if (progressiveUrls.length > 0) {
    if (progressiveUrls.length === 1) {
      const ext = inferExtension(progressiveUrls[0], '.mp4');
      const id = await requestDownloadUrl(progressiveUrls[0], `${args.filenamePrefix}${ext}`);
      if (id) downloadIds.push(id);
    } else {
      for (let i = 0; i < progressiveUrls.length; i++) {
        const url = progressiveUrls[i];
        const ext = inferExtension(url, '.mp4');
        const id = await requestDownloadUrl(url, `${args.filenamePrefix}_seg${i + 1}${ext}`);
        if (id) downloadIds.push(id);
      }
    }

    return {
      mode: 'progressive' as const,
      downloadIds,
      completion: Promise.all(downloadIds.map((id) => waitForDownloadCompletion(id))).then(() => {}),
    };
  }

  // 2) DASH：分离音视频
  const dashResp = await fetchPlayUrlThroughBackground({
    cid: args.cid,
    bvid: args.bvid,
    aid: args.aid,
    qn,
    fnval: 16,
  });

  if (dashResp.code !== 0) {
    throw new Error(dashResp.message || '获取播放地址失败');
  }

  const { videoUrl, audioUrl } = getDashUrls(dashResp);

  if (!videoUrl && !audioUrl) {
    throw new Error('未能找到可下载的视频/音频地址（可能需要登录或该视频受限）');
  }

  if (videoUrl) {
    const id = await requestDownloadUrl(videoUrl, `${args.filenamePrefix}_video.m4s`);
    if (id) downloadIds.push(id);
  }
  if (audioUrl) {
    const id = await requestDownloadUrl(audioUrl, `${args.filenamePrefix}_audio.m4s`);
    if (id) downloadIds.push(id);
  }

  return {
    mode: 'dash' as const,
    downloadIds,
    completion: Promise.all(downloadIds.map((id) => waitForDownloadCompletion(id))).then(() => {}),
  };
}

