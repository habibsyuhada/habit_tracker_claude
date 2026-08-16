import type { Kingdom, Player, Task } from '../types';

/** Potret state yang dinilai oleh setiap pencapaian. */
export interface AchievementSnapshot {
  player: Player;
  kingdom: Kingdom;
  tasks: Task[];
}

export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  cond: (s: AchievementSnapshot) => boolean;
}

const maxStreak = (tasks: Task[]) =>
  tasks.reduce((m, t) => (t.type === 'daily' && t.streak > m ? t.streak : m), 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'decree1', name: 'Titah Pertama', emoji: '⚜️',
    desc: 'Selesaikan titah pertamamu',
    cond: (s) => s.player.totalTasksDone >= 1,
  },
  {
    id: 'decree50', name: 'Tangan Besi', emoji: '✊',
    desc: 'Selesaikan 50 titah',
    cond: (s) => s.player.totalTasksDone >= 50,
  },
  {
    id: 'decree200', name: 'Penguasa Legendaris', emoji: '🏵️',
    desc: 'Selesaikan 200 titah',
    cond: (s) => s.player.totalTasksDone >= 200,
  },
  {
    id: 'streak7', name: 'Seminggu Beruntun', emoji: '🔥',
    desc: 'Capai streak 7 hari pada satu daily',
    cond: (s) => maxStreak(s.tasks) >= 7,
  },
  {
    id: 'streak30', name: 'Sebulan Membara', emoji: '☄️',
    desc: 'Capai streak 30 hari pada satu daily',
    cond: (s) => maxStreak(s.tasks) >= 30,
  },
  {
    id: 'level5', name: 'Naik Takhta', emoji: '🪑',
    desc: 'Capai level 5',
    cond: (s) => s.player.level >= 5,
  },
  {
    id: 'level10', name: 'Dihormati Rakyat', emoji: '🎖️',
    desc: 'Capai level 10',
    cond: (s) => s.player.level >= 10,
  },
  {
    id: 'level20', name: 'Nama dalam Sejarah', emoji: '📯',
    desc: 'Capai level 20',
    cond: (s) => s.player.level >= 20,
  },
  {
    id: 'perfect1', name: 'Hari Tanpa Cela', emoji: '🌟',
    desc: 'Raih Hari Sempurna pertamamu',
    cond: (s) => s.player.perfectDays >= 1,
  },
  {
    id: 'perfect7', name: 'Pekan Emas', emoji: '🏅',
    desc: 'Raih 7 Hari Sempurna',
    cond: (s) => s.player.perfectDays >= 7,
  },
  {
    id: 'citizen10', name: 'Dusun yang Ramai', emoji: '🏘️',
    desc: 'Miliki 10 rakyat',
    cond: (s) => s.kingdom.citizens.length >= 10,
  },
  {
    id: 'citizen20', name: 'Kota yang Hidup', emoji: '🌆',
    desc: 'Miliki 20 rakyat',
    cond: (s) => s.kingdom.citizens.length >= 20,
  },
  {
    id: 'castle', name: 'Puncak Kejayaan', emoji: '🏰',
    desc: 'Dirikan Kastil',
    cond: (s) => (s.kingdom.buildings.castle ?? 0) >= 1,
  },
  {
    id: 'builder3', name: 'Sang Pembangun', emoji: '🧱',
    desc: 'Dirikan 3 bangunan',
    cond: (s) =>
      Object.values(s.kingdom.buildings).filter((l) => l > 0).length >= 3,
  },
  {
    id: 'builderAll', name: 'Arsitek Agung', emoji: '📐',
    desc: 'Dirikan seluruh 7 bangunan',
    cond: (s) =>
      Object.values(s.kingdom.buildings).filter((l) => l > 0).length >= 7,
  },
  {
    id: 'threat1', name: 'Pelindung Kerajaan', emoji: '🛡️',
    desc: 'Tangkal satu ancaman',
    cond: (s) => s.kingdom.threatsRepelled >= 1,
  },
  {
    id: 'threat5', name: 'Benteng Tak Tergoyahkan', emoji: '⚔️',
    desc: 'Tangkal 5 ancaman',
    cond: (s) => s.kingdom.threatsRepelled >= 5,
  },
  {
    id: 'phoenix', name: 'Bangkit dari Krisis', emoji: '🐦‍🔥',
    desc: 'Pulih setelah krisis kerajaan pertama',
    cond: (s) => s.player.deaths >= 1,
  },
  {
    id: 'decorAll', name: 'Wilayah Permai', emoji: '🌈',
    desc: 'Pasang seluruh 6 dekorasi',
    cond: (s) => s.kingdom.decor.length >= 6,
  },
  {
    id: 'rich', name: 'Kas Melimpah', emoji: '💰',
    desc: 'Simpan 150 gold sekaligus',
    cond: (s) => s.player.gold >= 150,
  },
];
