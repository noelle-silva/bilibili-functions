import { debugLog } from '@/utils/debug';

type BiliApiResp<T> = {
  code: number;
  message: string;
  data?: T;
};

type VideoViewData = {
  aid: number;
  title: string;
};

type ReplyMember = {
  uname?: string;
};

type ReplyContent = {
  message?: string;
};

export type ReplyItem = {
  rpid?: number;
  rpid_str?: string;
  floor?: number;
  ctime?: number;
  like?: number;
  member?: ReplyMember;
  content?: ReplyContent;
  replies?: ReplyItem[] | null;
  rcount?: number;
};

type ReplyPageData = {
  page?: { count?: number; num?: number; size?: number };
  replies?: ReplyItem[] | null;
};

type SubReplyPageData = {
  page?: { count?: number; num?: number; size?: number };
  replies?: ReplyItem[] | null;
};

export type CommentExportStats = {
  expectedRootCount: number;
  expectedSubCount: number;
  expectedTotalCount: number;
  fetchedRootCount: number;
  fetchedSubCount: number;
  fetchedTotalCount: number;
};

export type CommentExportFile = {
  index: number;
  total: number;
  content: string;
  commentCount: number;
};

export type CommentExportResult = {
  oid: string;
  stats: CommentExportStats;
  files: CommentExportFile[];
};

const DATA_URL_PREFIX_LEN = 'data:text/plain;charset=utf-8,'.length;
const MAX_DATA_URL_LEN = 1_850_000;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function safeText(s: any) {
  return String(s ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function formatLocalDateTime(tsSeconds?: number) {
  if (!tsSeconds) return '';
  const d = new Date(tsSeconds * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function isPsOutOfBoundsError(err: unknown) {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return msg.includes('ps out of bounds') || (msg.includes('out of bounds') && msg.includes('ps'));
}

async function fetchBiliApiThroughBackground<T>(url: string, bvid?: string): Promise<BiliApiResp<T>> {
  const response: any = await chrome.runtime.sendMessage({
    type: 'FETCH_BILI_API',
    data: { url, bvid },
  });

  if (!response?.success) {
    throw new Error(response?.error || '请求 B 站 API 失败');
  }

  return response.data as BiliApiResp<T>;
}

async function resolveAid(args: { bvid?: string; aid?: string }) {
  const aid = String(args.aid || '').trim();
  if (aid) return { oid: aid, title: '' };

  const bvid = String(args.bvid || '').trim();
  if (!bvid) throw new Error('无法获取 aid/bvid，无法抓取评论');

  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
  const resp = await fetchBiliApiThroughBackground<VideoViewData>(url, bvid);
  if (resp.code !== 0 || !resp.data?.aid) throw new Error(resp.message || '获取视频信息失败（无法解析 aid）');
  return { oid: String(resp.data.aid), title: String(resp.data.title || '') };
}

async function fetchRootPage(args: {
  oid: string;
  pn: number;
  ps: number;
  sort: 0 | 2;
  bvid?: string;
}) {
  const params = new URLSearchParams({
    jsonp: 'jsonp',
    pn: String(args.pn),
    ps: String(args.ps),
    type: '1',
    oid: String(args.oid),
    sort: String(args.sort),
    nohot: '0',
  });
  const url = `https://api.bilibili.com/x/v2/reply?${params.toString()}`;
  const resp = await fetchBiliApiThroughBackground<ReplyPageData>(url, args.bvid);
  if (resp.code !== 0) throw new Error(resp.message || '获取评论失败');
  const total = Number(resp.data?.page?.count || 0) || 0;
  const replies = ((resp.data?.replies || []) as ReplyItem[]).filter(Boolean);
  return { total, replies };
}

async function fetchRootPageAdaptive(args: {
  oid: string;
  pn: number;
  ps: number;
  sort: 0 | 2;
  bvid?: string;
}) {
  const candidates = [args.ps, 20, 10, 5, 1]
    .map((n) => Math.max(1, Math.floor(n)))
    .filter((n, idx, arr) => arr.indexOf(n) === idx);

  let lastErr: unknown;
  for (const ps of candidates) {
    try {
      const page = await fetchRootPage({ ...args, ps });
      return { ...page, ps };
    } catch (err) {
      lastErr = err;
      if (!isPsOutOfBoundsError(err)) throw err;
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error(String(lastErr || '获取评论失败')));
}

async function fetchSubPage(args: { oid: string; root: string; pn: number; ps: number; bvid?: string }) {
  const params = new URLSearchParams({
    jsonp: 'jsonp',
    pn: String(args.pn),
    ps: String(args.ps),
    type: '1',
    oid: String(args.oid),
    root: String(args.root),
  });
  const url = `https://api.bilibili.com/x/v2/reply/reply?${params.toString()}`;
  const resp = await fetchBiliApiThroughBackground<SubReplyPageData>(url, args.bvid);
  if (resp.code !== 0) throw new Error(resp.message || '获取楼中楼失败');
  const total = Number(resp.data?.page?.count || 0) || 0;
  const replies = ((resp.data?.replies || []) as ReplyItem[]).filter(Boolean);
  return { total, replies };
}

async function fetchSubPageAdaptive(args: { oid: string; root: string; pn: number; ps: number; bvid?: string }) {
  const candidates = [args.ps, 20, 10, 5, 1]
    .map((n) => Math.max(1, Math.floor(n)))
    .filter((n, idx, arr) => arr.indexOf(n) === idx);

  let lastErr: unknown;
  for (const ps of candidates) {
    try {
      const page = await fetchSubPage({ ...args, ps });
      return { ...page, ps };
    } catch (err) {
      lastErr = err;
      if (!isPsOutOfBoundsError(err)) throw err;
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error(String(lastErr || '获取楼中楼失败')));
}

function getRootRpid(reply: ReplyItem) {
  if (typeof reply.rpid === 'number' && reply.rpid > 0) return String(reply.rpid);
  const s = String(reply.rpid_str || '').trim();
  if (s) return s;
  return '';
}

async function asyncPool<T, R>(
  items: T[],
  concurrency: number,
  iterator: (item: T, index: number) => Promise<R>
) {
  const limit = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);

  let nextIndex = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await iterator(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

function formatReplyBlock(reply: ReplyItem, index: number, indent: number) {
  const uname = safeText(reply.member?.uname || '匿名');
  const floorText = reply.floor ? `#${reply.floor}` : `#${index}`;
  const timeText = formatLocalDateTime(reply.ctime);
  const likeText = typeof reply.like === 'number' ? ` 👍${reply.like}` : '';

  const prefix = indent > 0 ? `${'  '.repeat(indent)}↳ ` : '';
  const head = `${prefix}${floorText}${timeText ? ` [${timeText}]` : ''} ${uname}${likeText}`;

  const raw = safeText(reply.content?.message || '').trim();
  const bodyLines = raw === '' ? ['(空)'] : raw.split('\n');
  const body = bodyLines.map((line) => `${'  '.repeat(indent)}${line}`).join('\n');

  return `${head}\n${body}\n`;
}

function formatThread(root: ReplyItem, index: number) {
  const parts: string[] = [];
  parts.push(formatReplyBlock(root, index, 0));

  const children = Array.isArray(root.replies) ? root.replies : [];
  if (children.length > 0) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      parts.push(formatReplyBlock(child, i + 1, 1));
    }
  }

  return parts.join('\n');
}

function splitTextByDataUrlLimit(args: { header: string; blocks: string[] }) {
  const headerEncodedLen = encodeURIComponent(args.header).length;

  const files: { parts: string[]; count: number; encodedLen: number }[] = [];
  let current = {
    parts: [args.header],
    count: 0,
    encodedLen: DATA_URL_PREFIX_LEN + headerEncodedLen,
  };

  for (const block of args.blocks) {
    const encodedLen = encodeURIComponent(block).length + encodeURIComponent('\n').length;
    if (current.count > 0 && current.encodedLen + encodedLen > MAX_DATA_URL_LEN) {
      files.push(current);
      current = {
        parts: [args.header],
        count: 0,
        encodedLen: DATA_URL_PREFIX_LEN + headerEncodedLen,
      };
    }

    current.parts.push(block);
    current.count += 1;
    current.encodedLen += encodedLen;
  }

  if (current.count > 0 || files.length === 0) files.push(current);

  return files.map((f) => ({ content: f.parts.join('\n'), count: f.count }));
}

export async function buildVideoCommentsTxtFiles(args: {
  aid?: string;
  bvid?: string;
  pageUrl: string;
  videoTitle: string;
  sort?: 'time' | 'hot';
  subConcurrency?: number;
}): Promise<CommentExportResult> {
  const resolved = await resolveAid({ bvid: args.bvid, aid: args.aid });
  const oid = resolved.oid;
  const sort: 0 | 2 = args.sort === 'hot' ? 0 : 2;

  const first = await fetchRootPageAdaptive({ oid, pn: 1, ps: 20, sort, bvid: args.bvid });
  const rootTotal = first.total || first.replies.length;
  const ps = first.ps;
  const rootPages = rootTotal > 0 ? Math.max(1, Math.ceil(rootTotal / ps)) : 1;

  debugLog('💬 评论抓取：主评论分页', { oid, rootTotal, ps, rootPages, sort });

  const roots: ReplyItem[] = [];
  roots.push(...first.replies);

  for (let pn = 2; pn <= rootPages; pn++) {
    const page = await fetchRootPageAdaptive({ oid, pn, ps, sort, bvid: args.bvid });
    if (!page.replies || page.replies.length === 0) break;
    roots.push(...page.replies);
    await new Promise((r) => setTimeout(r, 10));
  }

  const expectedRootCount = rootTotal || roots.length;
  const expectedSubCount = roots.reduce((acc, r) => acc + (Number(r.rcount || 0) || 0), 0);
  const expectedTotalCount = expectedRootCount + expectedSubCount;

  const rootsNeedingSubs = roots
    .map((r) => ({ root: r, rootId: getRootRpid(r), expected: Number(r.rcount || 0) || 0 }))
    .filter((x) => x.expected > 0 && x.rootId);

  const subConcurrency = Math.max(1, Math.floor(args.subConcurrency ?? 4));
  let fetchedSubCount = 0;

  debugLog('💬 评论抓取：开始补齐楼中楼', {
    oid,
    roots: roots.length,
    rootsNeedingSubs: rootsNeedingSubs.length,
    subConcurrency,
  });

  await asyncPool(rootsNeedingSubs, subConcurrency, async (item) => {
    const firstSub = await fetchSubPageAdaptive({
      oid,
      root: item.rootId,
      pn: 1,
      ps: 20,
      bvid: args.bvid,
    });

    const subTotal = firstSub.total || item.expected || firstSub.replies.length;
    const subPs = firstSub.ps;
    const subPages = subTotal > 0 ? Math.max(1, Math.ceil(subTotal / subPs)) : 1;

    const allSubs: ReplyItem[] = [];
    allSubs.push(...firstSub.replies);

    for (let pn = 2; pn <= subPages; pn++) {
      const page = await fetchSubPageAdaptive({
        oid,
        root: item.rootId,
        pn,
        ps: subPs,
        bvid: args.bvid,
      });
      if (!page.replies || page.replies.length === 0) break;
      allSubs.push(...page.replies);
      await new Promise((r) => setTimeout(r, 5));
    }

    item.root.replies = allSubs;
    fetchedSubCount += allSubs.length;
  });

  const fetchedRootCount = roots.length;
  const fetchedTotalCount = fetchedRootCount + fetchedSubCount;

  const exportAt = new Date();
  const headerLines = [
    `标题: ${safeText(args.videoTitle || resolved.title || '')}`.trim(),
    `链接: ${safeText(args.pageUrl)}`.trim(),
    `导出时间: ${exportAt.getFullYear()}-${pad2(exportAt.getMonth() + 1)}-${pad2(
      exportAt.getDate()
    )} ${pad2(exportAt.getHours())}:${pad2(exportAt.getMinutes())}:${pad2(exportAt.getSeconds())}`,
    `排序: ${args.sort === 'hot' ? '按热度' : '按时间'}`,
    `主评论: ${fetchedRootCount}${rootTotal ? ` / 总计约 ${rootTotal}` : ''}`,
    `楼中楼: ${fetchedSubCount}${expectedSubCount ? ` / 约 ${expectedSubCount}` : ''}`,
    `总评论(含楼中楼): ${fetchedTotalCount} / 约 ${expectedTotalCount}`,
    '',
    '---',
    '',
  ];

  const header = headerLines.filter(Boolean).join('\n');
  const blocks = roots.map((r, idx) => formatThread(r, idx + 1));

  const files = splitTextByDataUrlLimit({ header, blocks }).map((f, idx, arr) => ({
    index: idx + 1,
    total: arr.length,
    content: f.content,
    commentCount: f.count,
  }));

  return {
    oid,
    stats: {
      expectedRootCount,
      expectedSubCount,
      expectedTotalCount,
      fetchedRootCount,
      fetchedSubCount,
      fetchedTotalCount,
    },
    files,
  };
}
