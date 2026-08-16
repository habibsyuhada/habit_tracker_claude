import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const REMINDER_ID = 1001;

/**
 * Sinkronkan pengingat harian dengan setting: batalkan jadwal lama,
 * lalu jadwalkan ulang bila aktif. Notifikasi 100% lokal (tanpa server).
 * Return false bila platform tidak mendukung atau izin ditolak.
 */
export async function syncReminder(enabled: boolean, time: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  } catch {
    // belum ada jadwal — abaikan
  }
  if (!enabled) return true;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;

  const [hour, minute] = time.split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: '⚔️ HabitQuest',
        body: 'Jangan biarkan daily-mu terlewat — HP-mu taruhannya!',
        schedule: {
          on: { hour, minute },
          allowWhileIdle: true,
        },
      },
    ],
  });
  return true;
}
