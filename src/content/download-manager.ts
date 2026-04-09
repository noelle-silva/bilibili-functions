type DownloadTask = {
  downloadId: number;
  kind: 'subtitle' | 'video' | 'unknown';
  filename: string;
  state: 'in_progress' | 'complete' | 'interrupted';
  error?: string;
  createdAt: number;
  updatedAt: number;
};

let overlayEl: HTMLDivElement | null = null;
let timer: number | null = null;

function ensureStyle() {
  const styleId = 'bilibili-download-manager-style';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .bilibili-download-manager * { box-sizing: border-box; }
    .bilibili-download-manager .panel { background: white; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); max-width: 860px; max-height: 82vh; width: 92%; display: flex; flex-direction: column; overflow: hidden; }
    .bilibili-download-manager .header { padding: 16px 18px; border-bottom: 1px solid #e5e9ef; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .bilibili-download-manager .title { font-size: 16px; font-weight: 700; color: #18191c; }
    .bilibili-download-manager .sub { font-size: 12px; color: #61666d; white-space: nowrap; }
    .bilibili-download-manager .body { flex: 1; overflow: auto; }
    .bilibili-download-manager table { border-collapse: collapse; width: 100%; }
    .bilibili-download-manager th, .bilibili-download-manager td { border-bottom: 1px solid #e5e9ef; padding: 10px 12px; font-size: 13px; }
    .bilibili-download-manager th { text-align: left; font-weight: 600; color: #18191c; background: #fafbfc; position: sticky; top: 0; z-index: 1; }
    .bilibili-download-manager .muted { color: #61666d; }
    .bilibili-download-manager .status { font-weight: 700; font-size: 12px; white-space: nowrap; }
    .bilibili-download-manager .status.running { color: #0277bd; }
    .bilibili-download-manager .status.success { color: #2e7d32; }
    .bilibili-download-manager .status.failed { color: #e65100; }
    .bilibili-download-manager .error { color: #9499a0; max-width: 460px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bilibili-download-manager .footer { padding: 12px 18px; border-top: 1px solid #e5e9ef; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .bilibili-download-manager .btn { padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.2s; user-select: none; font-family: inherit; }
    .bilibili-download-manager .btn.primary { background: #00aeec; border: none; color: white; }
    .bilibili-download-manager .btn.primary:hover { background: #00a1d6; }
    .bilibili-download-manager .btn.ghost { background: white; border: 1px solid #e5e9ef; color: #18191c; }
    .bilibili-download-manager .btn.ghost:hover { background: #f6f7f9; border-color: #00aeec; color: #00aeec; }
  `;
  document.head.appendChild(style);
}

function basename(filename: string) {
  const s = String(filename || '');
  const parts = s.split(/[\\/]/);
  return parts[parts.length - 1] || s;
}

function kindLabel(kind: DownloadTask['kind'], filename: string) {
  if (kind === 'subtitle' || filename.toLowerCase().endsWith('.txt')) return '字幕';
  if (kind === 'video') return '视频';
  return '下载';
}

function statusLabel(state: DownloadTask['state']) {
  if (state === 'complete') return { text: '已完成', cls: 'success' as const };
  if (state === 'interrupted') return { text: '失败', cls: 'failed' as const };
  return { text: '下载中', cls: 'running' as const };
}

async function fetchTasks(): Promise<DownloadTask[]> {
  const response: any = await chrome.runtime.sendMessage({ type: 'LIST_DOWNLOAD_TASKS' });
  if (!response?.success) return [];
  const tasks = response?.data?.tasks as DownloadTask[] | undefined;
  return Array.isArray(tasks) ? tasks : [];
}

function computeStats(tasks: DownloadTask[]) {
  let running = 0;
  let success = 0;
  let failed = 0;
  tasks.forEach((t) => {
    if (t.state === 'in_progress') running++;
    else if (t.state === 'complete') success++;
    else failed++;
  });
  return { total: tasks.length, running, success, failed };
}

async function render() {
  if (!overlayEl) return;
  const listEl = overlayEl.querySelector('#bdm-tbody') as HTMLTableSectionElement | null;
  const subEl = overlayEl.querySelector('#bdm-sub') as HTMLDivElement | null;
  if (!listEl || !subEl) return;

  const tasks = await fetchTasks();
  const stats = computeStats(tasks);
  subEl.textContent = `总计 ${stats.total} ｜下载中 ${stats.running} ｜完成 ${stats.success} ｜失败 ${stats.failed}`;

  listEl.innerHTML = '';

  if (tasks.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="muted" colspan="5">暂无记录（仅显示由本扩展发起的下载）</td>`;
    listEl.appendChild(tr);
    return;
  }

  tasks.slice(0, 80).forEach((t, idx) => {
    const tr = document.createElement('tr');
    const name = basename(t.filename);
    const kind = kindLabel(t.kind, t.filename);
    const status = statusLabel(t.state);
    const error = t.error ? String(t.error) : '';
    tr.innerHTML = `
      <td class="muted" style="width: 56px;">${idx + 1}</td>
      <td style="width: 70px;" class="muted">${kind}</td>
      <td title="${name}">${name}</td>
      <td style="width: 100px;"><span class="status ${status.cls}">${status.text}</span></td>
      <td class="error" title="${error}">${error}</td>
    `;
    listEl.appendChild(tr);
  });
}

function stopAutoRefresh() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  timer = setInterval(() => {
    void render();
  }, 1000) as any;
}

export function openDownloadManagerOverlay() {
  ensureStyle();

  if (overlayEl) {
    overlayEl.style.display = 'flex';
    startAutoRefresh();
    void render();
    return;
  }

  overlayEl = document.createElement('div');
  overlayEl.className = 'bilibili-download-manager';
  overlayEl.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  overlayEl.innerHTML = `
    <div class="panel">
      <div class="header">
        <div>
          <div class="title">下载任务面板</div>
          <div class="sub" id="bdm-sub">加载中...</div>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="btn ghost" id="bdm-open-downloads">系统下载</button>
          <button class="btn ghost" id="bdm-refresh">刷新</button>
          <button class="btn primary" id="bdm-close">关闭</button>
        </div>
      </div>
      <div class="body">
        <table>
          <thead>
            <tr>
              <th style="width:56px;">序号</th>
              <th style="width:70px;">类型</th>
              <th>文件</th>
              <th style="width:100px;">状态</th>
              <th>失败原因</th>
            </tr>
          </thead>
          <tbody id="bdm-tbody"></tbody>
        </table>
      </div>
      <div class="footer">
        <div class="muted" style="font-size:12px;">提示：这是“下载总览”。批量任务的重试仍在批量任务进度表里。</div>
        <div class="muted" style="font-size:12px;">入口：插件图标 → 下载管理</div>
      </div>
    </div>
  `;

  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) {
      overlayEl!.style.display = 'none';
      stopAutoRefresh();
    }
  });

  (overlayEl.querySelector('#bdm-close') as HTMLButtonElement).addEventListener('click', () => {
    overlayEl!.style.display = 'none';
    stopAutoRefresh();
  });

  (overlayEl.querySelector('#bdm-refresh') as HTMLButtonElement).addEventListener('click', () => {
    void render();
  });

  (overlayEl.querySelector('#bdm-open-downloads') as HTMLButtonElement).addEventListener(
    'click',
    () => {
      chrome.runtime.sendMessage({ type: 'OPEN_CHROME_DOWNLOADS' });
    }
  );

  document.body.appendChild(overlayEl);
  startAutoRefresh();
  void render();
}

export function setupDownloadManagerListener() {
  chrome.runtime.onMessage.addListener((request) => {
    if (request?.type === 'OPEN_DOWNLOAD_MANAGER') {
      openDownloadManagerOverlay();
    }
  });
}

