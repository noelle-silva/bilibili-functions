import { VIDEO_ELEMENT_SELECTORS } from '@/modules/lights-off/constants';

const MIN_VIDEO_WIDTH = 160;
const MIN_VIDEO_HEIGHT = 90;

export type ViewportRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export function findCleanVideoElement(): HTMLVideoElement | null {
  const candidates = collectVideoCandidates();
  candidates.sort((a, b) => getElementArea(b) - getElementArea(a));
  return candidates[0] || null;
}

export function getCleanVideoRect(video: HTMLVideoElement): ViewportRect | null {
  const rect = video.getBoundingClientRect();
  if (!isUsableRect(rect)) return null;

  const intrinsicRatio = getIntrinsicRatio(video);
  if (!intrinsicRatio) return toViewportRect(rect);

  const boxRatio = rect.width / rect.height;
  if (boxRatio > intrinsicRatio) {
    const width = rect.height * intrinsicRatio;
    const left = rect.left + (rect.width - width) / 2;
    return createRect(left, rect.top, width, rect.height);
  }

  const height = rect.width / intrinsicRatio;
  const top = rect.top + (rect.height - height) / 2;
  return createRect(rect.left, top, rect.width, height);
}

export function containsPoint(rect: ViewportRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function collectVideoCandidates(): HTMLVideoElement[] {
  const seen = new Set<HTMLVideoElement>();
  const candidates: HTMLVideoElement[] = [];

  for (const selector of VIDEO_ELEMENT_SELECTORS) {
    const videos = document.querySelectorAll<HTMLVideoElement>(selector);
    for (const video of videos) {
      if (seen.has(video) || !isUsableRect(video.getBoundingClientRect())) continue;
      seen.add(video);
      candidates.push(video);
    }
  }

  return candidates;
}

function getIntrinsicRatio(video: HTMLVideoElement): number | null {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;
  return video.videoWidth / video.videoHeight;
}

function isUsableRect(rect: DOMRect): boolean {
  return rect.width >= MIN_VIDEO_WIDTH && rect.height >= MIN_VIDEO_HEIGHT;
}

function getElementArea(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return rect.width * rect.height;
}

function toViewportRect(rect: DOMRect): ViewportRect {
  return createRect(rect.left, rect.top, rect.width, rect.height);
}

function createRect(left: number, top: number, width: number, height: number): ViewportRect {
  return {
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
  };
}
