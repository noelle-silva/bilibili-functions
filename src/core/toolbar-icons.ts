import type { ToolbarButtonIconName } from '@/core/types';

type IconDefinition = {
  title: string;
  paths: string[];
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const TOOLBAR_ICONS: Record<ToolbarButtonIconName, IconDefinition> = {
  'subtitle-copy': {
    title: '复制字幕',
    paths: [
      'M6 5.5h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6.5L7 20.5v-3H6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z',
      'M7.5 9.25h9',
      'M7.5 12.75h6.5',
    ],
  },
  'subtitle-batch-download': {
    title: '批量下载字幕',
    paths: [
      'M4 6.5h9.5',
      'M4 10.5h8',
      'M4 14.5h6.5',
      'M17.5 5.5v10',
      'M14.25 12.25 17.5 15.5l3.25-3.25',
      'M13.5 19h8',
    ],
  },
  'comment-download': {
    title: '下载评论',
    paths: [
      'M5.5 5.5h13a2.5 2.5 0 0 1 2.5 2.5v6.5a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3v-3h-2A2.5 2.5 0 0 1 3 14.5V8a2.5 2.5 0 0 1 2.5-2.5Z',
      'M8 9.5h6.5',
      'M8 13h4',
      'M17 9.5v4.75',
      'M15.25 12.5 17 14.25l1.75-1.75',
    ],
  },
  'video-download': {
    title: '下载视频',
    paths: [
      'M4 6.5h10.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 15V9A2.5 2.5 0 0 1 4 6.5Z',
      'M7.75 9.25v5.5L12.5 12l-4.75-2.75Z',
      'M20 5.5v8.75',
      'M17.25 11.5 20 14.25l2.75-2.75',
      'M17 18.5h6',
    ],
  },
  'video-batch-download': {
    title: '批量下载视频',
    paths: [
      'M5 7h8.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
      'M7.5 9.5v4l3.5-2-3.5-2Z',
      'M7 4.5h8.5a3 3 0 0 1 3 3v5',
      'M19.5 6v9',
      'M17 12.5l2.5 2.5 2.5-2.5',
      'M16.5 19h6',
    ],
  },
};

export function createToolbarIcon(iconName: ToolbarButtonIconName): SVGSVGElement {
  const definition = TOOLBAR_ICONS[iconName];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'bilibili-custom-button-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = definition.title;
  svg.appendChild(title);

  for (const pathData of definition.paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.85');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }

  return svg;
}
