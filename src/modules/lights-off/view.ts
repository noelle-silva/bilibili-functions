import {
  LIGHTS_OFF_IDS,
  MASK_PANES,
  OPACITY_LIMITS,
  type MaskPane,
} from '@/modules/lights-off/constants';

export type LightsOffView = {
  layer: HTMLElement;
  controls: HTMLElement;
  toggleButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
  settingsPanel: HTMLElement;
  opacityInput: HTMLInputElement;
  panes: Record<MaskPane, HTMLElement>;
};

export type LightsOffViewHandlers = {
  onToggle: () => void;
  onSettingsToggle: () => void;
  onOpacityInput: (value: number) => void;
  onOpacityCommit: () => void;
};

export function createLightsOffView(handlers: LightsOffViewHandlers): LightsOffView {
  const layer = document.createElement('div');
  layer.id = LIGHTS_OFF_IDS.layer;
  layer.setAttribute('data-v-inspector-ignore', 'true');
  layer.setAttribute('data-custom-extension', 'true');

  const panes = createMaskPanes(layer);
  const controls = createControls(handlers);
  const settingsPanel = createSettingsPanel(handlers);
  const toggleButton = controls.querySelector<HTMLButtonElement>(`#${LIGHTS_OFF_IDS.toggleButton}`);
  const settingsButton = controls.querySelector<HTMLButtonElement>(`#${LIGHTS_OFF_IDS.settingsButton}`);
  const opacityInput = settingsPanel.querySelector<HTMLInputElement>('.bilibili-lights-off-slider');

  if (!toggleButton || !settingsButton || !opacityInput) {
    throw new Error('视频关灯视图创建失败');
  }

  layer.append(controls, settingsPanel);

  return {
    layer,
    controls,
    toggleButton,
    settingsButton,
    settingsPanel,
    opacityInput,
    panes,
  };
}

function createMaskPanes(layer: HTMLElement): Record<MaskPane, HTMLElement> {
  const panes = {} as Record<MaskPane, HTMLElement>;

  for (const paneName of MASK_PANES) {
    const pane = document.createElement('div');
    pane.className = 'bilibili-lights-off-pane';
    pane.dataset.pane = paneName;
    layer.appendChild(pane);
    panes[paneName] = pane;
  }

  return panes;
}

function createControls(handlers: LightsOffViewHandlers): HTMLElement {
  const controls = document.createElement('div');
  controls.id = LIGHTS_OFF_IDS.controls;
  controls.setAttribute('data-v-inspector-ignore', 'true');
  controls.setAttribute('data-custom-extension', 'true');

  const toggleButton = document.createElement('button');
  toggleButton.id = LIGHTS_OFF_IDS.toggleButton;
  toggleButton.className = 'bilibili-lights-off-button';
  toggleButton.type = 'button';
  toggleButton.addEventListener('click', handlers.onToggle);

  const settingsButton = document.createElement('button');
  settingsButton.id = LIGHTS_OFF_IDS.settingsButton;
  settingsButton.className = 'bilibili-lights-off-button';
  settingsButton.type = 'button';
  settingsButton.textContent = '⚙';
  settingsButton.setAttribute('aria-label', '打开遮罩透明度设置');
  settingsButton.setAttribute('aria-controls', LIGHTS_OFF_IDS.settingsPanel);
  settingsButton.addEventListener('click', handlers.onSettingsToggle);

  controls.append(toggleButton, settingsButton);
  return controls;
}

function createSettingsPanel(handlers: LightsOffViewHandlers): HTMLElement {
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
  slider.addEventListener('input', () => handlers.onOpacityInput(Number(slider.value)));
  slider.addEventListener('change', handlers.onOpacityCommit);

  header.append(label, value);
  panel.append(header, slider);
  return panel;
}
