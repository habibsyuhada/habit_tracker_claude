import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ChecklistItem,
  Daily,
  DayStats,
  Difficulty,
  Habit,
  Player,
  ReminderSettings,
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
import { hapticForToast } from '../haptics';
import { sfxForToast } from '../sfx';
import { ACHIEVEMENTS } from '../game/achievements';
import type { Kingdom } from '../types';
import {
  CITIZEN_EVERY,
  BUILDING_BY_ID,
  DECOR_BY_ID,
  JOB_BY_ID,
  THREAT_BY_ID,
  THREAT_CHANCE,
  buildingCost,
  dailyYield,
  kingdomEffects,
  newCitizen,
  pickThreat,
  rollKingdomEvent,
} from '../game/kingdom';

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
  checklist?: ChecklistItem[];
}

interface GameState {
  player: Player;
  tasks: Task[];
  lastCron: string;
  reminder: ReminderSettings;
  /** riwayat aktivitas per hari untuk statistik, kunci yyyy-mm-dd */
  history: Record<string, DayStats>;
  kingdom: Kingdom;
  /** sudah melewati cerita pembuka */
  onboarded: boolean;
  setOnboarded: () => void;
  /** efek suara aktif */
  sound: boolean;
  setSound: (on: boolean) => void;
  /** id pencapaian → tanggal terbuka */
  achievements: Record<string, string>;
  checkAchievements: () => void;
  toasts: Toast[];
  _hydrated: boolean;

  addTask: (input: NewTaskInput) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  scoreHabit: (id: string, direction: 'up' | 'down') => void;
  toggleDaily: (id: string) => void;
  toggleTodo: (id: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  buyReward: (id: string) => void;

  buildBuilding: (buildingId: string) => void;
  buyDecor: (decorId: string) => void;

  runCron: () => void;
  setProfile: (name: string, avatar: string) => void;
  setReminder: (settings: ReminderSettings) => void;
  exportData: () => string;
  importData: (json: string) => boolean;
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

const defaultKingdom = (): Kingdom => ({
  citizens: [newCitizen(), newCitizen(), newCitizen()],
  buildings: {},
  decor: [],
  threatsRepelled: 0,
  recruitProgress: 0,
  log: [],
});

/**
 * Rakyat baru datang tiap CITIZEN_EVERY tugas selesai. Memakai counter
 * satu arah (bukan totalTasksDone) supaya centang-batal-centang tidak
 * bisa memanen rakyat berulang kali.
 */
function maybeGrowCitizens(
  kingdom: Kingdom,
  push: (kind: Toast['kind'], text: string) => void
): Kingdom {
  const progress = kingdom.recruitProgress + 1;
  if (progress < CITIZEN_EVERY) {
    return { ...kingdom, recruitProgress: progress };
  }
  const citizen = newCitizen();
  const job = JOB_BY_ID[citizen.job];
  const next = {
    ...kingdom,
    recruitProgress: 0,
    citizens: [...kingdom.citizens, citizen],
  };
  push(
    'level',
    `${job.emoji} ${citizen.name} sang ${job.name} bergabung! (${next.citizens.length} jiwa)`
  );
  return next;
}

/** Pembalikan saat batal centang: progres rekrut & ancaman ikut mundur. */
function regressKingdomProgress(kingdom: Kingdom): Kingdom {
  return {
    ...kingdom,
    recruitProgress: Math.max(0, kingdom.recruitProgress - 1),
    threat: kingdom.threat
      ? { ...kingdom.threat, progress: Math.max(0, kingdom.threat.progress - 1) }
      : undefined,
  };
}

/**
 * Setiap tugas selesai memajukan penangkalan ancaman yang sedang aktif.
 * Bila target tercapai, ancaman langsung diusir dan hadiah cair.
 */
function progressThreat(
  kingdom: Kingdom,
  player: Player,
  push: (kind: Toast['kind'], text: string) => void
): [Kingdom, Player] {
  if (!kingdom.threat) return [kingdom, player];
  const def = THREAT_BY_ID[kingdom.threat.defId];
  if (!def) return [{ ...kingdom, threat: undefined }, player];

  const progress = kingdom.threat.progress + 1;
  if (progress < def.goal) {
    return [{ ...kingdom, threat: { ...kingdom.threat, progress } }, player];
  }
  const p = {
    ...player,
    gold: Math.round((player.gold + def.rewardGold) * 100) / 100,
  };
  push(
    'level',
    `${def.emoji} ${def.name} berhasil diusir! Hadiah ${def.rewardGold} gold 🎉`
  );
  return [
    {
      ...kingdom,
      threat: undefined,
      threatsRepelled: kingdom.threatsRepelled + 1,
      log: [
        { date: dateKey(), text: `${def.emoji} ${def.name} diusir oleh titah rajanya!` },
        ...kingdom.log,
      ].slice(0, 14),
    },
    p,
  ];
}

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
      checklist: [],
    } satisfies Daily,
    {
      ...base,
      id: uid(),
      type: 'todo',
      title: 'Jelajahi HabitQuest 🎉',
      notes: 'Coba centang aku untuk mengisi kas & kemakmuran kerajaan!',
      difficulty: 'easy',
      completed: false,
      checklist: [],
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

/** Catat aktivitas hari ini ke riwayat (delta bisa negatif saat batal centang). */
function bumpHistory(
  history: Record<string, DayStats>,
  delta: { done: number; xp: number; gold: number }
): Record<string, DayStats> {
  const key = dateKey();
  const cur = history[key] ?? { done: 0, xp: 0, gold: 0 };
  return {
    ...history,
    [key]: {
      done: Math.max(0, cur.done + delta.done),
      xp: Math.max(0, cur.xp + delta.xp),
      gold: Math.max(0, Math.round((cur.gold + delta.gold) * 100) / 100),
    },
  };
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
  push(
    'danger',
    '💀 Krisis kerajaan! Moral rakyat runtuh — gelarmu turun dan kas dikuras. Bangkit lagi!'
  );
  return p;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      player: defaultPlayer(),
      tasks: seedTasks(),
      lastCron: dateKey(),
      reminder: { enabled: false, time: '20:00' },
      history: {},
      kingdom: defaultKingdom(),
      onboarded: false,
      sound: true,
      achievements: {},
      toasts: [],
      _hydrated: false,

      setOnboarded: () => set({ onboarded: true }),

      setSound: (on) => set({ sound: on }),

      checkAchievements: () => {
        const s = get();
        const snapshot = { player: s.player, kingdom: s.kingdom, tasks: s.tasks };
        const newly = ACHIEVEMENTS.filter(
          (a) => !s.achievements[a.id] && a.cond(snapshot)
        );
        if (newly.length === 0) return;
        const unlocked = { ...s.achievements };
        for (const a of newly) {
          unlocked[a.id] = dateKey();
          s.pushToast('level', `🏆 Pencapaian terbuka: ${a.emoji} ${a.name}!`);
        }
        set({ achievements: unlocked });
      },

      pushToast: (kind, text) => {
        const toast: Toast = { id: uid(), kind, text };
        hapticForToast(kind);
        if (get().sound) sfxForToast(kind);
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
              checklist: input.checklist ?? [],
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
              checklist: input.checklist ?? [],
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
        let kd = get().kingdom;
        let hist = { done: 0, xp: 0, gold: 0 };
        const eff = kingdomEffects(kd.buildings);
        if (direction === 'up') {
          const xp = xpGain(delta, eff.xpMult);
          const gold = goldGain(delta, eff.goldMult);
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          kd = maybeGrowCitizens(kd, pushToast);
          [kd, p] = progressThreat(kd, p, pushToast);
          hist = { done: 1, xp, gold };
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold`);
        } else {
          const dmg =
            Math.round(hpDamage(delta) * eff.damageMult * 10) / 10;
          p.hp = Math.max(0, Math.round((p.hp - dmg) * 10) / 10);
          pushToast('hp', `-${dmg.toFixed(1)} HP`);
          p = applyDeathIfNeeded(p, pushToast);
        }

        set((s) => ({
          player: p,
          kingdom: kd,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
          history: bumpHistory(s.history, hist),
        }));
        get().checkAchievements();
      },

      toggleDaily: (id) => {
        const { tasks, player, pushToast } = get();
        const task = tasks.find((t): t is Daily => t.id === id && t.type === 'daily');
        if (!task) return;

        let p = { ...player };
        let kd = get().kingdom;
        let updated: Daily;
        let hist: { done: number; xp: number; gold: number };
        const eff = kingdomEffects(kd.buildings);

        if (!task.completed) {
          const delta = taskDelta(task.value, 'up', task.difficulty);
          const bonus = streakBonus(task.streak);
          const xp = xpGain(delta, bonus * eff.xpMult);
          const gold = goldGain(delta, bonus * eff.goldMult);
          updated = {
            ...task,
            completed: true,
            streak: task.streak + 1,
            value: task.value + delta,
          };
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          kd = maybeGrowCitizens(kd, pushToast);
          [kd, p] = progressThreat(kd, p, pushToast);
          hist = { done: 1, xp, gold };
          const streakNote = updated.streak > 1 ? ` · 🔥 streak ${updated.streak}` : '';
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold${streakNote}`);
        } else {
          // batal centang: kembalikan reward & streak dengan multiplier yang
          // sama seperti saat diberikan, supaya tidak bisa "diperah"
          const delta = taskDelta(task.value, 'down', task.difficulty);
          const bonus = streakBonus(Math.max(0, task.streak - 1));
          const xp = xpGain(delta, bonus * eff.xpMult);
          const gold = goldGain(delta, bonus * eff.goldMult);
          updated = {
            ...task,
            completed: false,
            streak: Math.max(0, task.streak - 1),
            value: task.value + delta,
          };
          p.xp = Math.max(0, p.xp - xp);
          p.gold = Math.max(0, Math.round((p.gold - gold) * 100) / 100);
          p.totalTasksDone = Math.max(0, p.totalTasksDone - 1);
          kd = regressKingdomProgress(kd);
          hist = { done: -1, xp: -xp, gold: -gold };
        }

        set((s) => ({
          player: p,
          kingdom: kd,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
          history: bumpHistory(s.history, hist),
        }));
        get().checkAchievements();
      },

      toggleTodo: (id) => {
        const { tasks, player, pushToast } = get();
        const task = tasks.find((t): t is Todo => t.id === id && t.type === 'todo');
        if (!task) return;

        let p = { ...player };
        let kd = get().kingdom;
        let updated: Todo;
        let hist: { done: number; xp: number; gold: number };
        const eff = kingdomEffects(kd.buildings);

        if (!task.completed) {
          const delta = taskDelta(task.value, 'up', task.difficulty);
          const xp = xpGain(delta, eff.xpMult);
          const gold = goldGain(delta, eff.goldMult);
          updated = {
            ...task,
            completed: true,
            completedAt: new Date().toISOString(),
            value: task.value + delta,
          };
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          kd = maybeGrowCitizens(kd, pushToast);
          [kd, p] = progressThreat(kd, p, pushToast);
          hist = { done: 1, xp, gold };
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold`);
        } else {
          // batal centang: refund memakai multiplier yang sama seperti saat
          // reward diberikan, dan progres kerajaan ikut mundur
          const delta = taskDelta(task.value, 'down', task.difficulty);
          const xp = xpGain(delta, eff.xpMult);
          const gold = goldGain(delta, eff.goldMult);
          updated = {
            ...task,
            completed: false,
            completedAt: undefined,
            value: task.value + delta,
          };
          p.xp = Math.max(0, p.xp - xp);
          p.gold = Math.max(0, Math.round((p.gold - gold) * 100) / 100);
          p.totalTasksDone = Math.max(0, p.totalTasksDone - 1);
          kd = regressKingdomProgress(kd);
          hist = { done: -1, xp: -xp, gold: -gold };
        }

        set((s) => ({
          player: p,
          kingdom: kd,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
          history: bumpHistory(s.history, hist),
        }));
        get().checkAchievements();
      },

      toggleChecklistItem: (taskId, itemId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId || (t.type !== 'daily' && t.type !== 'todo')) return t;
            return {
              ...t,
              checklist: t.checklist.map((it) =>
                it.id === itemId ? { ...it, done: !it.done } : it
              ),
            };
          }),
        })),

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

      buildBuilding: (buildingId) => {
        const { player, kingdom, pushToast } = get();
        const def = BUILDING_BY_ID[buildingId];
        if (!def) return;
        const curLevel = kingdom.buildings[buildingId] ?? 0;
        if (curLevel >= def.maxLevel) return;
        if (kingdom.citizens.length < def.minCitizens) {
          pushToast('info', `Butuh ${def.minCitizens} rakyat untuk membangun ${def.name}`);
          return;
        }
        const cost = buildingCost(def, curLevel);
        if (player.gold < cost) {
          pushToast('info', `Kas belum cukup — butuh ${cost} 🪙`);
          return;
        }
        const newLevel = curLevel + 1;
        set((s) => ({
          player: {
            ...s.player,
            gold: Math.round((s.player.gold - cost) * 100) / 100,
          },
          kingdom: {
            ...s.kingdom,
            buildings: { ...s.kingdom.buildings, [buildingId]: newLevel },
            log: [
              {
                date: dateKey(),
                text: `${def.emoji} ${def.name}${newLevel > 1 ? ` Lv ${newLevel}` : ''} selesai dibangun!`,
              },
              ...s.kingdom.log,
            ].slice(0, 14),
          },
        }));
        pushToast(
          'level',
          `${def.emoji} ${def.name}${newLevel > 1 ? ` naik ke Lv ${newLevel}` : ' berdiri'}!`
        );
        get().checkAchievements();
      },

      buyDecor: (decorId) => {
        const { player, kingdom, pushToast } = get();
        const def = DECOR_BY_ID[decorId];
        if (!def || kingdom.decor.includes(decorId)) return;
        if (player.gold < def.cost) {
          pushToast('info', `Kas belum cukup — butuh ${def.cost} 🪙`);
          return;
        }
        set((s) => ({
          player: {
            ...s.player,
            gold: Math.round((s.player.gold - def.cost) * 100) / 100,
          },
          kingdom: {
            ...s.kingdom,
            decor: [...s.kingdom.decor, decorId],
            log: [
              { date: dateKey(), text: `${def.emoji} ${def.name} mempercantik wilayah!` },
              ...s.kingdom.log,
            ].slice(0, 14),
          },
        }));
        pushToast('level', `${def.emoji} ${def.name} terpasang di petamu!`);
        get().checkAchievements();
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
              // ala Habitica: item checklist yang sudah dicentang
              // mengurangi damage secara proporsional
              const doneRatio =
                daily.checklist.length > 0
                  ? daily.checklist.filter((it) => it.done).length /
                    daily.checklist.length
                  : 0;
              totalDamage += hpDamage(delta) * (1 - doneRatio);
              daily = { ...daily, value: daily.value + delta, streak: 0 };
            } else {
              daily = { ...daily, streak: 0 };
            }
          }
          return {
            ...daily,
            completed: false,
            checklist: daily.checklist.map((it) => ({ ...it, done: false })),
          };
        });

        let p = { ...player };
        let kd = { ...get().kingdom };
        const eff = kingdomEffects(kd.buildings);
        if (totalDamage > 0) {
          totalDamage = Math.round(totalDamage * eff.damageMult * 10) / 10;
          p.hp = Math.max(0, Math.round((p.hp - totalDamage) * 10) / 10);
          pushToast(
            'hp',
            `🌙 Hari baru: ${missedCount} titah terbengkalai, moral rakyat -${totalDamage.toFixed(1)}`
          );
          p = applyDeathIfNeeded(p, pushToast);
        }

        let wasPerfect = false;
        if (totalDamage <= 0 && perfectDay) {
          const dueYesterday = tasks.some(
            (t) =>
              t.type === 'daily' && t.repeat[parseDateKey(days[0]).getDay()]
          );
          if (dueYesterday) {
            wasPerfect = true;
            p.perfectDays += 1;
            p = applyGains(p, 15, 5, pushToast);
            pushToast('level', '🌟 Hari Sempurna! Bonus +15 XP & +5 gold');
          }
        }

        // event kerajaan pergantian hari
        if (days.length > 0) {
          const event = rollKingdomEvent(wasPerfect, missedCount, p.level);
          if (event.gold) {
            p.gold = Math.round((p.gold + event.gold) * 100) / 100;
          }
          if (event.moral) {
            p.hp = Math.min(p.maxHp, Math.round((p.hp + event.moral) * 10) / 10);
          }
          if (event.citizens) {
            kd = { ...kd, citizens: [...kd.citizens, newCitizen()] };
          }
          kd = {
            ...kd,
            log: [{ date: today, text: event.text }, ...kd.log].slice(0, 14),
          };
          pushToast('info', event.text);

          // hasil kerja rakyat semalam — rakyat hanya bekerja bila rajanya
          // memimpin (minimal 1 titah selesai kemarin), supaya tidak ada
          // penghasilan gratis tanpa kebiasaan
          const workedYesterday =
            (get().history[days[days.length - 1]]?.done ?? 0) > 0;
          const yield_ = dailyYield(kd.citizens);
          if (!workedYesterday && kd.citizens.length > 0) {
            kd = {
              ...kd,
              log: [
                { date: today, text: '😴 Rakyat ikut bermalas-malasan — tak ada titah kemarin.' },
                ...kd.log,
              ].slice(0, 14),
            };
          } else if (yield_.gold > 0 || yield_.xp > 0 || yield_.moral > 0) {
            p.gold = Math.round((p.gold + yield_.gold) * 100) / 100;
            p = applyGains(p, yield_.xp, 0, pushToast);
            p.hp = Math.min(p.maxHp, Math.round((p.hp + yield_.moral) * 10) / 10);
            const parts = [
              yield_.gold > 0 ? `+${yield_.gold} kas` : '',
              yield_.xp > 0 ? `+${yield_.xp} kemakmuran` : '',
              yield_.moral > 0 ? `+${yield_.moral} moral` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            const text = `🧺 Rakyat bekerja: ${parts}`;
            kd = { ...kd, log: [{ date: today, text }, ...kd.log].slice(0, 14) };
            pushToast('gold', text);
          }

          // ancaman: gagal ditangkal? lalu mungkin muncul yang baru
          if (kd.threat) {
            const def = THREAT_BY_ID[kd.threat.defId];
            if (def && today > kd.threat.expiresOn) {
              p.hp = Math.max(0, Math.round((p.hp - def.penaltyMoral) * 10) / 10);
              const text = `${def.emoji} ${def.name} menyerang! Moral rakyat -${def.penaltyMoral}`;
              kd = {
                ...kd,
                threat: undefined,
                log: [{ date: today, text }, ...kd.log].slice(0, 14),
              };
              pushToast('danger', text);
              p = applyDeathIfNeeded(p, pushToast);
            }
          }
          if (!kd.threat && Math.random() < THREAT_CHANCE) {
            const def = pickThreat(p.level);
            if (def) {
              // Menara Jaga memberi peringatan dini: tenggat lebih panjang
              const expires = new Date();
              expires.setDate(
                expires.getDate() + def.days - 1 + eff.threatDelayBonus
              );
              kd = {
                ...kd,
                threat: { defId: def.id, progress: 0, expiresOn: dateKey(expires) },
                log: [
                  { date: today, text: `${def.emoji} ${def.name} ${def.warning}` },
                  ...kd.log,
                ].slice(0, 14),
              };
              pushToast(
                'danger',
                `${def.emoji} ${def.name} ${def.warning} Selesaikan ${def.goal} titah dalam ${def.days} hari!`
              );
            }
          }
        }

        // riwayat dibatasi 180 hari terakhir supaya save tetap ramping
        const historyKeys = Object.keys(get().history).sort();
        const trimmed =
          historyKeys.length > 180
            ? Object.fromEntries(
                historyKeys.slice(-180).map((k) => [k, get().history[k]])
              )
            : get().history;

        set({
          player: p,
          kingdom: kd,
          tasks: newTasks,
          lastCron: today,
          history: trimmed,
        });
        get().checkAchievements();
      },

      setProfile: (name, avatar) =>
        set((s) => ({
          player: { ...s.player, name: name.trim() || 'Petualang', avatar },
        })),

      setReminder: (settings) => set({ reminder: settings }),

      exportData: () => {
        const { player, tasks, lastCron, reminder, history, kingdom } = get();
        return JSON.stringify(
          {
            app: 'habitquest',
            version: 5,
            exportedAt: new Date().toISOString(),
            player,
            tasks,
            lastCron,
            reminder,
            history,
            kingdom,
            achievements: get().achievements,
          },
          null,
          2
        );
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          if (
            data?.app !== 'habitquest' ||
            !data.player ||
            !Array.isArray(data.tasks)
          ) {
            get().pushToast('danger', 'File tidak valid — bukan backup HabitQuest');
            return false;
          }
          // backup lama masih membawa data gear/pet — buang saja
          const importedPlayer = { ...defaultPlayer(), ...data.player } as Record<
            string,
            unknown
          >;
          for (const key of [
            'gear', 'ownedGear', 'eggs', 'potions', 'pets', 'activePet', 'dropsToday',
          ]) {
            delete importedPlayer[key];
          }
          const validAch = new Set(ACHIEVEMENTS.map((a) => a.id));
          set({
            // backup versi lama tetap bisa dipulihkan: isi field baru dengan default
            player: importedPlayer as unknown as Player,
            tasks: (data.tasks as Task[]).map((t) =>
              t.type === 'daily' || t.type === 'todo'
                ? { ...t, checklist: t.checklist ?? [] }
                : t
            ),
            lastCron: data.lastCron ?? dateKey(),
            reminder: data.reminder ?? { enabled: false, time: '20:00' },
            history: data.history ?? {},
            kingdom: data.kingdom
              ? {
                  ...defaultKingdom(),
                  ...data.kingdom,
                  citizens:
                    typeof data.kingdom.citizens === 'number'
                      ? Array.from({ length: data.kingdom.citizens }, () => newCitizen())
                      : data.kingdom.citizens ?? [],
                  decor: data.kingdom.decor ?? [],
                  threatsRepelled: data.kingdom.threatsRepelled ?? 0,
                  recruitProgress: data.kingdom.recruitProgress ?? 0,
                }
              : defaultKingdom(),
            achievements: Object.fromEntries(
              Object.entries(
                (data.achievements ?? {}) as Record<string, string>
              ).filter(([id]) => validAch.has(id))
            ),
          });
          get().pushToast('info', '📥 Backup berhasil dipulihkan!');
          return true;
        } catch {
          get().pushToast('danger', 'File tidak bisa dibaca — pastikan JSON backup yang benar');
          return false;
        }
      },

      resetAll: () =>
        set({
          player: defaultPlayer(),
          tasks: seedTasks(),
          lastCron: dateKey(),
          reminder: { enabled: false, time: '20:00' },
          history: {},
          kingdom: defaultKingdom(),
          onboarded: false,
          achievements: {},
          toasts: [],
        }),
    }),
    {
      name: 'habitquest-save',
      storage: createJSONStorage(() => offlineStorage),
      version: 10,
      // save lama tetap terbaca: lengkapi field yang belum ada
      migrate: (persisted) => {
        const s = persisted as Partial<GameState>;
        s.history ??= {};
        // pemain lama tidak perlu melihat cerita pembuka lagi
        s.onboarded ??= true;
        s.sound ??= true;
        s.achievements ??= {};
        s.kingdom ??= defaultKingdom();
        // v5 → v6: rakyat dulu hanya angka, kini punya nama & profesi
        if (typeof (s.kingdom as { citizens: unknown }).citizens === 'number') {
          const count = (s.kingdom as unknown as { citizens: number }).citizens;
          s.kingdom = {
            ...s.kingdom,
            citizens: Array.from({ length: count }, () => newCitizen()),
          };
        }
        s.kingdom.decor ??= [];
        s.kingdom.threatsRepelled ??= 0;
        s.kingdom.recruitProgress ??= (s.player?.totalTasksDone ?? 0) % CITIZEN_EVERY;
        if (Array.isArray(s.tasks)) {
          s.tasks = s.tasks.map((t) => {
            if (t.type !== 'daily' && t.type !== 'todo') return t;
            return { ...t, checklist: t.checklist ?? [] };
          });
        }
        s.reminder ??= { enabled: false, time: '20:00' };
        if (s.player) {
          // v10: lapisan petualang (gear/pet/drop) dihapus — buang sisa datanya
          const legacy = s.player as unknown as Record<string, unknown>;
          for (const key of [
            'gear', 'ownedGear', 'eggs', 'potions', 'pets', 'activePet', 'dropsToday',
          ]) {
            delete legacy[key];
          }
          s.player = { ...defaultPlayer(), ...s.player };
        }
        // buang pencapaian dari sistem yang sudah dihapus
        if (s.achievements) {
          const valid = new Set(ACHIEVEMENTS.map((a) => a.id));
          s.achievements = Object.fromEntries(
            Object.entries(s.achievements).filter(([id]) => valid.has(id))
          );
        }
        return s;
      },
      partialize: (s) => ({
        player: s.player,
        tasks: s.tasks,
        lastCron: s.lastCron,
        reminder: s.reminder,
        history: s.history,
        kingdom: s.kingdom,
        onboarded: s.onboarded,
        sound: s.sound,
        achievements: s.achievements,
      }),
      onRehydrateStorage: () => () => {
        useGame.setState({ _hydrated: true });
      },
    }
  )
);
