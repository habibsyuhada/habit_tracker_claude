import type { Kingdom } from '../types';

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
  dropCap: number;
  desc: string;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'farm', name: 'Ladang', emoji: '🌾', maxLevel: 3, baseCost: 15,
    minCitizens: 0, goldPct: 3, xpPct: 0, damagePct: 0, dropCap: 0,
    desc: '+3% kas kerajaan per level',
  },
  {
    id: 'well', name: 'Sumur', emoji: '⛲', maxLevel: 3, baseCost: 20,
    minCitizens: 0, goldPct: 0, xpPct: 3, damagePct: 0, dropCap: 0,
    desc: '+3% kemakmuran (XP) per level',
  },
  {
    id: 'hall', name: 'Balai Desa', emoji: '🏛️', maxLevel: 3, baseCost: 35,
    minCitizens: 5, goldPct: 2, xpPct: 2, damagePct: 0, dropCap: 0,
    desc: '+2% kas & kemakmuran per level',
  },
  {
    id: 'market', name: 'Pasar', emoji: '🏪', maxLevel: 3, baseCost: 50,
    minCitizens: 8, goldPct: 5, xpPct: 0, damagePct: 0, dropCap: 0,
    desc: '+5% kas kerajaan per level',
  },
  {
    id: 'temple', name: 'Kuil', emoji: '⛩️', maxLevel: 3, baseCost: 60,
    minCitizens: 10, goldPct: 0, xpPct: 0, damagePct: 5, dropCap: 0,
    desc: '-5% damage moral per level',
  },
  {
    id: 'tower', name: 'Menara Jaga', emoji: '🗼', maxLevel: 2, baseCost: 80,
    minCitizens: 13, goldPct: 0, xpPct: 0, damagePct: 0, dropCap: 1,
    desc: '+1 jatah drop harian per level',
  },
  {
    id: 'castle', name: 'Kastil', emoji: '🏰', maxLevel: 1, baseCost: 250,
    minCitizens: 18, goldPct: 5, xpPct: 5, damagePct: 5, dropCap: 0,
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
  dropBonus: number;
}

export function kingdomEffects(buildings: Record<string, number>): KingdomEffects {
  let gold = 0;
  let xp = 0;
  let dmg = 0;
  let drop = 0;
  for (const [id, lvl] of Object.entries(buildings)) {
    const def = BUILDING_BY_ID[id];
    if (!def || lvl <= 0) continue;
    gold += def.goldPct * lvl;
    xp += def.xpPct * lvl;
    dmg += def.damagePct * lvl;
    drop += def.dropCap * lvl;
  }
  return {
    goldMult: 1 + gold / 100,
    xpMult: 1 + xp / 100,
    damageMult: Math.max(0.4, 1 - dmg / 100),
    dropBonus: drop,
  };
}

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
  const houses = Math.floor(kingdom.citizens / 3);
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
