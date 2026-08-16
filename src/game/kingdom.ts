import type { Citizen, Kingdom } from '../types';

/**
 * Kerajaan Mini — identitas baru game ini:
 * tugasmu adalah titah kerajaan. Rakyat berdatangan saat kamu produktif,
 * bangunan memberi efek pasif nyata ke ekonomi & pertahanan kerajaan,
 * dan tiap pergantian hari terjadi event kerajaan.
 */

export interface TitleTier {
  minLevel: number;
  title: string;
  realm: string;
}

export const TITLES: TitleTier[] = [
  { minLevel: 1, title: 'Kepala Dusun', realm: 'Dusun Terpencil' },
  { minLevel: 4, title: 'Juragan', realm: 'Desa Kecil' },
  { minLevel: 8, title: 'Bangsawan', realm: 'Desa Makmur' },
  { minLevel: 12, title: 'Adipati', realm: 'Kota Niaga' },
  { minLevel: 17, title: 'Raja', realm: 'Kerajaan' },
  { minLevel: 25, title: 'Maharaja', realm: 'Kerajaan Agung' },
  { minLevel: 40, title: 'Kaisar', realm: 'Kekaisaran' },
];

export function titleFor(level: number): TitleTier {
  let cur = TITLES[0];
  for (const t of TITLES) if (level >= t.minLevel) cur = t;
  return cur;
}

export interface BuildingDef {
  id: string;
  name: string;
  emoji: string;
  maxLevel: number;
  /** biaya level 1; tiap level berikutnya ×1.8 */
  baseCost: number;
  /** minimal jumlah rakyat untuk mulai membangun */
  minCitizens: number;
  /** efek per level */
  goldPct: number;
  xpPct: number;
  damagePct: number;
  /** hari ekstra tenggat sebelum ancaman menyerang */
  threatDelay: number;
  desc: string;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'farm', name: 'Ladang', emoji: '🌾', maxLevel: 3, baseCost: 15,
    minCitizens: 0, goldPct: 3, xpPct: 0, damagePct: 0, threatDelay: 0,
    desc: '+3% kas kerajaan per level',
  },
  {
    id: 'well', name: 'Sumur', emoji: '⛲', maxLevel: 3, baseCost: 20,
    minCitizens: 0, goldPct: 0, xpPct: 3, damagePct: 0, threatDelay: 0,
    desc: '+3% kemakmuran (XP) per level',
  },
  {
    id: 'hall', name: 'Balai Desa', emoji: '🏛️', maxLevel: 3, baseCost: 35,
    minCitizens: 5, goldPct: 2, xpPct: 2, damagePct: 0, threatDelay: 0,
    desc: '+2% kas & kemakmuran per level',
  },
  {
    id: 'market', name: 'Pasar', emoji: '🏪', maxLevel: 3, baseCost: 50,
    minCitizens: 8, goldPct: 5, xpPct: 0, damagePct: 0, threatDelay: 0,
    desc: '+5% kas kerajaan per level',
  },
  {
    id: 'temple', name: 'Kuil', emoji: '⛩️', maxLevel: 3, baseCost: 60,
    minCitizens: 10, goldPct: 0, xpPct: 0, damagePct: 5, threatDelay: 0,
    desc: '-5% damage moral per level',
  },
  {
    id: 'tower', name: 'Menara Jaga', emoji: '🗼', maxLevel: 2, baseCost: 80,
    minCitizens: 13, goldPct: 0, xpPct: 0, damagePct: 0, threatDelay: 1,
    desc: 'Peringatan dini: +1 hari tenggat ancaman per level',
  },
  {
    id: 'castle', name: 'Kastil', emoji: '🏰', maxLevel: 1, baseCost: 250,
    minCitizens: 18, goldPct: 5, xpPct: 5, damagePct: 5, threatDelay: 0,
    desc: '+5% kas & kemakmuran, -5% damage',
  },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/** Rakyat baru datang setiap N tugas selesai. */
export const CITIZEN_EVERY = 4;

export function buildingCost(def: BuildingDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(1.8, currentLevel));
}

export interface KingdomEffects {
  goldMult: number;
  xpMult: number;
  damageMult: number;
  /** hari ekstra tenggat ancaman dari Menara Jaga */
  threatDelayBonus: number;
}

export function kingdomEffects(buildings: Record<string, number>): KingdomEffects {
  let gold = 0;
  let xp = 0;
  let dmg = 0;
  let delay = 0;
  for (const [id, lvl] of Object.entries(buildings)) {
    const def = BUILDING_BY_ID[id];
    if (!def || lvl <= 0) continue;
    gold += def.goldPct * lvl;
    xp += def.xpPct * lvl;
    dmg += def.damagePct * lvl;
    delay += def.threatDelay * lvl;
  }
  return {
    goldMult: 1 + gold / 100,
    xpMult: 1 + xp / 100,
    damageMult: Math.max(0.4, 1 - dmg / 100),
    threatDelayBonus: delay,
  };
}

// ---------- rakyat: nama & profesi ----------

export interface JobDef {
  id: string;
  name: string;
  emoji: string;
  /** hasil pasif per hari */
  gold: number;
  xp: number;
  moral: number;
  /** bobot kemunculan saat rakyat baru datang */
  weight: number;
}

export const JOBS: JobDef[] = [
  { id: 'farmer', name: 'Petani', emoji: '👨‍🌾', gold: 0.5, xp: 0, moral: 0, weight: 4 },
  { id: 'miner', name: 'Penambang', emoji: '⛏️', gold: 0.8, xp: 0, moral: 0, weight: 2 },
  { id: 'poet', name: 'Pujangga', emoji: '🎭', gold: 0, xp: 1, moral: 0, weight: 2 },
  { id: 'healer', name: 'Tabib', emoji: '🌿', gold: 0, xp: 0, moral: 0.5, weight: 1 },
  { id: 'guard', name: 'Penjaga', emoji: '💂', gold: 0.3, xp: 0, moral: 0, weight: 1 },
];

export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));

const CITIZEN_NAMES = [
  'Budi', 'Sari', 'Joko', 'Dewi', 'Agus', 'Rina', 'Tono', 'Lina', 'Wawan',
  'Ratna', 'Bambang', 'Siti', 'Eko', 'Maya', 'Dodi', 'Indah', 'Galih',
  'Wulan', 'Raden', 'Laras', 'Surya', 'Melati',
];

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function newCitizen(): Citizen {
  const totalWeight = JOBS.reduce((s, j) => s + j.weight, 0);
  let roll = Math.random() * totalWeight;
  let job = JOBS[0];
  for (const j of JOBS) {
    roll -= j.weight;
    if (roll <= 0) {
      job = j;
      break;
    }
  }
  return {
    id: uid(),
    name: CITIZEN_NAMES[Math.floor(Math.random() * CITIZEN_NAMES.length)],
    job: job.id,
  };
}

/** Hasil kerja seluruh rakyat untuk satu hari. */
export function dailyYield(citizens: Citizen[]): {
  gold: number;
  xp: number;
  moral: number;
} {
  let gold = 0;
  let xp = 0;
  let moral = 0;
  for (const c of citizens) {
    const job = JOB_BY_ID[c.job];
    if (!job) continue;
    gold += job.gold;
    xp += job.xp;
    moral += job.moral;
  }
  return {
    gold: Math.round(gold * 10) / 10,
    xp: Math.round(xp),
    moral: Math.round(moral * 10) / 10,
  };
}

// ---------- ancaman kerajaan ----------

export interface ThreatDef {
  id: string;
  name: string;
  emoji: string;
  /** jumlah tugas yang harus diselesaikan untuk menangkal */
  goal: number;
  /** tenggat dalam hari */
  days: number;
  minLevel: number;
  rewardGold: number;
  penaltyMoral: number;
  warning: string;
}

export const THREATS: ThreatDef[] = [
  {
    id: 'wolves', name: 'Kawanan Serigala', emoji: '🐺', goal: 5, days: 2,
    minLevel: 1, rewardGold: 15, penaltyMoral: 6,
    warning: 'terlihat mengintai di perbatasan hutan!',
  },
  {
    id: 'bandits', name: 'Gerombolan Bandit', emoji: '🏴‍☠️', goal: 7, days: 2,
    minLevel: 4, rewardGold: 25, penaltyMoral: 8,
    warning: 'berkemah di jalur dagang menuju kerajaan!',
  },
  {
    id: 'plague', name: 'Wabah Misterius', emoji: '🦠', goal: 8, days: 3,
    minLevel: 6, rewardGold: 30, penaltyMoral: 10,
    warning: 'mulai menjangkiti desa-desa tetangga!',
  },
  {
    id: 'dragon', name: 'Naga Gunung', emoji: '🐲', goal: 12, days: 3,
    minLevel: 10, rewardGold: 60, penaltyMoral: 12,
    warning: 'terbangun dari tidurnya dan mengincar wilayahmu!',
  },
];

export const THREAT_BY_ID = Object.fromEntries(THREATS.map((t) => [t.id, t]));

/** Peluang ancaman baru muncul tiap pergantian hari (bila tidak ada yang aktif). */
export const THREAT_CHANCE = 0.3;

export function pickThreat(level: number): ThreatDef | undefined {
  const eligible = THREATS.filter((t) => level >= t.minLevel);
  if (eligible.length === 0) return undefined;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// ---------- dekorasi ----------

export interface DecorDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;
}

export const DECOR: DecorDef[] = [
  { id: 'garden', name: 'Taman Bunga', emoji: '🌸', cost: 15 },
  { id: 'lantern', name: 'Lentera Batu', emoji: '🏮', cost: 20 },
  { id: 'statue', name: 'Patung Pahlawan', emoji: '🗿', cost: 35 },
  { id: 'pond', name: 'Kolam Teratai', emoji: '🪷', cost: 30 },
  { id: 'windmill', name: 'Kincir Angin', emoji: '🪁', cost: 45 },
  { id: 'rainbow', name: 'Gerbang Pelangi', emoji: '🌈', cost: 60 },
];

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));

// ---------- event kerajaan harian ----------

export interface KingdomEvent {
  text: string;
  gold?: number;
  citizens?: number;
  moral?: number;
}

const GOOD_EVENTS: ((lvl: number) => KingdomEvent)[] = [
  (lvl) => ({
    text: `🎪 Festival rakyat digelar! Kas bertambah ${5 + lvl} gold.`,
    gold: 5 + lvl,
  }),
  () => ({ text: '👶 Seorang bayi lahir di kerajaan — rakyat bertambah!', citizens: 1 }),
  (lvl) => ({
    text: `🐫 Karavan pedagang singgah dan membayar upeti ${3 + lvl} gold.`,
    gold: 3 + lvl,
  }),
  () => ({ text: '🌈 Pertanda baik di langit — moral rakyat naik.', moral: 3 }),
];

const NEUTRAL_EVENTS: KingdomEvent[] = [
  { text: '☀️ Hari yang tenang di seluruh kerajaan.' },
  { text: '🐦 Burung-burung berkicau di alun-alun. Damai.' },
  { text: '🎣 Para nelayan pulang dengan tangkapan biasa saja.' },
];

const BAD_EVENTS: KingdomEvent[] = [
  { text: '🌧️ Hujan seharian — rakyat menunggu titah yang tak kunjung datang.' },
  { text: '😞 Rakyat berbisik: "Ke mana gerangan pemimpin kita?"' },
  { text: '🕸️ Alun-alun mulai berdebu karena sepi kegiatan.' },
];

/**
 * Pilih event pergantian hari: kemarin sempurna → event bagus,
 * banyak titah terbengkalai → event murung, selain itu netral.
 */
export function rollKingdomEvent(
  perfect: boolean,
  missedCount: number,
  level: number
): KingdomEvent {
  if (perfect) {
    return GOOD_EVENTS[Math.floor(Math.random() * GOOD_EVENTS.length)](level);
  }
  if (missedCount >= 2) {
    return BAD_EVENTS[Math.floor(Math.random() * BAD_EVENTS.length)];
  }
  return NEUTRAL_EVENTS[Math.floor(Math.random() * NEUTRAL_EVENTS.length)];
}

// ---------- peta kerajaan ----------

const TREES = ['🌳', '🌲', '🌿', '🌳', '🌾'];

/**
 * Susun peta tile kerajaan dari state — deterministik supaya peta stabil:
 * bangunan yang berdiri, rumah rakyat (1 per 3 jiwa), sisanya alam.
 */
export function buildMap(kingdom: Kingdom): string[] {
  const placed: string[] = [];
  for (const def of BUILDINGS) {
    if ((kingdom.buildings[def.id] ?? 0) > 0) placed.push(def.emoji);
  }
  for (const id of kingdom.decor) {
    const def = DECOR_BY_ID[id];
    if (def) placed.push(def.emoji);
  }
  const houses = Math.floor(kingdom.citizens.length / 3);
  for (let i = 0; i < houses; i++) placed.push('🏠');

  const total = Math.max(21, Math.ceil((placed.length + 6) / 7) * 7);
  const tiles: string[] = new Array(total).fill('');
  // sebar bangunan merata dengan langkah tetap agar tidak menggerombol
  let pos = 3;
  for (const t of placed) {
    while (tiles[pos % total]) pos += 1;
    tiles[pos % total] = t;
    pos += 5;
  }
  for (let i = 0; i < total; i++) {
    if (!tiles[i]) tiles[i] = TREES[(i * 7 + 3) % TREES.length];
  }
  return tiles;
}
