export type TextDownloadKind = 'subtitle' | 'comment';

export async function downloadTextThroughBackground(
  filename: string,
  content: string,
  kind: TextDownloadKind = 'subtitle'
) {
  const response: any = await chrome.runtime.sendMessage({
    type: 'DOWNLOAD_TEXT',
    data: { filename, content, kind },
  });

  if (!response?.success) {
    throw new Error(response?.error || '创建下载任务失败');
  }

  const downloadId = Number(response?.data?.downloadId);
  if (!downloadId) return 0;
  return downloadId;
}
