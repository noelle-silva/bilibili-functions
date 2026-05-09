import { LIGHTS_OFF_IDS } from '@/modules/lights-off/constants';

export function installLightsOffStyles(): void {
  if (document.getElementById(LIGHTS_OFF_IDS.style)) return;

  const style = document.createElement('style');
  style.id = LIGHTS_OFF_IDS.style;
  style.textContent = createLightsOffCss();
  document.head.appendChild(style);
}

export function removeLightsOffStyles(): void {
  document.getElementById(LIGHTS_OFF_IDS.style)?.remove();
}

function createLightsOffCss(): string {
  return `
    #${LIGHTS_OFF_IDS.layer} {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      pointer-events: none;
    }

    #${LIGHTS_OFF_IDS.layer} .bilibili-lights-off-pane {
      position: fixed;
      display: none;
      background: rgba(0, 0, 0, var(--bilibili-lights-off-opacity, 0.72));
      pointer-events: auto;
    }

    #${LIGHTS_OFF_IDS.layer}[data-active="true"] .bilibili-lights-off-pane {
      display: block;
    }

    #${LIGHTS_OFF_IDS.layer} .bilibili-lights-off-panel {
      position: fixed;
      display: none;
      top: 20px;
      right: 24px;
      width: min(260px, calc(100vw - 48px));
      padding: 12px 14px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.72);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      box-shadow: 0 18px 52px rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(14px) saturate(140%);
      pointer-events: auto;
    }

    #${LIGHTS_OFF_IDS.layer}[data-active="true"] .bilibili-lights-off-panel {
      display: block;
    }

    #${LIGHTS_OFF_IDS.layer} .bilibili-lights-off-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    #${LIGHTS_OFF_IDS.layer} .bilibili-lights-off-value {
      color: #38bdf8;
      font-variant-numeric: tabular-nums;
    }

    #${LIGHTS_OFF_IDS.layer} .bilibili-lights-off-slider {
      width: 100%;
      height: 4px;
      margin: 0;
      border-radius: 999px;
      accent-color: #00aeec;
      cursor: pointer;
    }

    #${LIGHTS_OFF_IDS.control} {
      position: fixed;
      z-index: 2147483001;
      appearance: none;
      -webkit-appearance: none;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 78px;
      height: 32px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.68);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(12px) saturate(140%);
      transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
      pointer-events: auto;
    }

    #${LIGHTS_OFF_IDS.layer}[data-ready="true"] #${LIGHTS_OFF_IDS.control} {
      display: inline-flex;
    }

    #${LIGHTS_OFF_IDS.control}:hover {
      transform: translateY(-1px);
      border-color: rgba(56, 189, 248, 0.85);
      background: rgba(2, 132, 199, 0.78);
      box-shadow: 0 14px 38px rgba(14, 165, 233, 0.30);
    }

    #${LIGHTS_OFF_IDS.control}:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.34), 0 14px 38px rgba(14, 165, 233, 0.30);
    }

    #${LIGHTS_OFF_IDS.control}[aria-pressed="true"] {
      border-color: rgba(250, 204, 21, 0.88);
      background: rgba(113, 63, 18, 0.72);
      color: #fef3c7;
    }

    @media (max-width: 640px) {
      #${LIGHTS_OFF_IDS.layer} .bilibili-lights-off-panel {
        top: 12px;
        right: 12px;
        width: min(220px, calc(100vw - 24px));
      }

      #${LIGHTS_OFF_IDS.control} {
        top: 10px;
        right: 10px;
        min-width: 70px;
        height: 30px;
        padding: 0 10px;
        font-size: 12px;
      }
    }
  `;
}
