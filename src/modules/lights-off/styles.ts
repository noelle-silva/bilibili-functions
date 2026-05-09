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

    #${LIGHTS_OFF_IDS.controls} {
      position: fixed;
      z-index: 2147483002;
      display: none;
      align-items: center;
      gap: 8px;
      transform: translateX(-100%);
      pointer-events: auto;
    }

    #${LIGHTS_OFF_IDS.layer}[data-visible="true"] #${LIGHTS_OFF_IDS.controls} {
      display: inline-flex;
    }

    .bilibili-lights-off-button {
      appearance: none;
      -webkit-appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 34px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      background: rgba(15, 23, 42, 0.70);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      font-weight: 800;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.30);
      backdrop-filter: blur(12px) saturate(140%);
      transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
    }

    .bilibili-lights-off-button:hover {
      transform: translateY(-1px);
      border-color: rgba(56, 189, 248, 0.88);
      background: rgba(2, 132, 199, 0.80);
      box-shadow: 0 14px 38px rgba(14, 165, 233, 0.32);
    }

    .bilibili-lights-off-button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.34), 0 14px 38px rgba(14, 165, 233, 0.30);
    }

    #${LIGHTS_OFF_IDS.toggleButton} {
      min-width: 78px;
      padding: 0 14px;
      border-radius: 999px;
    }

    #${LIGHTS_OFF_IDS.toggleButton}[aria-pressed="true"] {
      border-color: rgba(250, 204, 21, 0.90);
      background: rgba(113, 63, 18, 0.76);
      color: #fef3c7;
    }

    #${LIGHTS_OFF_IDS.settingsButton} {
      width: 34px;
      padding: 0;
      border-radius: 50%;
      font-size: 15px;
    }

    #${LIGHTS_OFF_IDS.settingsButton}[aria-expanded="true"] {
      border-color: rgba(56, 189, 248, 0.92);
      background: rgba(12, 74, 110, 0.84);
      color: #bae6fd;
    }

    #${LIGHTS_OFF_IDS.settingsPanel} {
      position: fixed;
      z-index: 2147483001;
      display: none;
      width: min(260px, calc(100vw - 28px));
      padding: 12px 14px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.78);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      box-shadow: 0 18px 52px rgba(0, 0, 0, 0.46);
      backdrop-filter: blur(14px) saturate(140%);
      transform: translateX(-100%);
      pointer-events: auto;
    }

    #${LIGHTS_OFF_IDS.layer}[data-visible="true"][data-settings-open="true"] #${LIGHTS_OFF_IDS.settingsPanel} {
      display: block;
    }

    #${LIGHTS_OFF_IDS.settingsPanel} .bilibili-lights-off-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    #${LIGHTS_OFF_IDS.settingsPanel} .bilibili-lights-off-value {
      color: #38bdf8;
      font-variant-numeric: tabular-nums;
    }

    #${LIGHTS_OFF_IDS.settingsPanel} .bilibili-lights-off-slider {
      width: 100%;
      height: 4px;
      margin: 0;
      border-radius: 999px;
      accent-color: #00aeec;
      cursor: pointer;
    }

    @media (max-width: 640px) {
      #${LIGHTS_OFF_IDS.controls} {
        gap: 6px;
      }

      .bilibili-lights-off-button {
        height: 30px;
        font-size: 12px;
      }

      #${LIGHTS_OFF_IDS.toggleButton} {
        min-width: 68px;
        padding: 0 10px;
      }

      #${LIGHTS_OFF_IDS.settingsButton} {
        width: 30px;
        font-size: 13px;
      }
    }
  `;
}
