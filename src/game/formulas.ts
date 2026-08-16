import type { Difficulty } from '../types';

/**
 * Rumus-rumus inti hasil reverse engineering mekanik Habitica,
 * disederhanakan tapi tetap mempertahankan "rasa" aslinya:
 * - nilai tugas (task value) bergeser tiap kali di-skor dan menentukan
 *   warna kartu + besar kecilnya reward (diminishing returns),
 * - XP untuk naik level memakai kurva level Habitica,
 * - daily yang terlewat memberi damage HP saat pergantian hari (cron).
 */

export const BASE_MAX_HP = 50;
export const MAX_LEVEL = 100;

/** Kurva XP Habitica: round((0.25 * lvl^2 + 10 * lvl + 139.75) / 10) * 10 */
export function xpToNextLevel(level: number): number {
  return Math.round((0.25 * level * level + 10 * level + 139.75) / 10) * 10;
}

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  trivial: 0.1,
  easy: 1,
  medium: 1.5,
  hard: 2,
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  trivial: 'Sepele',
  easy: 'Mudah',
  medium: 'Sedang',
  hard: 'Sulit',
};

/**
 * Delta skor ala Habitica: makin tinggi nilai tugas, makin kecil reward
 * berikutnya (0.9747^value), dikali multiplier kesulitan.
 */
export function taskDelta(
  value: number,
  direction: 'up' | 'down',
  difficulty: Difficulty
): number {
  const clamped = Math.min(Math.max(value, -47.27), 21.27);
  const magnitude = Math.pow(0.9747, clamped) * DIFFICULTY_MULTIPLIER[difficulty];
  return direction === 'up' ? magnitude : -magnitude;
}

/** Bonus streak daily: +2% per hari beruntun, maksimal +100%. */
export function streakBonus(streak: number): number {
  return 1 + Math.min(streak, 50) * 0.02;
}

export function xpGain(delta: number, bonus = 1): number {
  return Math.max(1, Math.round(Math.abs(delta) * 7 * bonus));
}

export function goldGain(delta: number, bonus = 1): number {
  return Math.round(Math.abs(delta) * 2.5 * bonus * 100) / 100;
}

/** Damage HP dari habit negatif / daily terlewat. */
export function hpDamage(delta: number): number {
  return Math.round(Math.abs(delta) * 2 * 10) / 10;
}

/**
 * Warna kartu berdasarkan nilai tugas — ciri khas Habitica:
 * merah = sering diabaikan/negatif, biru = rajin.
 */
export function valueColor(value: number): string {
  if (value < -16) return '#c2263f';
  if (value < -8) return '#f74e52';
  if (value < -1) return '#ff944c';
  if (value < 1) return '#ffbe5d';
  if (value < 6) return '#9ecb2c';
  if (value < 12) return '#24cc8f';
  return '#2995cd';
}

/** Kunci tanggal lokal yyyy-mm-dd (bukan UTC, karena "hari" pemain itu lokal). */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Semua hari dari lastCron s.d. kemarin (hari-hari yang harus "ditagih"). */
export function daysToProcess(lastCron: string, today: string): string[] {
  const days: string[] = [];
  const cursor = parseDateKey(lastCron);
  while (dateKey(cursor) < today) {
    days.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (days.length >= 60) break;
  }
  return days;
}
