export type BatchTaskStatus = 'pending' | 'running' | 'success' | 'failed';

export type BatchTaskItem = {
  id: string;
  label: string;
  meta?: Record<string, any>;
};

export type BatchTaskResult = {
  status: BatchTaskStatus;
  error?: string;
  lastRunAt?: number;
};

type RunItemOutcome = void | {
  completion?: Promise<void>;
};

type RunItem = (item: BatchTaskItem) => Promise<RunItemOutcome>;

function ensureGlobalStyle() {
  const styleId = 'bilibili-batch-progress-style';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .bilibili-batch-progress * { box-sizing: border-box; }
    .bilibili-batch-progress table { border-collapse: collapse; width: 100%; }
    .bilibili-batch-progress th, .bilibili-batch-progress td { border-bottom: 1px solid #e5e9ef; padding: 10px 12px; font-size: 13px; }
    .bilibili-batch-progress th { text-align: left; font-weight: 600; color: #18191c; background: #fafbfc; position: sticky; top: 0; z-index: 1; }
    .bilibili-batch-progress .muted { color: #61666d; }
    .bilibili-batch-progress .status { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
    .bilibili-batch-progress .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .bilibili-batch-progress .btn { padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer; transition: all 0.2s; user-select: none; }
    .bilibili-batch-progress .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .bilibili-batch-progress .btn.primary { background: #00aeec; border: none; color: white; }
    .bilibili-batch-progress .btn.primary:hover:not(:disabled) { background: #00a1d6; }
    .bilibili-batch-progress .btn.ghost { background: white; border: 1px solid #e5e9ef; color: #18191c; }
    .bilibili-batch-progress .btn.ghost:hover:not(:disabled) { background: #f6f7f9; }
    .bilibili-batch-progress .btn.warn { background: #ff7f50; border: none; color: white; }
    .bilibili-batch-progress .btn.warn:hover:not(:disabled) { background: #ff6a3a; }
    .bilibili-batch-progress .error { color: #f44336; max-width: 460px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `;
  document.head.appendChild(style);
}

function statusText(status: BatchTaskStatus) {
  if (status === 'pending') return '等待中';
  if (status === 'running') return '进行中';
  if (status === 'success') return '已完成';
  return '失败';
}

function statusColor(status: BatchTaskStatus) {
  if (status === 'pending') return '#9aa0a6';
  if (status === 'running') return '#2196f3';
  if (status === 'success') return '#4caf50';
  return '#f44336';
}

function safeErrorMessage(err: any) {
  const msg = err?.message || err?.toString?.() || '未知错误';
  return String(msg);
}

function computeStats(results: Map<string, BatchTaskResult>) {
  let pending = 0;
  let running = 0;
  let success = 0;
  let failed = 0;
  for (const v of results.values()) {
    if (v.status === 'pending') pending++;
    else if (v.status === 'running') running++;
    else if (v.status === 'success') success++;
    else failed++;
  }
  return { pending, running, success, failed, total: results.size };
}

export function openBatchProgressDialog(args: {
  title: string;
  items: BatchTaskItem[];
  runItem: RunItem;
  autoStart?: boolean;
}) {
  ensureGlobalStyle();

  const overlay = document.createElement('div');
  overlay.className = 'bilibili-batch-progress';
  overlay.style.cssText = `
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

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 860px;
    max-height: 82vh;
    width: 92%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 18px;
    border-bottom: 1px solid #e5e9ef;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;

  const titleEl = document.createElement('div');
  titleEl.textContent = args.title;
  titleEl.style.cssText = `
    font-size: 16px;
    font-weight: 700;
    color: #18191c;
  `;

  const statsEl = document.createElement('div');
  statsEl.className = 'muted';
  statsEl.style.cssText = `
    font-size: 13px;
    white-space: nowrap;
  `;

  const body = document.createElement('div');
  body.style.cssText = `
    flex: 1;
    overflow: auto;
  `;

  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 12px 18px;
    border-top: 1px solid #e5e9ef;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  `;

  const leftButtons = document.createElement('div');
  leftButtons.style.cssText = `display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;

  const rightButtons = document.createElement('div');
  rightButtons.style.cssText = `display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;

  const startBtn = document.createElement('button');
  startBtn.className = 'btn primary';
  startBtn.textContent = '开始';

  const retryFailedBtn = document.createElement('button');
  retryFailedBtn.className = 'btn warn';
  retryFailedBtn.textContent = '一键重试失败项';
  retryFailedBtn.disabled = true;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn ghost';
  closeBtn.textContent = '关闭';

  const hintEl = document.createElement('div');
  hintEl.className = 'muted';
  hintEl.style.cssText = `font-size: 12px;`;
  hintEl.textContent = '提示：失败项可以单独重试，也可以一键重试失败项。';

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 56px;">序号</th>
        <th>任务</th>
        <th style="width: 120px;">状态</th>
        <th>失败原因</th>
        <th style="width: 110px;">操作</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody')!;

  const results = new Map<string, BatchTaskResult>();
  const idToRow = new Map<string, HTMLTableRowElement>();
  for (const item of args.items) {
    results.set(item.id, { status: 'pending' });
  }

  let isStarting = false;

  const setButtonsState = () => {
    const { failed, running, total } = computeStats(results);
    startBtn.disabled = isStarting || total === 0;
    retryFailedBtn.disabled = isStarting || failed === 0;
    closeBtn.disabled = running > 0;
  };

  const renderStats = () => {
    const s = computeStats(results);
    statsEl.textContent = `总计 ${s.total} ｜完成 ${s.success} ｜失败 ${s.failed} ｜进行中 ${s.running} ｜等待 ${s.pending}`;
  };

  const renderRow = (item: BatchTaskItem, index: number) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="muted">${index + 1}</td>
      <td>${item.label}</td>
      <td></td>
      <td class="error" title=""></td>
      <td></td>
    `;

    const statusCell = row.children[2] as HTMLTableCellElement;
    const errorCell = row.children[3] as HTMLTableCellElement;
    const actionCell = row.children[4] as HTMLTableCellElement;

    const statusWrap = document.createElement('span');
    statusWrap.className = 'status';

    const dot = document.createElement('span');
    dot.className = 'dot';

    const text = document.createElement('span');
    statusWrap.appendChild(dot);
    statusWrap.appendChild(text);
    statusCell.appendChild(statusWrap);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn ghost';
    retryBtn.textContent = '重试';
    retryBtn.disabled = true;
    actionCell.appendChild(retryBtn);

    const applyStateToRow = () => {
      const r = results.get(item.id)!;
      dot.style.background = statusColor(r.status);
      text.textContent = statusText(r.status);
      const err = r.error || '';
      errorCell.textContent = err;
      errorCell.title = err;
      retryBtn.disabled = isStarting || r.status !== 'failed';
    };

    retryBtn.addEventListener('click', () => {
      void runOne(item);
    });

    idToRow.set(item.id, row);
    (row as any).__applyStateToRow = applyStateToRow;
    applyStateToRow();
    return row;
  };

  const refreshUI = () => {
    renderStats();
    setButtonsState();
    for (const item of args.items) {
      const row = idToRow.get(item.id) as any;
      row?.__applyStateToRow?.();
    }
  };

  const setResult = (id: string, next: BatchTaskResult) => {
    results.set(id, next);
    refreshUI();
  };

  const runOne = async (item: BatchTaskItem) => {
    if (isStarting) return;
    isStarting = true;
    refreshUI();

    setResult(item.id, { status: 'running', lastRunAt: Date.now() });
    try {
      const outcome = await args.runItem(item);
      const completion = outcome && typeof outcome === 'object' ? outcome.completion : undefined;
      if (completion) {
        void completion
          .then(() => setResult(item.id, { status: 'success', lastRunAt: Date.now() }))
          .catch((err) =>
            setResult(item.id, {
              status: 'failed',
              error: safeErrorMessage(err),
              lastRunAt: Date.now(),
            })
          )
          .finally(() => refreshUI());
      } else {
        setResult(item.id, { status: 'success', lastRunAt: Date.now() });
      }
    } catch (err) {
      setResult(item.id, {
        status: 'failed',
        error: safeErrorMessage(err),
        lastRunAt: Date.now(),
      });
    } finally {
      isStarting = false;
      refreshUI();
    }
  };

  const runMany = async (items: BatchTaskItem[]) => {
    if (isStarting) return;
    isStarting = true;
    refreshUI();

    for (const item of items) {
      setResult(item.id, { status: 'running', lastRunAt: Date.now() });
      try {
        const outcome = await args.runItem(item);
        const completion = outcome && typeof outcome === 'object' ? outcome.completion : undefined;
        if (completion) {
          void completion
            .then(() => setResult(item.id, { status: 'success', lastRunAt: Date.now() }))
            .catch((err) =>
              setResult(item.id, {
                status: 'failed',
                error: safeErrorMessage(err),
                lastRunAt: Date.now(),
              })
            )
            .finally(() => refreshUI());
        } else {
          setResult(item.id, { status: 'success', lastRunAt: Date.now() });
        }
      } catch (err) {
        setResult(item.id, {
          status: 'failed',
          error: safeErrorMessage(err),
          lastRunAt: Date.now(),
        });
      }
    }

    isStarting = false;
    refreshUI();
  };

  const startAll = async () => {
    await runMany(args.items);
  };

  const retryFailed = async () => {
    const failedItems = args.items.filter((i) => results.get(i.id)?.status === 'failed');
    if (failedItems.length === 0) return;
    await runMany(failedItems);
  };

  startBtn.addEventListener('click', () => {
    void startAll();
  });

  retryFailedBtn.addEventListener('click', () => {
    void retryFailed();
  });

  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !isStarting) {
      overlay.remove();
    }
  });

  header.appendChild(titleEl);
  header.appendChild(statsEl);

  body.appendChild(table);

  leftButtons.appendChild(startBtn);
  leftButtons.appendChild(retryFailedBtn);
  rightButtons.appendChild(hintEl);
  rightButtons.appendChild(closeBtn);

  footer.appendChild(leftButtons);
  footer.appendChild(rightButtons);

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);

  // 填充行
  tbody.innerHTML = '';
  args.items.forEach((item, index) => {
    tbody.appendChild(renderRow(item, index));
  });

  document.body.appendChild(overlay);
  refreshUI();

  const autoStart = args.autoStart ?? true;
  if (autoStart && args.items.length > 0) {
    void startAll();
  }

  return {
    close: () => overlay.remove(),
    retryFailed: () => void retryFailed(),
  };
}
