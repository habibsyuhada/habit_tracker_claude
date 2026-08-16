import type { Kingdom } from '../types';
import { BUILDINGS, DECOR } from './kingdom';
import {
  BUILDING_COMPS,
  DECOR_SPRITE,
  HOUSE_COMPS,
  NATURE_COMPS,
  type Stamp,
} from './tiny';

/**
 * Tata letak peta kerajaan full-screen — desain tetap (bukan acak) supaya
 * wilayah terasa seperti "tempat" yang stabil: kastil di utara, alun-alun di
 * depannya, distrik rumah di barat, ladang di barat daya, kuil di timur.
 *
 * Terrain & bangunan umum memakai tile Kenney Tiny Town/Farm/Dungeon (16 px),
 * sedangkan bangunan khas (sumur, kuil torii, kincir, dst.) memakai sprite
 * custom 12×12 yang digambar 24 px (kunci `sprite`).
 */

export const MAP_W = 26;
export const MAP_H = 22;
export { TILE } from './tiny';

const key = (x: number, y: number) => `${x},${y}`;

/** Segmen jalan: [x1,y1,x2,y2] inklusif, horizontal atau vertikal. */
const ROAD_SEGMENTS: [number, number, number, number][] = [
  [12, 6, 12, 20], // jalan utama: gerbang kastil → gerbang selatan
  [6, 8, 19, 8], // alun-alun utara (depan kastil)
  [3, 13, 22, 13], // jalan lintas tengah
  [6, 8, 6, 19], // gang perumahan barat
  [6, 19, 12, 19], // gang selatan perumahan
  [19, 8, 19, 13], // jalan kuil timur
];

export const ROADS: Set<string> = (() => {
  const set = new Set<string>();
  for (const [x1, y1, x2, y2] of ROAD_SEGMENTS) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        set.add(key(x, y));
      }
    }
  }
  return set;
})();

/**
 * Posisi bangunan: anchor = pojok KIRI-BAWAH (bangunan tumbuh ke atas saat
 * levelnya menambah tinggi komposisi, sehingga "pintu" tetap menghadap jalan).
 */
const BUILDING_SPOTS: Record<string, { x: number; bottom: number }> = {
  castle: { x: 10, bottom: 5 },
  hall: { x: 8, bottom: 7 },
  market: { x: 14, bottom: 7 },
  farm: { x: 2, bottom: 12 },
  tower: { x: 13, bottom: 18 },
  well: { x: 10, bottom: 12 }, // custom
  temple: { x: 19, bottom: 7 }, // custom
};

const DECOR_SPOTS: Record<string, { x: number; y: number }> = {
  garden: { x: 9, y: 10 },
  lantern: { x: 14, y: 9 },
  pond: { x: 16, y: 10 },
  statue: { x: 11, y: 9 },
  windmill: { x: 2, y: 16 },
  rainbow: { x: 17, y: 15 },
};

/** Slot rumah rakyat 2×2 (anchor kiri-bawah), terisi berurutan. */
const HOUSE_SPOTS: { x: number; bottom: number }[] = [
  { x: 4, bottom: 10 },
  { x: 7, bottom: 10 },
  { x: 4, bottom: 12 },
  { x: 7, bottom: 12 },
  { x: 4, bottom: 16 },
  { x: 7, bottom: 16 },
  { x: 4, bottom: 18 },
  { x: 7, bottom: 18 },
];

/** Titik kemunculan penanda ancaman di tepi hutan barat daya. */
export const THREAT_SPOT = { x: 2, y: 18 };

export interface MapObject {
  /** id unik untuk seleksi, mis. "b:farm", "d:pond", "h:3", "s:tower" */
  id: string;
  kind: 'building' | 'decor' | 'house' | 'sign';
  /** id definisi (bangunan/dekorasi) — untuk rumah: index slot */
  defId: string;
  level: number;
  /** pojok kiri-atas area objek, dalam tile */
  x: number;
  y: number;
  w: number;
  h: number;
  /** komposisi tile Kenney (relatif ke x,y) */
  comp?: Stamp[];
  /** kunci sprite custom 12×12 (digambar 24 px, anchor bawah-tengah) */
  sprite?: string;
}

export interface KingdomLayout {
  objects: MapObject[];
  /** komposisi alam pemanis: kunci "x,y" → kunci NATURE_COMPS */
  nature: Map<string, string>;
  houseCount: number;
  /** tile yang bisa dilalui hewan (rumput kosong di dalam area) */
  meadow: { x: number; y: number }[];
}

/** Hash deterministik kecil untuk penyebaran alam yang stabil. */
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) % 1000;
}

const SCATTER = ['tree', 'pine', 'bush', 'flower', 'tree', 'bush_orange', 'mushroom', 'pine', 'apple', 'tree_orange'];
const BORDER = ['tree', 'pine', 'tree', 'pine_orange', 'pine', 'tree_orange'];

export function layoutKingdom(kingdom: Kingdom): KingdomLayout {
  const objects: MapObject[] = [];
  const occupied = new Set<string>();
  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++)
      for (let dy = 0; dy < h; dy++) occupied.add(key(x + dx, y + dy));
  };

  // bangunan terbangun — atau papan penanda kavling bila belum
  for (const def of BUILDINGS) {
    const spot = BUILDING_SPOTS[def.id];
    if (!spot) continue;
    const lvl = Math.min(kingdom.buildings[def.id] ?? 0, def.maxLevel);
    if (lvl > 0) {
      const comp = BUILDING_COMPS[`${def.id}${lvl}`];
      if (comp) {
        const y = spot.bottom - (comp.h - 1);
        objects.push({
          id: `b:${def.id}`,
          kind: 'building',
          defId: def.id,
          level: lvl,
          x: spot.x,
          y,
          w: comp.w,
          h: comp.h,
          comp: comp.stamps,
          sprite: `${def.id}${lvl}`,
        });
        occupy(spot.x, y, comp.w, comp.h);
      }
    } else {
      objects.push({
        id: `s:${def.id}`,
        kind: 'sign',
        defId: def.id,
        level: 0,
        x: spot.x,
        y: spot.bottom,
        w: 1,
        h: 1,
      });
      // pesan seluruh kavling terbesar supaya alam tidak tumbuh di sana
      const biggest = BUILDING_COMPS[`${def.id}${def.maxLevel}`];
      if (biggest) {
        occupy(spot.x, spot.bottom - (biggest.h - 1), biggest.w, biggest.h);
      } else {
        occupy(spot.x, spot.bottom, 1, 1);
      }
    }
  }

  // dekorasi — hanya yang sudah dibeli
  for (const def of DECOR) {
    const spot = DECOR_SPOTS[def.id];
    if (!spot) continue;
    const lvl = Math.min(kingdom.decor[def.id] ?? 0, def.maxLevel);
    occupy(spot.x, spot.y, 1, 1);
    if (lvl <= 0) continue;
    objects.push({
      id: `d:${def.id}`,
      kind: 'decor',
      defId: def.id,
      level: lvl,
      x: spot.x,
      y: spot.y,
      w: 1,
      h: 1,
      comp: DECOR_SPRITE(def.id, lvl),
      sprite: `${def.id}${lvl}`,
    });
  }

  // rumah rakyat (1 per 3 jiwa), dua palet selang-seling
  const houseCount = Math.min(
    HOUSE_SPOTS.length,
    Math.floor(kingdom.citizens.length / 3)
  );
  for (let i = 0; i < HOUSE_SPOTS.length; i++) {
    const spot = HOUSE_SPOTS[i];
    occupy(spot.x, spot.bottom - 1, 2, 2);
    if (i >= houseCount) continue;
    objects.push({
      id: `h:${i}`,
      kind: 'house',
      defId: String(i),
      level: 1,
      x: spot.x,
      y: spot.bottom - 1,
      w: 2,
      h: 2,
      comp: HOUSE_COMPS[i % HOUSE_COMPS.length],
      sprite: 'house',
    });
  }
  occupy(THREAT_SPOT.x, THREAT_SPOT.y, 1, 1);

  // alam: cincin hutan di tepi + sebaran deterministik di dalam
  const nature = new Map<string, string>();
  const meadow: { x: number; y: number }[] = [];
  for (let x = 0; x < MAP_W; x++) {
    for (let y = 0; y < MAP_H; y++) {
      const k = key(x, y);
      if (ROADS.has(k) || occupied.has(k)) continue;
      const border = x <= 1 || x >= MAP_W - 2 || y <= 1 || y >= MAP_H - 2;
      if (border) {
        // gerbang selatan tetap terbuka
        if (y >= MAP_H - 2 && x >= 11 && x <= 13) continue;
        nature.set(k, BORDER[hash2(x, y) % BORDER.length]);
        continue;
      }
      const roll = hash2(x, y);
      if (roll < 150) {
        nature.set(k, SCATTER[roll % SCATTER.length]);
      } else {
        meadow.push({ x, y });
      }
    }
  }

  return { objects, nature, houseCount, meadow };
}

/** Daftar tile jalan sebagai array (untuk graf jalan penduduk). */
export const ROAD_TILES: { x: number; y: number }[] = [...ROADS].map((k) => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
});

/** Tetangga jalan dari sebuah tile jalan. */
export function roadNeighbors(x: number, y: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (ROADS.has(key(x + 1, y))) out.push({ x: x + 1, y });
  if (ROADS.has(key(x - 1, y))) out.push({ x: x - 1, y });
  if (ROADS.has(key(x, y + 1))) out.push({ x, y: y + 1 });
  if (ROADS.has(key(x, y - 1))) out.push({ x, y: y - 1 });
  return out;
}

/** Verifikasi NATURE_COMPS punya semua kunci yang dipakai (dev-time). */
if (import.meta.env.DEV) {
  for (const k of [...SCATTER, ...BORDER]) {
    if (!NATURE_COMPS[k]) console.warn(`NATURE_COMPS tidak punya kunci "${k}"`);
  }
}
