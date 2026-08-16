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
import {
  DROP_CHANCE,
  GEAR_BY_ID,
  MAX_DROPS_PER_DAY,
  POTIONS,
  SPECIES,
  SPECIES_BY_ID,
  POTION_BY_ID,
  conReduction,
  petId,
  playerStats,
  strMultiplier,
} from '../game/items';
import type { GearSlot, Kingdom } from '../types';
import {
  CITIZEN_EVERY,
  BUILDING_BY_ID,
  buildingCost,
  kingdomEffects,
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

  buyGear: (gearId: string) => void;
  equipGear: (gearId: string) => void;
  unequipGear: (slot: GearSlot) => void;
  hatchPet: (speciesId: string, potionId: string) => void;
  setActivePet: (petId?: string) => void;
  buildBuilding: (buildingId: string) => void;

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
  gear: {},
  ownedGear: [],
  eggs: {},
  potions: {},
  pets: [],
  activePet: undefined,
  dropsToday: 0,
});

const everyDay = () => [true, true, true, true, true, true, true];

const defaultKingdom = (): Kingdom => ({
  citizens: 3,
  buildings: {},
  log: [],
});

/** Rakyat baru datang tiap kelipatan CITIZEN_EVERY tugas selesai. */
function maybeGrowCitizens(
  kingdom: Kingdom,
  totalTasksDone: number,
  push: (kind: Toast['kind'], text: string) => void
): Kingdom {
  if (totalTasksDone <= 0 || totalTasksDone % CITIZEN_EVERY !== 0) return kingdom;
  const next = { ...kingdom, citizens: kingdom.citizens + 1 };
  push('level', `🧑‍🌾 Rakyat baru bergabung dengan kerajaanmu! (${next.citizens} jiwa)`);
  return next;
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
      notes: 'Coba centang aku untuk dapat XP & gold!',
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

/**
 * Drop acak ala Habitica: tugas selesai berpeluang menjatuhkan
 * telur atau ramuan penetas, dibatasi per hari.
 */
function rollDrop(
  player: Player,
  push: (kind: Toast['kind'], text: string) => void,
  extraCap = 0
): Player {
  if (player.dropsToday >= MAX_DROPS_PER_DAY + extraCap) return player;
  if (Math.random() > DROP_CHANCE) return player;

  const p = { ...player, dropsToday: player.dropsToday + 1 };
  if (Math.random() < 0.5) {
    const s = SPECIES[Math.floor(Math.random() * SPECIES.length)];
    p.eggs = { ...p.eggs, [s.id]: (p.eggs[s.id] ?? 0) + 1 };
    push('gold', `🥚 Kamu menemukan Telur ${s.name}!`);
  } else {
    const pot = POTIONS[Math.floor(Math.random() * POTIONS.length)];
    p.potions = { ...p.potions, [pot.id]: (p.potions[pot.id] ?? 0) + 1 };
    push('gold', `🧪 Kamu menemukan Ramuan ${pot.name}!`);
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
        const stats = playerStats(p);
        const eff = kingdomEffects(kd.buildings);
        if (direction === 'up') {
          const xp = xpGain(delta, strMultiplier(stats.str) * eff.xpMult);
          const gold = goldGain(delta, strMultiplier(stats.str) * eff.goldMult);
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          p = rollDrop(p, pushToast, eff.dropBonus);
          kd = maybeGrowCitizens(kd, p.totalTasksDone, pushToast);
          hist = { done: 1, xp, gold };
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold`);
        } else {
          const dmg =
            Math.round(
              hpDamage(delta) * (1 - conReduction(stats.con)) * eff.damageMult * 10
            ) / 10;
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
          const bonus =
            streakBonus(task.streak) * strMultiplier(playerStats(p).str);
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
          p = rollDrop(p, pushToast, eff.dropBonus);
          kd = maybeGrowCitizens(kd, p.totalTasksDone, pushToast);
          hist = { done: 1, xp, gold };
          const streakNote = updated.streak > 1 ? ` · 🔥 streak ${updated.streak}` : '';
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold${streakNote}`);
        } else {
          // batal centang: kembalikan reward & streak
          const delta = taskDelta(task.value, 'down', task.difficulty);
          const bonus = streakBonus(Math.max(0, task.streak - 1));
          const xp = xpGain(delta, bonus);
          const gold = goldGain(delta, bonus);
          updated = {
            ...task,
            completed: false,
            streak: Math.max(0, task.streak - 1),
            value: task.value + delta,
          };
          p.xp = Math.max(0, p.xp - xp);
          p.gold = Math.max(0, Math.round((p.gold - gold) * 100) / 100);
          p.totalTasksDone = Math.max(0, p.totalTasksDone - 1);
          hist = { done: -1, xp: -xp, gold: -gold };
        }

        set((s) => ({
          player: p,
          kingdom: kd,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
          history: bumpHistory(s.history, hist),
        }));
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
          const strBonus = strMultiplier(playerStats(p).str);
          const xp = xpGain(delta, strBonus * eff.xpMult);
          const gold = goldGain(delta, strBonus * eff.goldMult);
          updated = {
            ...task,
            completed: true,
            completedAt: new Date().toISOString(),
            value: task.value + delta,
          };
          p = applyGains(p, xp, gold, pushToast);
          p.totalTasksDone += 1;
          p = rollDrop(p, pushToast, eff.dropBonus);
          kd = maybeGrowCitizens(kd, p.totalTasksDone, pushToast);
          hist = { done: 1, xp, gold };
          pushToast('xp', `+${xp} XP · +${gold.toFixed(1)} gold`);
        } else {
          const delta = taskDelta(task.value, 'down', task.difficulty);
          const xp = xpGain(delta);
          const gold = goldGain(delta);
          updated = {
            ...task,
            completed: false,
            completedAt: undefined,
            value: task.value + delta,
          };
          p.xp = Math.max(0, p.xp - xp);
          p.gold = Math.max(0, Math.round((p.gold - gold) * 100) / 100);
          p.totalTasksDone = Math.max(0, p.totalTasksDone - 1);
          hist = { done: -1, xp: -xp, gold: -gold };
        }

        set((s) => ({
          player: p,
          kingdom: kd,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
          history: bumpHistory(s.history, hist),
        }));
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

      buyGear: (gearId) => {
        const { player, pushToast } = get();
        const item = GEAR_BY_ID[gearId];
        if (!item || player.ownedGear.includes(gearId)) return;
        if (player.gold < item.cost) {
          pushToast('info', `Gold belum cukup — butuh ${item.cost} 🪙`);
          return;
        }
        set((s) => ({
          player: {
            ...s.player,
            gold: Math.round((s.player.gold - item.cost) * 100) / 100,
            ownedGear: [...s.player.ownedGear, gearId],
            gear: { ...s.player.gear, [item.slot]: gearId },
          },
        }));
        pushToast('level', `${item.emoji} ${item.name} dibeli & langsung dipakai!`);
      },

      equipGear: (gearId) => {
        const item = GEAR_BY_ID[gearId];
        if (!item) return;
        set((s) => {
          if (!s.player.ownedGear.includes(gearId)) return s;
          return {
            player: { ...s.player, gear: { ...s.player.gear, [item.slot]: gearId } },
          };
        });
      },

      unequipGear: (slot) =>
        set((s) => {
          const gear = { ...s.player.gear };
          delete gear[slot];
          return { player: { ...s.player, gear } };
        }),

      hatchPet: (speciesId, potionId) => {
        const { player, pushToast } = get();
        const species = SPECIES_BY_ID[speciesId];
        const potion = POTION_BY_ID[potionId];
        if (!species || !potion) return;
        if ((player.eggs[speciesId] ?? 0) < 1 || (player.potions[potionId] ?? 0) < 1)
          return;
        const id = petId(speciesId, potionId);
        if (player.pets.includes(id)) {
          pushToast('info', `${species.emoji} ${species.name} ${potion.name} sudah kamu miliki`);
          return;
        }
        set((s) => ({
          player: {
            ...s.player,
            eggs: { ...s.player.eggs, [speciesId]: s.player.eggs[speciesId] - 1 },
            potions: { ...s.player.potions, [potionId]: s.player.potions[potionId] - 1 },
            pets: [...s.player.pets, id],
            activePet: s.player.activePet ?? id,
          },
        }));
        pushToast('level', `🐣 ${species.name} ${potion.name} menetas!`);
      },

      setActivePet: (id) =>
        set((s) => ({ player: { ...s.player, activePet: id } })),

      buildBuilding: (buildingId) => {
        const { player, kingdom, pushToast } = get();
        const def = BUILDING_BY_ID[buildingId];
        if (!def) return;
        const curLevel = kingdom.buildings[buildingId] ?? 0;
        if (curLevel >= def.maxLevel) return;
        if (kingdom.citizens < def.minCitizens) {
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

        let p = { ...player, dropsToday: 0 };
        let kd = { ...get().kingdom };
        const eff = kingdomEffects(kd.buildings);
        if (totalDamage > 0) {
          totalDamage =
            Math.round(
              totalDamage *
                (1 - conReduction(playerStats(p).con)) *
                eff.damageMult *
                10
            ) / 10;
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
            kd = { ...kd, citizens: kd.citizens + event.citizens };
          }
          kd = {
            ...kd,
            log: [{ date: today, text: event.text }, ...kd.log].slice(0, 14),
          };
          pushToast('info', event.text);
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
          set({
            // backup versi lama tetap bisa dipulihkan: isi field baru dengan default
            player: { ...defaultPlayer(), ...data.player },
            tasks: (data.tasks as Task[]).map((t) =>
              t.type === 'daily' || t.type === 'todo'
                ? { ...t, checklist: t.checklist ?? [] }
                : t
            ),
            lastCron: data.lastCron ?? dateKey(),
            reminder: data.reminder ?? { enabled: false, time: '20:00' },
            history: data.history ?? {},
            kingdom: data.kingdom ?? defaultKingdom(),
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
          toasts: [],
        }),
    }),
    {
      name: 'habitquest-save',
      storage: createJSONStorage(() => offlineStorage),
      version: 5,
      // save lama tetap terbaca: lengkapi field yang belum ada
      migrate: (persisted) => {
        const s = persisted as Partial<GameState>;
        s.history ??= {};
        s.kingdom ??= defaultKingdom();
        if (Array.isArray(s.tasks)) {
          s.tasks = s.tasks.map((t) => {
            if (t.type !== 'daily' && t.type !== 'todo') return t;
            return { ...t, checklist: t.checklist ?? [] };
          });
        }
        s.reminder ??= { enabled: false, time: '20:00' };
        if (s.player) {
          s.player = {
            ...defaultPlayer(),
            ...s.player,
            gear: s.player.gear ?? {},
            ownedGear: s.player.ownedGear ?? [],
            eggs: s.player.eggs ?? {},
            potions: s.player.potions ?? {},
            pets: s.player.pets ?? [],
            dropsToday: s.player.dropsToday ?? 0,
          };
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
      }),
      onRehydrateStorage: () => () => {
        useGame.setState({ _hydrated: true });
      },
    }
  )
);
