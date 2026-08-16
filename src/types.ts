export type TaskType = 'habit' | 'daily' | 'todo' | 'reward';

export type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface BaseTask {
  id: string;
  title: string;
  notes: string;
  createdAt: string;
}

export interface Habit extends BaseTask {
  type: 'habit';
  /** tombol + aktif */
  up: boolean;
  /** tombol - aktif */
  down: boolean;
  difficulty: Difficulty;
  /** nilai tugas ala Habitica: makin sering + makin tinggi, menentukan warna & besaran reward */
  value: number;
  counterUp: number;
  counterDown: number;
}

export interface Daily extends BaseTask {
  type: 'daily';
  difficulty: Difficulty;
  value: number;
  /** hari aktif, index 0 = Minggu ... 6 = Sabtu */
  repeat: boolean[];
  streak: number;
  completed: boolean;
  checklist: ChecklistItem[];
}

export interface Todo extends BaseTask {
  type: 'todo';
  difficulty: Difficulty;
  value: number;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  checklist: ChecklistItem[];
}

export interface Reward extends BaseTask {
  type: 'reward';
  cost: number;
}

export type Task = Habit | Daily | Todo | Reward;

export interface Player {
  name: string;
  avatar: string;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  gold: number;
  /** statistik seumur hidup */
  totalTasksDone: number;
  deaths: number;
  perfectDays: number;
}

export interface KingdomLogEntry {
  date: string;
  text: string;
}

export interface Citizen {
  id: string;
  name: string;
  /** id profesi dari katalog JOBS */
  job: string;
}

export interface ActiveThreat {
  /** id dari katalog THREATS */
  defId: string;
  /** jumlah tugas selesai sejak ancaman muncul */
  progress: number;
  /** hari terakhir (yyyy-mm-dd) sebelum ancaman menyerang */
  expiresOn: string;
}

export interface Kingdom {
  /** daftar rakyat, masing-masing punya nama & profesi */
  citizens: Citizen[];
  /** id bangunan → level terbangun */
  buildings: Record<string, number>;
  /** dekorasi yang sudah dibeli */
  decor: string[];
  /** ancaman yang sedang aktif (bila ada) */
  threat?: ActiveThreat;
  /** jumlah ancaman yang berhasil ditangkal */
  threatsRepelled: number;
  /**
   * progres perekrutan rakyat (0..CITIZEN_EVERY-1). Hanya maju saat tugas
   * selesai dan mundur saat batal centang — anti exploit centang-batal.
   */
  recruitProgress: number;
  /** catatan peristiwa kerajaan, terbaru di depan */
  log: KingdomLogEntry[];
}

/** Agregat aktivitas satu hari, kunci = tanggal lokal yyyy-mm-dd */
export interface DayStats {
  /** jumlah tugas diselesaikan (habit +, daily, todo) */
  done: number;
  xp: number;
  gold: number;
}

export interface ReminderSettings {
  enabled: boolean;
  /** format "HH:MM" waktu lokal */
  time: string;
}

export interface Toast {
  id: string;
  kind: 'xp' | 'gold' | 'hp' | 'level' | 'danger' | 'info';
  text: string;
}
