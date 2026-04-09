type DownloadState = 'in_progress' | 'complete' | 'interrupted';

type DownloadSnapshot = {
  state?: DownloadState;
  error?: string;
  bytesReceived?: number;
  totalBytes?: number;
};

type Waiter = {
  resolve: () => void;
  reject: (err: Error) => void;
};

const lastSnapshot = new Map<number, DownloadSnapshot>();
const waiters = new Map<number, Waiter[]>();
let listenerInstalled = false;

function ensureListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;

  chrome.runtime.onMessage.addListener((request) => {
    if (request?.type !== 'DOWNLOAD_CHANGED') return;
    const data = request.data || {};
    const downloadId = Number(data.downloadId);
    if (!downloadId) return;

    const snapshot: DownloadSnapshot = {
      state: data.state,
      error: data.error,
      bytesReceived: data.bytesReceived,
      totalBytes: data.totalBytes,
    };

    lastSnapshot.set(downloadId, snapshot);

    if (snapshot.state === 'complete' || snapshot.state === 'interrupted') {
      const list = waiters.get(downloadId) || [];
      waiters.delete(downloadId);

      if (snapshot.state === 'complete') {
        list.forEach((w) => w.resolve());
      } else {
        const reason = snapshot.error ? `下载失败：${snapshot.error}` : '下载失败：interrupted';
        list.forEach((w) => w.reject(new Error(reason)));
      }
    }
  });
}

export function waitForDownloadCompletion(downloadId: number): Promise<void> {
  ensureListener();

  const snapshot = lastSnapshot.get(downloadId);
  if (snapshot?.state === 'complete') return Promise.resolve();
  if (snapshot?.state === 'interrupted') {
    const reason = snapshot.error ? `下载失败：${snapshot.error}` : '下载失败：interrupted';
    return Promise.reject(new Error(reason));
  }

  return new Promise<void>((resolve, reject) => {
    const list = waiters.get(downloadId) || [];
    list.push({ resolve, reject });
    waiters.set(downloadId, list);
  });
}

