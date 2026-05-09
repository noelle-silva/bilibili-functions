import {
  MASK_PANES,
  PLAYER_CONTROL,
  type MaskPane,
} from '@/modules/lights-off/constants';
import type { ViewportRect } from '@/modules/lights-off/viewport';

export type ElementPosition = {
  left: number;
  top: number;
};

export type PaneRect = ElementPosition & {
  width: number;
  height: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type LightsOffLayout = {
  controls: ElementPosition;
  settingsPanel: ElementPosition;
  panes: Record<MaskPane, PaneRect>;
};

export function createLightsOffLayout(rect: ViewportRect, viewport: ViewportSize): LightsOffLayout {
  const controls = getControlsPosition(rect, viewport);
  return {
    controls,
    settingsPanel: getSettingsPanelPosition(controls.left, controls.top, viewport),
    panes: getPaneRects(rect, viewport),
  };
}

function getControlsPosition(rect: ViewportRect, viewport: ViewportSize): ElementPosition {
  return {
    left: clamp(rect.right - PLAYER_CONTROL.offset, PLAYER_CONTROL.offset, viewport.width - PLAYER_CONTROL.offset),
    top: clamp(rect.top + PLAYER_CONTROL.offset, PLAYER_CONTROL.offset, viewport.height - PLAYER_CONTROL.offset),
  };
}

function getSettingsPanelPosition(
  anchorX: number,
  controlsTop: number,
  viewport: ViewportSize
): ElementPosition {
  const panelWidth = Math.min(PLAYER_CONTROL.panelWidth, viewport.width - PLAYER_CONTROL.offset * 2);

  return {
    left: clamp(anchorX, panelWidth + PLAYER_CONTROL.offset, viewport.width - PLAYER_CONTROL.offset),
    top: clamp(
      controlsTop + 42,
      PLAYER_CONTROL.offset,
      viewport.height - PLAYER_CONTROL.panelMinHeight - PLAYER_CONTROL.offset
    ),
  };
}

function getPaneRects(rect: ViewportRect, viewport: ViewportSize): Record<MaskPane, PaneRect> {
  const top = clamp(rect.top, 0, viewport.height);
  const bottom = clamp(rect.bottom, 0, viewport.height);
  const left = clamp(rect.left, 0, viewport.width);
  const right = clamp(rect.right, 0, viewport.width);
  const centerHeight = Math.max(0, bottom - top);
  const panes = {} as Record<MaskPane, PaneRect>;

  for (const paneName of MASK_PANES) {
    panes[paneName] = getPaneRect(paneName, {
      top,
      bottom,
      left,
      right,
      centerHeight,
      viewport,
    });
  }

  return panes;
}

type PaneContext = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  centerHeight: number;
  viewport: ViewportSize;
};

function getPaneRect(paneName: MaskPane, context: PaneContext): PaneRect {
  const { top, bottom, left, right, centerHeight, viewport } = context;

  if (paneName === 'top') {
    return { left: 0, top: 0, width: viewport.width, height: top };
  }

  if (paneName === 'bottom') {
    return { left: 0, top: bottom, width: viewport.width, height: viewport.height - bottom };
  }

  if (paneName === 'left') {
    return { left: 0, top, width: left, height: centerHeight };
  }

  return { left: right, top, width: viewport.width - right, height: centerHeight };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
