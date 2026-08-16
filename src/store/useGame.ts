import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Daily,
  Difficulty,
  Habit,
  Player,
  Reward,
  Task,
  Toast,
  Todo,
} from '../types';
import {
  BASE_MAX_HP,
  MAX_LEVEL,
  dateKey,
  daysToProcess,
  goldGain,
  hpDamage,
  parseDateKey,
  streakBonus,
  taskDelta,
  xpGain,
  xpToNextLevel,
} from '../game/formulas';
import { offlineStorage } from './storage';

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface NewTaskInput {
  type: Task['type'];
  title: string;
  notes: string;
  difficulty: Difficulty;
  up?: boolean;
  down?: boolean;
  repeat?: boolean[];
  dueDate?: string;
  cost?: number;
}

interface GameState {
  player: Player;
  tasks: Task[];
  lastCron: string;
  toasts: Toast[];
  _hydrated: boolean;

  addTask: (input: NewTaskInput) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  scoreHabit: (id: string, direction: 'up' | 'down') => void;
  toggleDaily: (id: string) => void;
  toggleTodo: (id: string) => void;
  buyReward: (id: string) => void;

  runCron: () => void;
  setProfile: (name: string, avatar: string) => void;
  resetAll: () => void;

  pushToast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: string) => void;
}

const defaultPlayer = (): Player => ({
  name: 'Petualang',
  avatar: '🧙',
  level: 1,
  hp: BASE_MAX_HP,
  maxHp: BASE_MAX_HP,
  xp: 0,
  gold: 0,
  totalTasksDone: 0,
  deaths: 0,
  perfectDays: 0,
});

const everyDay = () => [true, true, true, true, true, true, true];

const seedTasks = (): Task[] => {
  const now = new Date().toISOString();
  const base = { notes: '', createdAt: now, value: 0 };
  return [
    {
      ...base,
      id: uid(),
      type: 'habit',
      title: 'Minum segelas air',
      up: true,
      down: false,
      difficulty: 'easy',
      counterUp: 0,
      counterDown: 0,
    } satisfies Habit,
    {
      ...base,
      id: uid(),
      type: 'habit',
      title: 'Buka media sosial tanpa tujuan',
      up: false,
      down: true,
      difficulty: 'easy',
      counterUp: 0,
      counterDown: 0,
    } satisfies Habit,
    {
      ...base,
      id: uid(),
      type: 'daily',
      title: 'Olahraga 15 menit',
      difficulty: 'medium',
      repeat: everyDay(),
      streak: 0,
      completed: false,
    } satisfies Daily,
    {
      ...base,
      id: uid(),
      type: 'todo',
      title: 'Jelajahi HabitQuest 🎉',
      notes: 'Coba centang aku untuk dapat XP & gold!',
      difficulty: 'easy',
      completed: false,
    } satisfies Todo,
    {
      ...base,
      id: uid(),
      type: 'reward',
      title: 'Nonton 1 episode serial favorit',
      cost: 10,
    } satisfies Reward,
  ];
};

/** Terapkan XP/gold + level up ke player (mutasi salinan). */
function applyGains(
  player: Player,
  xp: number,
  gold: number,
  push: (kind: Toast['kind'], text: string) => void
): Player {
  const p = { ...player };
  p.gold = Math.max(0, Math.round((p.gold + gold) * 100) / 100);
  p.xp += xp;
  let leveledUp = false;
  while (p.xp >= xpToNextLevel(p.level) && p.level < MAX_LEVEL) {
    p.xp -= xpToNextLevel(p.level);
    p.level += 1;
    leveledUp = true;
  }
  if (leveledUp) {
    p.hp = p.maxHp; // naik level memulihkan HP, seperti Habitica
    push('level', `🎉 Naik ke Level ${p.level}! HP pulih penuh.`);
  }
  return p;
}

/** HP habis: turun 1 level, gold hangus, HP pulih — mekanik kematian Habitica. */
function applyDeathIfNeeded(
  player: Player,
  push: (kind: Toast['kind'], text: string) => void
): Player {
  if (player.hp > 0) return player;
  const p = { ...player };
  p.level = Math.max(1, p.level - 1);
  p.gold = 0;
  p.xp = 0;
  p.hp = p.maxHp;
  p.deaths += 1;
  push('danger', '💀 Kamu tumbang! Turun 1 level dan gold hangus. Bangkit lagi!');
  return p;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      player: defaultPlayer(),
      tasks: seedTasks(),
      lastCron: dateKey(),
      toasts: [],
      _hydrated: false,

      pushToast: (kind, text) => {
        const toast: Toast = { id: uid(), kind, text };
        set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
      },

      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      addTask: (input) => {
        const now = new Date().toISOString();
        const base = {
          id: uid(),
          title: input.title.trim(),
          notes: input.notes.trim(),
          createdAt: now,
        };
        let task: Task;
        switch (input.type) {
          case 'habit':
            task = {
              ...base,
              type: 'habit',
              up: input.up ?? true,
              down: input.down ?? false,
              difficulty: input.difficulty,
              value: 0,
              counterUp: 0,
              counterDown: 0,
            };
            break;
          case 'daily':
            task = {
              ...base,
              type: 'daily',
              difficulty: input.difficulty,
              value: 0,
              repeat: input.repeat ?? everyDay(),
              streak: 0,
              completed: false,
            };
            break;
          case 'todo':
            task = {
              ...base,
              type: 'todo',
              difficulty: input.difficulty,
              value: 0,
              completed: false,
              dueDate: input.dueDate || undefined,
            };
            break;
          case 'reward':
            task = { ...base, type: 'reward', cost: input.cost ?? 10 };
            break;
        }
        set((s) => ({ tasks: [task, ...s.tasks] }));
      },

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? ({ ...t, ...patch } as Task) : t
          ),
        })),

      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      scoreHabit: (id, direction) => {
        const { tasks, player, pushToast } = get();
        const task = tasks.find((t): t is Habit => t.id === id && t.type === 'habit');
        if (!task) return;

        const delta = taskDelta(task.value, direction, task.difficulty);
        const updated: Habit = {
          ...task,
          value: task.value + delta,
          counterUp: task.counterUp + (direction === 'up' ? 1 : 0),
          counterDown: task.counterDown + (direction === 'down' ? 1 : 0),
        };

        let p = { ...player };
        if (direction === 'up') {
          const xp = xpGain(delta);
          const gold = goldGain(delta);
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold`);
        } else {
          const dmg = hpDamage(delta);
          p.hp = Math.max(0, Math.round((p.hp - dmg) * 10) / 10);
          pushToast('hp', `-${dmg.toFixed(1)} HP`);
          p = applyDeathIfNeeded(p, pushToast);
        }

        set((s) => ({
          player: p,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
        }));
      },

      toggleDaily: (id) => {
        const { tasks, player, pushToast } = get();
        const task = tasks.find((t): t is Daily => t.id === id && t.type === 'daily');
        if (!task) return;

        let p = { ...player };
        let updated: Daily;

        if (!task.completed) {
          const delta = taskDelta(task.value, 'up', task.difficulty);
          const bonus = streakBonus(task.streak);
          const xp = xpGain(delta, bonus);
          const gold = goldGain(delta, bonus);
          updated = {
            ...task,
            completed: true,
            streak: task.streak + 1,
            value: task.value + delta,
          };
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          const streakNote = updated.streak > 1 ? ` · 🔥 streak ${updated.streak}` : '';
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold${streakNote}`);
        } else {
          // batal centang: kembalikan reward & streak
          const delta = taskDelta(task.value, 'down', task.difficulty);
          const bonus = streakBonus(Math.max(0, task.streak - 1));
          updated = {
            ...task,
            completed: false,
            streak: Math.max(0, task.streak - 1),
            value: task.value + delta,
          };
          p.xp = Math.max(0, p.xp - xpGain(delta, bonus));
          p.gold = Math.max(0, Math.round((p.gold - goldGain(delta, bonus)) * 100) / 100);
          p.totalTasksDone = Math.max(0, p.totalTasksDone - 1);
        }

        set((s) => ({
          player: p,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
        }));
      },

      toggleTodo: (id) => {
        const { tasks, player, pushToast } = get();
        const task = tasks.find((t): t is Todo => t.id === id && t.type === 'todo');
        if (!task) return;

        let p = { ...player };
        let updated: Todo;

        if (!task.completed) {
          const delta = taskDelta(task.value, 'up', task.difficulty);
          const xp = xpGain(delta);
          const gold = goldGain(delta);
          updated = {
            ...task,
            completed: true,
            completedAt: new Date().toISOString(),
            value: task.value + delta,
          };
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold`);
        } else {
          const delta = taskDelta(task.value, 'down', task.difficulty);
          updated = {
            ...task,
            completed: false,
            completedAt: undefined,
            value: task.value + delta,
          };
          p.xp = Math.max(0, p.xp - xpGain(delta));
          p.gold = Math.max(0, Math.round((p.gold - goldGain(delta)) * 100) / 100);
          p.totalTasksDone = Math.max(0, p.totalTasksDone - 1);
        }

        set((s) => ({
          player: p,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
        }));
      },

      buyReward: (id) => {
        const { tasks, player, pushToast } = get();
        const reward = tasks.find(
          (t): t is Reward => t.id === id && t.type === 'reward'
        );
        if (!reward) return;
        if (player.gold < reward.cost) {
          pushToast('info', `Gold belum cukup — butuh ${reward.cost} 🪙`);
          return;
        }
        set((s) => ({
          player: {
            ...s.player,
            gold: Math.round((s.player.gold - reward.cost) * 100) / 100,
          },
        }));
        pushToast('gold', `🎁 ${reward.title} ditebus! -${reward.cost} gold`);
      },

      /**
       * "Cron" ala Habitica: dijalankan saat app dibuka / kembali aktif.
       * Untuk tiap hari yang terlewat: daily yang jatuh tempo tapi tidak
       * dicentang memberi damage HP & mereset streak, lalu semua daily
       * di-reset untuk hari baru.
       */
      runCron: () => {
        const today = dateKey();
        const { lastCron, tasks, player, pushToast } = get();
        if (lastCron === today) return;

        const days = daysToProcess(lastCron, today);
        // ampun bila lama tidak buka app: maksimal 3 hari yang "ditagih"
        const billableDays = days.slice(0, 3);

        let totalDamage = 0;
        let missedCount = 0;
        let perfectDay = days.length > 0;

        const newTasks: Task[] = tasks.map((t) => {
          if (t.type === 'habit') {
            // nilai habit memudar perlahan ke arah netral tiap hari
            return {
              ...t,
              value: t.value * Math.pow(0.98, days.length),
              counterUp: 0,
              counterDown: 0,
            };
          }
          if (t.type !== 'daily') return t;

          let daily: Daily = { ...t };
          for (const day of days) {
            const weekday = parseDateKey(day).getDay();
            const due = daily.repeat[weekday];
            if (!due) continue;
            // hanya hari terakhir cron yang punya status centang tersimpan
            const wasCompleted = day === lastCron && daily.completed;
            if (wasCompleted) continue;

            perfectDay = false;
            missedCount += 1;
            if (billableDays.includes(day)) {
              const delta = taskDelta(daily.value, 'down', daily.difficulty);
              totalDamage += hpDamage(delta);
              daily = { ...daily, value: daily.value + delta, streak: 0 };
            } else {
              daily = { ...daily, streak: 0 };
            }
          }
          return { ...daily, completed: false };
        });

        let p = { ...player };
        if (totalDamage > 0) {
          totalDamage = Math.round(totalDamage * 10) / 10;
          p.hp = Math.max(0, Math.round((p.hp - totalDamage) * 10) / 10);
          pushToast(
            'hp',
            `🌙 Hari baru: ${missedCount} daily terlewat, -${totalDamage.toFixed(1)} HP`
          );
          p = applyDeathIfNeeded(p, pushToast);
        } else if (perfectDay) {
          const dueYesterday = tasks.some(
            (t) =>
              t.type === 'daily' && t.repeat[parseDateKey(days[0]).getDay()]
          );
          if (dueYesterday) {
            p.perfectDays += 1;
            p = applyGains(p, 15, 5, pushToast);
            pushToast('level', '🌟 Perfect Day! Bonus +15 XP & +5 gold');
          }
        }

        set({ player: p, tasks: newTasks, lastCron: today });
      },

      setProfile: (name, avatar) =>
        set((s) => ({
          player: { ...s.player, name: name.trim() || 'Petualang', avatar },
        })),

      resetAll: () =>
        set({
          player: defaultPlayer(),
          tasks: seedTasks(),
          lastCron: dateKey(),
          toasts: [],
        }),
    }),
    {
      name: 'habitquest-save',
      storage: createJSONStorage(() => offlineStorage),
      partialize: (s) => ({
        player: s.player,
        tasks: s.tasks,
        lastCron: s.lastCron,
      }),
      onRehydrateStorage: () => () => {
        useGame.setState({ _hydrated: true });
      },
    }
  )
);
