export const LIGHTS_OFF_MODULE_ID = 'lights-off';

export const LIGHTS_OFF_IDS = {
  style: 'bilibili-lights-off-style',
  layer: 'bilibili-lights-off-layer',
  control: 'bilibili-lights-off-control',
} as const;

export const MASK_PANES = ['top', 'right', 'bottom', 'left'] as const;

export type MaskPane = (typeof MASK_PANES)[number];

export const PLAYER_CONTROL = {
  offset: 14,
  width: 78,
  height: 32,
} as const;

export const OPACITY_LIMITS = {
  default: 72,
  min: 20,
  max: 92,
} as const;

export const PLAYER_SELECTORS = [
  '#bilibili-player',
  '.bpx-player-container',
  '.bpx-player-primary-area',
  '.player-wrap',
] as const;

export type LightsOffSettings = {
  opacity: number;
};
