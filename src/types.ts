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
