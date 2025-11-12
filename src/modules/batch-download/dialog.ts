import type { VideoPart } from '@/core/types';

/**
 * 创建批量下载对话框（使用原生 DOM）
 * 返回用户选择的分P列表
 */
export function createBatchDownloadDialog(pageList: VideoPart[]): Promise<VideoPart[]> {
  return new Promise((resolve) => {
    // 创建遮罩层
    const overlay = document.createElement('div');
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

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 600px;
      max-height: 80vh;
      width: 90%;
      display: flex;
      flex-direction: column;
    `;

    // 标题
    const title = document.createElement('div');
    title.textContent = '选择要下载的分P';
    title.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid #e5e9ef;
      font-size: 18px;
      font-weight: 600;
      color: #18191c;
    `;

    // 全选/取消全选
    const selectAllContainer = document.createElement('div');
    selectAllContainer.style.cssText = `
      padding: 12px 20px;
      border-bottom: 1px solid #e5e9ef;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.checked = true;
    selectAllCheckbox.style.cssText = `
      width: 16px;
      height: 16px;
      cursor: pointer;
    `;

    const selectAllLabel = document.createElement('label');
    selectAllLabel.textContent = `全选（共 ${pageList.length} 个分P）`;
    selectAllLabel.style.cssText = `
      cursor: pointer;
      user-select: none;
      font-size: 14px;
      color: #61666d;
    `;

    selectAllContainer.appendChild(selectAllCheckbox);
    selectAllContainer.appendChild(selectAllLabel);

    // 列表容器
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px 20px;
    `;

    // 创建列表项
    const checkboxes: HTMLInputElement[] = [];
    pageList.forEach((page) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: 4px;
        transition: background 0.2s;
      `;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#f6f7f9';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.page = page.page.toString();
      checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        cursor: pointer;
        flex-shrink: 0;
      `;

      const label = document.createElement('label');
      label.style.cssText = `
        flex: 1;
        cursor: pointer;
        user-select: none;
        font-size: 14px;
        color: #18191c;
      `;

      const pageNumber = document.createElement('span');
      pageNumber.textContent = `P${page.page}`;
      pageNumber.style.cssText = `
        color: #00aeec;
        font-weight: 600;
        margin-right: 8px;
      `;

      label.appendChild(pageNumber);
      label.appendChild(document.createTextNode(page.part));

      // 点击标签也能切换复选框
      label.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        updateSelectAllState();
      });

      item.appendChild(checkbox);
      item.appendChild(label);
      listContainer.appendChild(item);

      checkboxes.push(checkbox);
    });

    // 更新全选状态
    const updateSelectAllState = () => {
      const checkedCount = checkboxes.filter(cb => cb.checked).length;
      selectAllCheckbox.checked = checkedCount === checkboxes.length;
      selectAllCheckbox.indeterminate =
        checkedCount > 0 && checkedCount < checkboxes.length;
    };

    // 全选/取消全选逻辑
    selectAllCheckbox.addEventListener('change', () => {
      const checked = selectAllCheckbox.checked;
      checkboxes.forEach(cb => (cb.checked = checked));
    });

    selectAllLabel.addEventListener('click', () => {
      selectAllCheckbox.checked = !selectAllCheckbox.checked;
      selectAllCheckbox.dispatchEvent(new Event('change'));
    });

    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateSelectAllState);
    });

    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      padding: 16px 20px;
      border-top: 1px solid #e5e9ef;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    `;

    // 取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
      padding: 8px 20px;
      border: 1px solid #e5e9ef;
      border-radius: 4px;
      background: white;
      color: #61666d;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#f6f7f9';
    });

    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = 'white';
    });

    cancelButton.addEventListener('click', () => {
      overlay.remove();
      resolve([]);
    });

    // 确认按钮
    const confirmButton = document.createElement('button');
    confirmButton.textContent = '下载';
    confirmButton.style.cssText = `
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      background: #00aeec;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    confirmButton.addEventListener('mouseenter', () => {
      confirmButton.style.background = '#00a1d6';
    });

    confirmButton.addEventListener('mouseleave', () => {
      confirmButton.style.background = '#00aeec';
    });

    confirmButton.addEventListener('click', () => {
      const selectedIndices = checkboxes
        .map((cb, index) => (cb.checked ? index : -1))
        .filter(i => i !== -1);

      const selectedPages = selectedIndices.map(i => pageList[i]);

      overlay.remove();
      resolve(selectedPages);
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);

    // 组装对话框
    dialog.appendChild(title);
    dialog.appendChild(selectAllContainer);
    dialog.appendChild(listContainer);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);

    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve([]);
      }
    });

    // 添加到页面
    document.body.appendChild(overlay);
  });
}
