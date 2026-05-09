export const LIGHTS_OFF_MODULE_ID = 'lights-off';

export const LIGHTS_OFF_IDS = {
  style: 'bilibili-lights-off-style',
  layer: 'bilibili-lights-off-layer',
  controls: 'bilibili-lights-off-controls',
  toggleButton: 'bilibili-lights-off-toggle',
  settingsButton: 'bilibili-lights-off-settings-toggle',
  settingsPanel: 'bilibili-lights-off-settings-panel',
} as const;

export const MASK_PANES = ['top', 'right', 'bottom', 'left'] as const;

export type MaskPane = (typeof MASK_PANES)[number];

export const PLAYER_CONTROL = {
  offset: 14,
  panelWidth: 260,
  panelMinHeight: 98,
} as const;

export const OPACITY_LIMITS = {
  default: 72,
  min: 20,
  max: 92,
} as const;

export const VIDEO_ELEMENT_SELECTORS = [
  '#bilibili-player video',
  '.bpx-player-container video',
  '.bpx-player-video-area video',
  '.bpx-player-video-wrap video',
] as const;

export type LightsOffSettings = {
  opacity: number;
};
