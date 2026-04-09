import { getVideoPageList, getVideoSubtitleText } from '@/utils/api';
import { openBatchProgressDialog } from '@/utils/batch-progress';
import { showToast } from '@/utils/dom';
import { waitForDownloadCompletion } from '@/utils/download-tracker';
import { downloadTextThroughBackground } from '@/utils/text-download';
import { sanitizeFilename } from '@/utils/video-download';

type SelectedVideo = {
  bvid: string;
  title: string;
};

type PartTaskMeta = {
  bvid: string;
  cid: string;
  page: number;
  part: string;
  title: string;
};

const STYLE_ID = 'bilibili-up-subtitle-batch-style';
const BAR_ID = 'bilibili-up-subtitle-batch-bar';
const BODY_MODE_CLASS = 'ussb-mode';

function parseBvidFromUrl(url: string) {
  const match = url.match(/\/video\/(BV[\w]+)/);
  return match?.[1] || '';
}

function findListRoot(): HTMLElement {
  const candidates = [
    '#submit-video-list',
    '#submit-video',
    '.submit-video',
    '.submit-video-list',
    '.space-video',
    '.section',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) return el;
  }
  return document.body;
}

function pickTitleFromCard(card: HTMLElement, fallback: string) {
  const titleEl =
    (card.querySelector('a.title') as HTMLElement | null) ||
    (card.querySelector('[title]') as HTMLElement | null) ||
    (card.querySelector('a[href*="/video/BV"]') as HTMLElement | null);

  const t = (titleEl?.getAttribute('title') || titleEl?.textContent || '').trim();
  return t || fallback;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
	style.textContent = `
	    #${BAR_ID} { position: fixed; right: 16px; bottom: 16px; z-index: 100000; display: flex; gap: 10px; align-items: center; }
	    #${BAR_ID} .ussb-btn { appearance: none; -webkit-appearance: none; border: 1px solid rgba(229, 233, 239, 0.95); background: rgba(255, 255, 255, 0.92); color: #18191c; height: 34px; padding: 0 14px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.12s ease; box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02); backdrop-filter: saturate(160%) blur(10px); }
	    #${BAR_ID} .ussb-btn:hover:not(:disabled) { background: #fff; border-color: rgba(0, 174, 236, 0.75); color: #00aeec; box-shadow: 0 10px 28px rgba(0, 174, 236, 0.18); transform: translateY(-1px); }
	    #${BAR_ID} .ussb-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
	    #${BAR_ID} .ussb-btn.primary { background: #00aeec; color: #fff; border: none; }
	    #${BAR_ID} .ussb-btn.primary:hover:not(:disabled) { background: #00a1d6; color: #fff; }
	    #${BAR_ID} .ussb-count { font-size: 12px; color: #61666d; background: rgba(255,255,255,0.92); border: 1px solid rgba(229, 233, 239, 0.95); border-radius: 999px; padding: 0 10px; height: 28px; display: inline-flex; align-items: center; user-select: none; }
	
	    [data-ussb-card="1"] .ussb-check { display: none; }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"] { cursor: pointer; transition: box-shadow 0.12s ease, transform 0.12s ease; }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"]::after {
	      content: '';
	      position: absolute;
	      inset: 0;
	      border: 2px dashed rgba(0, 174, 236, 0.35);
	      border-radius: inherit;
	      pointer-events: none;
	      opacity: 0.9;
	      transition: border-color 0.12s ease, opacity 0.12s ease;
	    }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"]:hover { transform: translateY(-1px); }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"]:hover::after { border-color: rgba(0, 174, 236, 0.75); }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"].ussb-selected::after { border-style: solid; border-color: #00aeec; opacity: 1; }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"].ussb-selected { box-shadow: 0 10px 28px rgba(0, 174, 236, 0.18); }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"] .ussb-check { opacity: 0; pointer-events: none; }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"].ussb-selected .ussb-check { opacity: 1; }
	    .${BODY_MODE_CLASS} [data-ussb-card="1"] .ussb-check {
	      display: block;
	      position: absolute; top: 8px; left: 8px; width: 22px; height: 22px; border-radius: 50%;
      background: #00aeec; color: #fff; font-weight: 900; font-size: 14px; line-height: 22px; text-align: center;
      box-shadow: 0 6px 18px rgba(0, 174, 236, 0.25);
      transition: opacity 0.12s ease;
      z-index: 2;
    }
  `;
	document.head.appendChild(style);
}

function pickCardFromAnchors(listRoot: HTMLElement, anchors: HTMLAnchorElement[]) {
  const a0 = anchors[0];
  if (!a0) return listRoot;

  const containsAll = (el: HTMLElement) => anchors.every((a) => el.contains(a));

  if (anchors.length >= 2) {
    let cur: HTMLElement | null = a0;
    while (cur && cur !== listRoot && cur !== document.body) {
      if (containsAll(cur)) break;
      cur = cur.parentElement;
    }
    if (cur && cur !== listRoot && cur !== document.body) {
      if (cur.tagName === 'A') return cur.parentElement || cur;
      return cur;
    }
  }

  const card =
    (a0.closest('li') as HTMLElement | null) ||
    (a0.closest('[class*="video"]') as HTMLElement | null) ||
    (a0.closest('[class*="item"]') as HTMLElement | null) ||
    (a0.closest('[class*="card"]') as HTMLElement | null) ||
    (a0.parentElement as HTMLElement | null) ||
    (a0 as unknown as HTMLElement);

  if (card.tagName === 'A') return card.parentElement || card;
  return card;
}

function createBar(args: {
  onToggle: () => void;
  onDownload: () => void;
}) {
  const existing = document.getElementById(BAR_ID);
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = BAR_ID;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'ussb-btn';
  toggleBtn.textContent = '批量选择';
  toggleBtn.addEventListener('click', args.onToggle);

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'ussb-btn primary';
  downloadBtn.textContent = '下载字幕';
  downloadBtn.disabled = true;
  downloadBtn.addEventListener('click', args.onDownload);

  const count = document.createElement('span');
  count.className = 'ussb-count';
  count.textContent = '已选 0';

  bar.appendChild(toggleBtn);
  bar.appendChild(downloadBtn);
  bar.appendChild(count);

  document.body.appendChild(bar);

  return {
    el: bar,
    toggleBtn,
    downloadBtn,
    countEl: count,
  };
}

export function initUpSubtitleBatch(): () => void {
  ensureStyle();

  let selectionMode = false;
  const selected = new Map<string, SelectedVideo>();

  const listRoot = findListRoot();

  let observer: MutationObserver | null = null;
  let raf = 0;
  let destroyed = false;

  const bar = createBar({
    onToggle: () => toggleSelectionMode(),
    onDownload: () => void startDownload(),
  });

  const setBusy = (busy: boolean) => {
    bar.toggleBtn.disabled = busy;
    bar.downloadBtn.disabled = busy || selected.size === 0;
  };

  const renderBar = () => {
    bar.toggleBtn.textContent = selectionMode ? '退出选择' : '批量选择';
    bar.downloadBtn.disabled = !selectionMode || selected.size === 0;
    bar.countEl.textContent = `已选 ${selected.size}`;
  };

  const applySelectionToCard = (card: HTMLElement, bvid: string) => {
    if (selected.has(bvid)) card.classList.add('ussb-selected');
    else card.classList.remove('ussb-selected');
  };

  const getCardMeta = (card: HTMLElement, bvid: string): SelectedVideo => {
    const current = selected.get(bvid);
    if (current) return current;
    const fallback = bvid;
    const title = pickTitleFromCard(card, fallback);
    return { bvid, title };
  };

  const tagCard = (card: HTMLElement, bvid: string) => {
    if (card.dataset.ussbCard === '1' && card.dataset.ussbBvid === bvid) {
      applySelectionToCard(card, bvid);
      return;
    }

    card.dataset.ussbCard = '1';
    card.dataset.ussbBvid = bvid;

    const pos = window.getComputedStyle(card).position;
    if (pos === 'static') {
      card.dataset.ussbPosPatched = '1';
      card.style.position = 'relative';
    }

    if (!card.querySelector('.ussb-check')) {
      const check = document.createElement('div');
      check.className = 'ussb-check';
      check.textContent = '✓';
      check.setAttribute('aria-hidden', 'true');
      card.insertBefore(check, card.firstChild);
    }

    applySelectionToCard(card, bvid);
  };

  const refreshCards = () => {
    if (destroyed) return;
    const anchors = Array.from(
      listRoot.querySelectorAll<HTMLAnchorElement>('a[href*="/video/BV"]')
    );

    const bvidToAnchors = new Map<string, HTMLAnchorElement[]>();
    anchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const bvid = parseBvidFromUrl(href);
      if (!bvid) return;
      const list = bvidToAnchors.get(bvid) || [];
      list.push(a);
      bvidToAnchors.set(bvid, list);
    });

    for (const [bvid, as] of bvidToAnchors.entries()) {
      const card = pickCardFromAnchors(listRoot, as);
      tagCard(card, bvid);
    }
  };

  const scheduleRefresh = () => {
    if (destroyed) return;
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      refreshCards();
    });
  };

  const startObserver = () => {
    if (observer) return;
    observer = new MutationObserver(() => scheduleRefresh());
    observer.observe(listRoot, { childList: true, subtree: true });
  };

  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  const clearSelection = () => {
    selected.clear();
    const cards = listRoot.querySelectorAll<HTMLElement>('[data-ussb-card="1"].ussb-selected');
    cards.forEach((c) => c.classList.remove('ussb-selected'));
  };

  const resetCards = () => {
    const cards = listRoot.querySelectorAll<HTMLElement>('[data-ussb-card="1"]');
    cards.forEach((card) => {
      card.classList.remove('ussb-selected');
      delete card.dataset.ussbCard;
      delete card.dataset.ussbBvid;
      const check = card.querySelector('.ussb-check');
      if (check) check.remove();

      if (card.dataset.ussbPosPatched === '1') {
        delete card.dataset.ussbPosPatched;
        card.style.position = '';
      }
    });
  };

  const toggleSelectionMode = () => {
    selectionMode = !selectionMode;
    if (selectionMode) {
      document.body.classList.add(BODY_MODE_CLASS);
      refreshCards();
      startObserver();
      showToast('进入批量选择模式：点击视频卡片即可勾选', 'info');
    } else {
      document.body.classList.remove(BODY_MODE_CLASS);
      stopObserver();
      clearSelection();
      resetCards();
      showToast('已退出批量选择模式', 'info');
    }
    renderBar();
  };

  const onDocClickCapture = (e: MouseEvent) => {
    if (!selectionMode) return;

    const target = e.target as HTMLElement | null;
    const card = target?.closest?.('[data-ussb-card="1"][data-ussb-bvid]') as HTMLElement | null;
    if (!card) return;

    const bvid = card.dataset.ussbBvid || '';
    if (!bvid) return;

    // 选择模式下阻止跳转
    e.preventDefault();
    e.stopPropagation();

    if (selected.has(bvid)) {
      selected.delete(bvid);
      card.classList.remove('ussb-selected');
    } else {
      const meta = getCardMeta(card, bvid);
      selected.set(bvid, meta);
      card.classList.add('ussb-selected');
    }

    renderBar();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!selectionMode) return;
    if (e.key !== 'Escape') return;
    toggleSelectionMode();
  };

  const buildTasks = async (videos: SelectedVideo[]) => {
    const items: { id: string; label: string; meta: PartTaskMeta }[] = [];
    const skipped: { bvid: string; error: string }[] = [];

    for (const v of videos) {
      try {
        const pageList = await getVideoPageList(v.bvid);
        if (pageList.length === 0) {
          skipped.push({ bvid: v.bvid, error: '未找到分P信息' });
          continue;
        }

        const safeTitle = v.title || v.bvid;
        pageList.forEach((p) => {
          const cid = String(p.cid);
          items.push({
            id: `${v.bvid}_${cid}`,
            label: `《${safeTitle}》 P${p.page}｜${p.part}`,
            meta: {
              bvid: v.bvid,
              cid,
              page: p.page,
              part: p.part,
              title: safeTitle,
            },
          });
        });
      } catch (err: any) {
        skipped.push({ bvid: v.bvid, error: err?.message || '获取分P失败' });
      }
    }

    return { items, skipped };
  };

  const startDownload = async () => {
    if (!selectionMode) return;
    if (selected.size === 0) {
      showToast('请先勾选要下载字幕的视频', 'info');
      return;
    }

    try {
      setBusy(true);
      const videos = Array.from(selected.values());

      showToast('正在生成下载任务...', 'info');
      const { items, skipped } = await buildTasks(videos);

      if (skipped.length > 0) {
        showToast(`有 ${skipped.length} 个视频未能生成任务（可在控制台查看）`, 'info');
        // eslint-disable-next-line no-console
        console.warn('[up-subtitle-batch] skipped:', skipped);
      }

      if (items.length === 0) {
        showToast('没有可执行的字幕任务', 'error');
        return;
      }

      openBatchProgressDialog({
        title: `UP 投稿批量字幕 - 共 ${items.length} 项`,
        items: items.map((x) => ({ id: x.id, label: x.label, meta: x.meta as any })),
        async runItem(item) {
          const meta = item.meta as unknown as PartTaskMeta;
          const subtitleText = await getVideoSubtitleText(meta.cid, meta.bvid);

          const baseTitle = sanitizeFilename(meta.title || meta.bvid);
          const partTitle = sanitizeFilename(meta.part || '');

          const filename = partTitle
            ? `${baseTitle}_P${meta.page}_${partTitle}.txt`
            : `${baseTitle}_P${meta.page}.txt`;

          const downloadId = await downloadTextThroughBackground(filename, subtitleText, 'subtitle');

          await new Promise((resolve) => setTimeout(resolve, 250));

          if (downloadId) {
            return { completion: waitForDownloadCompletion(downloadId) };
          }
        },
        autoStart: true,
      });
    } catch (err: any) {
      showToast(`❌ ${err?.message || '批量下载失败'}`, 'error');
    } finally {
      setBusy(false);
      renderBar();
    }
  };

  const cleanup = () => {
    destroyed = true;
    stopObserver();
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }

    document.removeEventListener('click', onDocClickCapture, true);
    document.removeEventListener('keydown', onKeyDown, true);

    if (selectionMode) document.body.classList.remove(BODY_MODE_CLASS);
    clearSelection();
    resetCards();
    bar.el.remove();
  };

  document.addEventListener('click', onDocClickCapture, true);
  document.addEventListener('keydown', onKeyDown, true);

  renderBar();
  scheduleRefresh();

  return cleanup;
}
