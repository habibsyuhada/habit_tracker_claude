import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { Toast } from './types';

/**
 * Getaran halus mengikuti jenis peristiwa. Di web plugin memakai
 * navigator.vibrate bila ada; kalau tidak didukung, diam saja.
 */
export function hapticForToast(kind: Toast['kind']): void {
  const fire = async () => {
    switch (kind) {
      case 'xp':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'gold':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'level':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'hp':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'danger':
        await Haptics.notification({ type: NotificationType.Error });
        break;
      default:
        break;
    }
  };
  fire().catch(() => {});
}
