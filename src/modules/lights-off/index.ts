import type { ButtonModule } from '@/core/types';
import { LIGHTS_OFF_MODULE_ID } from '@/modules/lights-off/constants';
import { LightsOffController } from '@/modules/lights-off/controller';
import { isModuleEnabled } from '@/utils/storage';

const lightsOffController = new LightsOffController();

export async function syncLightsOffModule(): Promise<void> {
  const enabled = await isModuleEnabled(LIGHTS_OFF_MODULE_ID);
  if (enabled) {
    await lightsOffController.mount();
  } else {
    lightsOffController.unmount();
  }
}

export const lightsOffModule: ButtonModule = {
  id: LIGHTS_OFF_MODULE_ID,
  name: '视频关灯',
  description: '在播放器内切换沉浸遮罩，并支持调节遮罩透明度',
  enabled: true,
  onUnload() {
    lightsOffController.unmount();
  },
};
