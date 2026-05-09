import {
  LIGHTS_OFF_IDS,
  LIGHTS_OFF_MODULE_ID,
  MASK_PANES,
  OPACITY_LIMITS,
  PLAYER_CONTROL,
  PLAYER_SELECTORS,
  type LightsOffSettings,
  type MaskPane,
} from '@/modules/lights-off/constants';
import { installLightsOffStyles, removeLightsOffStyles } from '@/modules/lights-off/styles';
import { getModuleSettings, updateModuleSettings } from '@/utils/storage';

export class LightsOffController {
  private layer: HTMLElement | null = null;
  private control: HTMLButtonElement | null = null;
  private opacityInput: HTMLInputElement | null = null;
  private player: HTMLElement | null = null;
  private panes: Partial<Record<MaskPane, HTMLElement>> = {};
  private observer: MutationObserver | null = null;
  private syncTimer: number | null = null;
  private enabled = false;
  private active = false;
  private opacity: number = OPACITY_LIMITS.default;

  async mount(): Promise<void> {
    if (this.enabled) return;

    this.enabled = true;
    await this.loadSettings();
    installLightsOffStyles();
    this.ensureLayer();
    this.syncPlayerBinding();
    this.observePlayerChanges();
    this.bindViewportEvents();
  }

  unmount(): void {
    this.enabled = false;
    this.setActive(false);
    this.disconnectObserver();
    this.unbindViewportEvents();
    this.removeLayer();
    removeLightsOffStyles();
    this.player = null;
  }

  private async loadSettings(): Promise<void> {
    const settings = await getModuleSettings<LightsOffSettings>(LIGHTS_OFF_MODULE_ID);
    this.opacity = this.normalizeOpacity(settings.opacity);
  }

  private ensureLayer(): void {
    const existing = document.getElementById(LIGHTS_OFF_IDS.layer);
    if (existing) {
      this.layer = existing;
      this.opacityInput = existing.querySelector<HTMLInputElement>('.bilibili-lights-off-slider');
      this.control = existing.querySelector<HTMLButtonElement>(`#${LIGHTS_OFF_IDS.control}`);
      this.bindExistingPanes(existing);
      this.syncOverlayState();
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

    const control = document.createElement('button');
    control.id = LIGHTS_OFF_IDS.control;
    control.type = 'button';
    control.setAttribute('aria-label', '打开视频关灯模式');
    control.setAttribute('data-v-inspector-ignore', 'true');
    control.setAttribute('data-custom-extension', 'true');
    control.addEventListener('click', () => this.toggleActive());

    const panel = document.createElement('div');
    panel.className = 'bilibili-lights-off-panel';

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
      this.syncOverlayState();
    });
    slider.addEventListener('change', () => {
      void updateModuleSettings(LIGHTS_OFF_MODULE_ID, { opacity: this.opacity });
    });

    header.append(label, value);
    panel.append(header, slider);
    layer.appendChild(control);
    layer.appendChild(panel);
    document.body.appendChild(layer);

    this.layer = layer;
    this.control = control;
    this.opacityInput = slider;
    this.syncOverlayState();
  }

  private bindExistingPanes(layer: HTMLElement): void {
    this.panes = {};
    for (const paneName of MASK_PANES) {
      const pane = layer.querySelector<HTMLElement>(`[data-pane="${paneName}"]`);
      if (pane) this.panes[paneName] = pane;
    }
  }

  private syncPlayerBinding(): void {
    const player = this.findPlayer();
    if (!player) {
      if (this.active) this.setActive(false);
      this.player = null;
      this.syncOverlayState();
      this.scheduleSync();
      return;
    }

    if (this.player !== player) {
      this.player = player;
      this.syncMaskGeometry();
    }

    this.syncOverlayState();
    this.syncMaskGeometry();
  }

  private findPlayer(): HTMLElement | null {
    for (const selector of PLAYER_SELECTORS) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) return element;
    }

    return null;
  }

  private toggleActive(): void {
    this.setActive(!this.active);
  }

  private setActive(active: boolean): void {
    this.active = active;
    this.syncOverlayState();
    this.syncMaskGeometry();
    this.syncControlState();
  }

  private syncOverlayState(): void {
    if (!this.layer) return;

    this.layer.dataset.active = String(this.active);
    this.layer.dataset.ready = String(Boolean(this.player));
    this.layer.style.setProperty('--bilibili-lights-off-opacity', String(this.opacity / 100));

    const value = this.layer.querySelector<HTMLElement>('.bilibili-lights-off-value');
    if (value) value.textContent = `${this.opacity}%`;

    if (this.opacityInput && this.opacityInput.value !== String(this.opacity)) {
      this.opacityInput.value = String(this.opacity);
    }
  }

  private syncMaskGeometry(): void {
    if (!this.player) return;

    const rect = this.player.getBoundingClientRect();
    this.syncControlPosition(rect);

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

  private syncControlPosition(playerRect: DOMRect): void {
    if (!this.control) return;

    const controlWidth = this.control.offsetWidth || PLAYER_CONTROL.width;
    const controlHeight = this.control.offsetHeight || PLAYER_CONTROL.height;
    const left = this.clamp(
      playerRect.right - PLAYER_CONTROL.offset - controlWidth,
      PLAYER_CONTROL.offset,
      window.innerWidth - controlWidth - PLAYER_CONTROL.offset
    );
    const top = this.clamp(
      playerRect.top + PLAYER_CONTROL.offset,
      PLAYER_CONTROL.offset,
      window.innerHeight - controlHeight - PLAYER_CONTROL.offset
    );

    this.control.style.left = `${left}px`;
    this.control.style.top = `${top}px`;
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

  private syncControlState(): void {
    if (!this.control) return;

    this.control.textContent = this.active ? '开灯' : '关灯';
    this.control.setAttribute('aria-pressed', String(this.active));
    this.control.setAttribute(
      'aria-label',
      this.active ? '关闭视频关灯模式' : '打开视频关灯模式'
    );
  }

  private observePlayerChanges(): void {
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
  }

  private unbindViewportEvents(): void {
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener('scroll', this.handleViewportChange, true);
  }

  private handleViewportChange = (): void => {
    this.syncMaskGeometry();
  };

  private scheduleSync(): void {
    if (!this.enabled || this.syncTimer !== null) return;

    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      this.syncPlayerBinding();
    }, 200);
  }

  private normalizeOpacity(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return OPACITY_LIMITS.default;
    return Math.min(OPACITY_LIMITS.max, Math.max(OPACITY_LIMITS.min, Math.round(value)));
  }

  private clamp(value: number, min: number, max: number): number {
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
      this.control = null;
      this.opacityInput = null;
      this.panes = {};
    }
  }
}
