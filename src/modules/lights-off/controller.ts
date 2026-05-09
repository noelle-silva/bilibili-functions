import {
  LIGHTS_OFF_IDS,
  LIGHTS_OFF_MODULE_ID,
  OPACITY_LIMITS,
  type LightsOffSettings,
  type MaskPane,
} from '@/modules/lights-off/constants';
import { createLightsOffLayout } from '@/modules/lights-off/layout';
import { installLightsOffStyles, removeLightsOffStyles } from '@/modules/lights-off/styles';
import { createLightsOffView } from '@/modules/lights-off/view';
import { findCleanVideoElement, getCleanVideoRect, type ViewportRect } from '@/modules/lights-off/viewport';
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
  private hoverVisible = false;
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
    document.getElementById(LIGHTS_OFF_IDS.layer)?.remove();

    const view = createLightsOffView({
      onToggle: () => this.setActive(!this.active),
      onSettingsToggle: () => this.setSettingsOpen(!this.settingsOpen),
      onOpacityInput: (value) => {
        this.opacity = this.normalizeOpacity(value);
        this.syncLayerState();
      },
      onOpacityCommit: () => {
        void updateModuleSettings(LIGHTS_OFF_MODULE_ID, { opacity: this.opacity });
      },
    });

    document.body.appendChild(view.layer);
    this.layer = view.layer;
    this.controls = view.controls;
    this.toggleButton = view.toggleButton;
    this.settingsButton = view.settingsButton;
    this.settingsPanel = view.settingsPanel;
    this.opacityInput = view.opacityInput;
    this.panes = view.panes;
    this.syncLayerState();
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
      this.setHoverVisible(false);
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
      this.setHoverVisible(false);
      this.syncLayerState();
      return;
    }

    this.videoRect = rect;
    this.syncLayout(rect);
    this.syncPointerVisibility();
    this.syncLayerState();
  }

  private syncLayout(rect: ViewportRect): void {
    if (!this.controls || !this.settingsPanel) return;

    const layout = createLightsOffLayout(rect, {
      width: window.innerWidth,
      height: window.innerHeight,
    });

    this.controls.style.left = `${layout.controls.left}px`;
    this.controls.style.top = `${layout.controls.top}px`;
    this.settingsPanel.style.left = `${layout.settingsPanel.left}px`;
    this.settingsPanel.style.top = `${layout.settingsPanel.top}px`;

    if (!this.active) return;

    for (const paneName of Object.keys(layout.panes) as MaskPane[]) {
      const paneRect = layout.panes[paneName];
      this.setPaneRect(paneName, paneRect.left, paneRect.top, paneRect.width, paneRect.height);
    }
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

  private setHoverVisible(visible: boolean): void {
    this.hoverVisible = visible;
    this.syncLayerState();
  }

  private syncPointerVisibility(): void {
    if (!this.pointer || !this.videoRect) {
      this.setHoverVisible(false);
      return;
    }

    const visible =
      this.containsRectPoint(this.videoRect, this.pointer) ||
      this.containsElementPoint(this.controls, this.pointer) ||
      this.containsElementPoint(this.settingsPanel, this.pointer);
    this.setHoverVisible(visible);
  }

  private syncLayerState(): void {
    if (!this.layer) return;

    const ready = Boolean(this.videoRect);
    const uiVisible = ready && (this.hoverVisible || this.settingsOpen);

    this.layer.dataset.active = String(this.active);
    this.layer.dataset.ready = String(ready);
    this.layer.dataset.visible = String(uiVisible);
    this.layer.dataset.settingsOpen = String(this.settingsOpen && ready);
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
      this.settingsButton.setAttribute('aria-expanded', String(this.settingsOpen));
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
    this.syncPointerVisibility();
  };

  private handlePointerLeave = (): void => {
    this.pointer = null;
    this.setHoverVisible(false);
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

  private containsRectPoint(rect: ViewportRect, point: PointerPosition): boolean {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  private containsElementPoint(element: HTMLElement | null, point: PointerPosition): boolean {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
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
