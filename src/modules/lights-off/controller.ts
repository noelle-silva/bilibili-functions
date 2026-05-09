import {
  LIGHTS_OFF_IDS,
  LIGHTS_OFF_MODULE_ID,
  MASK_PANES,
  OPACITY_LIMITS,
  PLAYER_CONTROL,
  type LightsOffSettings,
  type MaskPane,
} from '@/modules/lights-off/constants';
import { installLightsOffStyles, removeLightsOffStyles } from '@/modules/lights-off/styles';
import {
  containsPoint,
  findCleanVideoElement,
  getCleanVideoRect,
  type ViewportRect,
} from '@/modules/lights-off/viewport';
import { getModuleSettings, updateModuleSettings } from '@/utils/storage';

type PointerPosition = {
  x: number;
  y: number;
};

export class LightsOffController {
  private layer: HTMLElement | null = null;
  private controls: HTMLElement | null = null;
  private toggleButton: HTMLButtonElement | null = null;
  private settingsButton: HTMLButtonElement | null = null;
  private settingsPanel: HTMLElement | null = null;
  private opacityInput: HTMLInputElement | null = null;
  private video: HTMLVideoElement | null = null;
  private videoRect: ViewportRect | null = null;
  private panes: Partial<Record<MaskPane, HTMLElement>> = {};
  private observer: MutationObserver | null = null;
  private syncTimer: number | null = null;
  private enabled = false;
  private active = false;
  private visible = false;
  private settingsOpen = false;
  private pointer: PointerPosition | null = null;
  private opacity: number = OPACITY_LIMITS.default;

  async mount(): Promise<void> {
    if (this.enabled) return;

    this.enabled = true;
    await this.loadSettings();
    installLightsOffStyles();
    this.ensureLayer();
    this.syncVideoBinding();
    this.observePageChanges();
    this.bindViewportEvents();
  }

  unmount(): void {
    this.enabled = false;
    this.setActive(false);
    this.setSettingsOpen(false);
    this.disconnectObserver();
    this.unbindViewportEvents();
    this.unbindVideoEvents();
    this.removeLayer();
    removeLightsOffStyles();
    this.video = null;
    this.videoRect = null;
    this.pointer = null;
  }

  private async loadSettings(): Promise<void> {
    const settings = await getModuleSettings<LightsOffSettings>(LIGHTS_OFF_MODULE_ID);
    this.opacity = this.normalizeOpacity(settings.opacity);
  }

  private ensureLayer(): void {
    const existing = document.getElementById(LIGHTS_OFF_IDS.layer);
    if (existing) {
      this.layer = existing;
      this.controls = existing.querySelector<HTMLElement>(`#${LIGHTS_OFF_IDS.controls}`);
      this.toggleButton = existing.querySelector<HTMLButtonElement>(`#${LIGHTS_OFF_IDS.toggleButton}`);
      this.settingsButton = existing.querySelector<HTMLButtonElement>(
        `#${LIGHTS_OFF_IDS.settingsButton}`
      );
      this.settingsPanel = existing.querySelector<HTMLElement>(`#${LIGHTS_OFF_IDS.settingsPanel}`);
      this.opacityInput = existing.querySelector<HTMLInputElement>('.bilibili-lights-off-slider');
      this.bindExistingPanes(existing);
      this.syncLayerState();
      return;
    }

    const layer = document.createElement('div');
    layer.id = LIGHTS_OFF_IDS.layer;
    layer.setAttribute('data-v-inspector-ignore', 'true');
    layer.setAttribute('data-custom-extension', 'true');

    for (const paneName of MASK_PANES) {
      const pane = document.createElement('div');
      pane.className = 'bilibili-lights-off-pane';
      pane.dataset.pane = paneName;
      layer.appendChild(pane);
      this.panes[paneName] = pane;
    }

    const controls = document.createElement('div');
    controls.id = LIGHTS_OFF_IDS.controls;
    controls.setAttribute('data-v-inspector-ignore', 'true');
    controls.setAttribute('data-custom-extension', 'true');

    const toggleButton = this.createToggleButton();
    const settingsButton = this.createSettingsButton();
    controls.append(toggleButton, settingsButton);

    const settingsPanel = this.createSettingsPanel();

    layer.append(controls, settingsPanel);
    document.body.appendChild(layer);

    this.layer = layer;
    this.controls = controls;
    this.toggleButton = toggleButton;
    this.settingsButton = settingsButton;
    this.settingsPanel = settingsPanel;
    this.syncLayerState();
  }

  private createToggleButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = LIGHTS_OFF_IDS.toggleButton;
    button.className = 'bilibili-lights-off-button';
    button.type = 'button';
    button.addEventListener('click', () => this.setActive(!this.active));
    return button;
  }

  private createSettingsButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = LIGHTS_OFF_IDS.settingsButton;
    button.className = 'bilibili-lights-off-button';
    button.type = 'button';
    button.textContent = '⚙';
    button.setAttribute('aria-label', '打开遮罩透明度设置');
    button.setAttribute('aria-controls', LIGHTS_OFF_IDS.settingsPanel);
    button.addEventListener('click', () => this.setSettingsOpen(!this.settingsOpen));
    return button;
  }

  private createSettingsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = LIGHTS_OFF_IDS.settingsPanel;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', '关灯遮罩设置');

    const header = document.createElement('div');
    header.className = 'bilibili-lights-off-panel-header';

    const label = document.createElement('span');
    label.textContent = '遮罩透明度';

    const value = document.createElement('span');
    value.className = 'bilibili-lights-off-value';

    const slider = document.createElement('input');
    slider.className = 'bilibili-lights-off-slider';
    slider.type = 'range';
    slider.min = String(OPACITY_LIMITS.min);
    slider.max = String(OPACITY_LIMITS.max);
    slider.step = '1';
    slider.setAttribute('aria-label', '调节关灯遮罩透明度');
    slider.addEventListener('input', () => {
      this.opacity = this.normalizeOpacity(Number(slider.value));
      this.syncLayerState();
    });
    slider.addEventListener('change', () => {
      void updateModuleSettings(LIGHTS_OFF_MODULE_ID, { opacity: this.opacity });
    });

    header.append(label, value);
    panel.append(header, slider);
    this.opacityInput = slider;
    return panel;
  }

  private bindExistingPanes(layer: HTMLElement): void {
    this.panes = {};
    for (const paneName of MASK_PANES) {
      const pane = layer.querySelector<HTMLElement>(`[data-pane="${paneName}"]`);
      if (pane) this.panes[paneName] = pane;
    }
  }

  private syncVideoBinding(): void {
    const video = findCleanVideoElement();
    if (!video) {
      this.setVideo(null);
      this.scheduleSync();
      return;
    }

    this.setVideo(video);
    this.syncGeometry();
  }

  private setVideo(video: HTMLVideoElement | null): void {
    if (this.video === video) return;

    this.unbindVideoEvents();
    this.video = video;
    this.videoRect = null;

    if (video) {
      video.addEventListener('loadedmetadata', this.handleVideoMetadataChange);
      video.addEventListener('resize', this.handleVideoMetadataChange);
    } else {
      this.setActive(false);
      this.setSettingsOpen(false);
      this.setVisible(false);
    }
  }

  private syncGeometry(): void {
    if (!this.video) {
      this.videoRect = null;
      this.syncLayerState();
      return;
    }

    const rect = getCleanVideoRect(this.video);
    if (!rect) {
      this.videoRect = null;
      this.setVisible(false);
      this.syncLayerState();
      return;
    }

    this.videoRect = rect;
    this.syncControlPosition(rect);
    this.syncMaskGeometry(rect);
    this.syncHoverState();
    this.syncLayerState();
  }

  private syncControlPosition(rect: ViewportRect): void {
    if (!this.controls || !this.settingsPanel) return;

    const anchorX = this.clamp(
      rect.right - PLAYER_CONTROL.offset,
      PLAYER_CONTROL.offset,
      window.innerWidth - PLAYER_CONTROL.offset
    );
    const top = this.clamp(
      rect.top + PLAYER_CONTROL.offset,
      PLAYER_CONTROL.offset,
      window.innerHeight - PLAYER_CONTROL.offset
    );
    const panelWidth = Math.min(PLAYER_CONTROL.panelWidth, window.innerWidth - PLAYER_CONTROL.offset * 2);
    const panelAnchorX = this.clamp(
      anchorX,
      panelWidth + PLAYER_CONTROL.offset,
      window.innerWidth - PLAYER_CONTROL.offset
    );
    const panelTop = this.clamp(
      top + 42,
      PLAYER_CONTROL.offset,
      window.innerHeight - PLAYER_CONTROL.panelMinHeight - PLAYER_CONTROL.offset
    );

    this.controls.style.left = `${anchorX}px`;
    this.controls.style.top = `${top}px`;
    this.settingsPanel.style.left = `${panelAnchorX}px`;
    this.settingsPanel.style.top = `${panelTop}px`;
  }

  private syncMaskGeometry(rect: ViewportRect): void {
    if (!this.active) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const top = this.clamp(rect.top, 0, viewportHeight);
    const bottom = this.clamp(rect.bottom, 0, viewportHeight);
    const left = this.clamp(rect.left, 0, viewportWidth);
    const right = this.clamp(rect.right, 0, viewportWidth);
    const centerHeight = Math.max(0, bottom - top);

    this.setPaneRect('top', 0, 0, viewportWidth, top);
    this.setPaneRect('bottom', 0, bottom, viewportWidth, viewportHeight - bottom);
    this.setPaneRect('left', 0, top, left, centerHeight);
    this.setPaneRect('right', right, top, viewportWidth - right, centerHeight);
  }

  private setPaneRect(
    paneName: MaskPane,
    left: number,
    top: number,
    width: number,
    height: number
  ): void {
    const pane = this.panes[paneName];
    if (!pane) return;

    pane.style.left = `${left}px`;
    pane.style.top = `${top}px`;
    pane.style.width = `${Math.max(0, width)}px`;
    pane.style.height = `${Math.max(0, height)}px`;
  }

  private setActive(active: boolean): void {
    this.active = active;
    if (!active) this.setSettingsOpen(false);
    this.syncGeometry();
    this.syncLayerState();
  }

  private setSettingsOpen(open: boolean): void {
    this.settingsOpen = open;
    this.syncLayerState();
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.settingsOpen = false;
    this.syncLayerState();
  }

  private syncHoverState(): void {
    if (!this.pointer || !this.videoRect) {
      this.setVisible(false);
      return;
    }

    const visible =
      containsPoint(this.videoRect, this.pointer.x, this.pointer.y) ||
      this.containsElementPoint(this.controls, this.pointer) ||
      this.containsElementPoint(this.settingsPanel, this.pointer);
    this.setVisible(visible);
  }

  private syncLayerState(): void {
    if (!this.layer) return;

    this.layer.dataset.active = String(this.active);
    this.layer.dataset.ready = String(Boolean(this.videoRect));
    this.layer.dataset.visible = String(this.visible && Boolean(this.videoRect));
    this.layer.dataset.settingsOpen = String(this.settingsOpen && this.visible);
    this.layer.style.setProperty('--bilibili-lights-off-opacity', String(this.opacity / 100));

    const value = this.layer.querySelector<HTMLElement>('.bilibili-lights-off-value');
    if (value) value.textContent = `${this.opacity}%`;

    if (this.opacityInput && this.opacityInput.value !== String(this.opacity)) {
      this.opacityInput.value = String(this.opacity);
    }

    this.syncButtonState();
  }

  private syncButtonState(): void {
    if (this.toggleButton) {
      this.toggleButton.textContent = this.active ? '开灯' : '关灯';
      this.toggleButton.setAttribute('aria-pressed', String(this.active));
      this.toggleButton.setAttribute(
        'aria-label',
        this.active ? '关闭视频关灯模式' : '打开视频关灯模式'
      );
    }

    if (this.settingsButton) {
      this.settingsButton.setAttribute('aria-expanded', String(this.settingsOpen && this.visible));
      this.settingsButton.setAttribute(
        'aria-label',
        this.settingsOpen ? '关闭遮罩透明度设置' : '打开遮罩透明度设置'
      );
    }
  }

  private observePageChanges(): void {
    if (this.observer) return;

    this.observer = new MutationObserver(() => this.scheduleSync());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private bindViewportEvents(): void {
    window.addEventListener('resize', this.handleViewportChange);
    window.addEventListener('scroll', this.handleViewportChange, true);
    document.addEventListener('mousemove', this.handlePointerMove, true);
    document.addEventListener('mouseleave', this.handlePointerLeave, true);
  }

  private unbindViewportEvents(): void {
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener('scroll', this.handleViewportChange, true);
    document.removeEventListener('mousemove', this.handlePointerMove, true);
    document.removeEventListener('mouseleave', this.handlePointerLeave, true);
  }

  private unbindVideoEvents(): void {
    if (!this.video) return;
    this.video.removeEventListener('loadedmetadata', this.handleVideoMetadataChange);
    this.video.removeEventListener('resize', this.handleVideoMetadataChange);
  }

  private handleViewportChange = (): void => {
    this.syncGeometry();
  };

  private handlePointerMove = (event: MouseEvent): void => {
    this.pointer = { x: event.clientX, y: event.clientY };
    this.syncHoverState();
  };

  private handlePointerLeave = (): void => {
    this.pointer = null;
    this.setVisible(false);
  };

  private handleVideoMetadataChange = (): void => {
    this.syncGeometry();
  };

  private scheduleSync(): void {
    if (!this.enabled || this.syncTimer !== null) return;

    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      this.syncVideoBinding();
    }, 200);
  }

  private normalizeOpacity(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return OPACITY_LIMITS.default;
    return Math.min(OPACITY_LIMITS.max, Math.max(OPACITY_LIMITS.min, Math.round(value)));
  }

  private containsElementPoint(element: HTMLElement | null, point: PointerPosition): boolean {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  private disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private removeLayer(): void {
    if (this.layer) {
      this.layer.remove();
      this.layer = null;
      this.controls = null;
      this.toggleButton = null;
      this.settingsButton = null;
      this.settingsPanel = null;
      this.opacityInput = null;
      this.panes = {};
    }
  }
}
