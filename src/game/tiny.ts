/**
 * Pemetaan aset peta kerajaan:
 * - Kenney "Tiny Town / Tiny Farm / Tiny Dungeon" (CC0): terrain, pohon,
 *   rumah, balai, pasar, ladang, menara, kastil, karakter, hewan.
 *   Tiap sheet 12 kolom, tile 16×16 px (tilemap_packed). Index = baris*12+kolom.
 * - custom.png: sprite khas buatan sendiri 16×16 (sumur, kuil torii, taman,
 *   lentera, kolam, patung, kincir, pelangi) — 8 kolom, index lihat CUSTOM_INDEX.
 *
 * Objek peta digambar sebagai "komposisi" (comp): daftar stempel tile dengan
 * offset dx,dy dalam satuan tile — bangunan bisa lebih besar dari satu tile
 * (rumah 2×2, kastil 4×3). Semua index di file ini sudah diverifikasi visual.
 */

export type SheetName = 'town' | 'farm' | 'dungeon' | 'custom';

export const SHEET_COLS: Record<SheetName, number> = {
  town: 12,
  farm: 12,
  dungeon: 12,
  custom: 8,
};

export const TILE = 16;

export const SHEET_SRC: Record<SheetName, string> = {
  town: 'tiles/town.png',
  farm: 'tiles/farm.png',
  dungeon: 'tiles/dungeon.png',
  custom: 'tiles/custom.png',
};

export interface Stamp {
  s: SheetName;
  i: number;
  dx: number;
  dy: number;
}

const T = (i: number, dx: number, dy: number): Stamp => ({ s: 'town', i, dx, dy });
const F = (i: number, dx: number, dy: number): Stamp => ({ s: 'farm', i, dx, dy });
const D = (i: number, dx: number, dy: number): Stamp => ({ s: 'dungeon', i, dx, dy });

/** urutan pack custom.png (8 kolom × 3 baris) */
const CUSTOM_ORDER = [
  'well1', 'well2', 'well3', 'temple1', 'temple2', 'temple3', 'garden1', 'garden2',
  'garden3', 'lantern1', 'lantern2', 'lantern3', 'pond1', 'pond2', 'pond3', 'statue1',
  'statue2', 'statue3', 'windmill1', 'windmill2', 'windmill3', 'rainbow1', 'rainbow2', 'rainbow3',
];
export const CUSTOM_INDEX: Record<string, number> = Object.fromEntries(
  CUSTOM_ORDER.map((n, i) => [n, i])
);
export const C = (key: string): Stamp => ({ s: 'custom', i: CUSTOM_INDEX[key] ?? 0, dx: 0, dy: 0 });

/* ---------- terrain ---------- */

export const GRASS_TILES = [0, 0, 0, 1, 1, 2]; // town: polos ×2, variasi, bunga
export const ROAD_TILE = 25; // town: tanah polos (tengah petak)

/* ---------- alam (pohon 2 tile tinggi: puncak + batang) ---------- */

export const NATURE_COMPS: Record<string, Stamp[]> = {
  tree: [T(4, 0, -1), T(16, 0, 0)],
  pine: [T(7, 0, -1), T(19, 0, 0)],
  tree_orange: [T(3, 0, -1), T(15, 0, 0)],
  pine_orange: [T(10, 0, -1), T(22, 0, 0)],
  bush: [T(28, 0, 0)],
  bush_orange: [T(27, 0, 0)],
  mushroom: [T(29, 0, 0)],
  flower: [T(2, 0, 0)],
  apple: [F(78, 0, 0)], // pohon apel kecil
};

/* ---------- karakter (dungeon & farm) ---------- */

export const JOB_CHAR: Record<string, Stamp> = {
  farmer: F(109, 0, 0), // petani bertopi
  miner: D(86, 0, 0), // pria kekar
  poet: D(88, 0, 0), // pemuda pirang
  healer: D(84, 0, 0), // penyihir ungu
  guard: D(96, 0, 0), // ksatria
};
export const CHAR_FALLBACK: Stamp = D(85, 0, 0); // rakyat biasa

export const ANIMALS: { key: string; stamp: Stamp; name: string }[] = [
  { key: 'sheep', stamp: F(120, 0, 0), name: 'Domba' },
  { key: 'cow', stamp: F(121, 0, 0), name: 'Sapi' },
  { key: 'chicken', stamp: F(122, 0, 0), name: 'Ayam' },
];

/* ---------- bangunan (per level) ---------- */

/** rumah rakyat: 2×2 (atap + dinding cokelat + pintu), dua warna atap */
export const HOUSE_COMPS: Stamp[][] = [
  [T(48, 0, 0), T(50, 1, 0), T(72, 0, 1), T(75, 1, 1), T(85, 1, 1)],
  [T(52, 0, 0), T(54, 1, 0), T(72, 0, 1), T(75, 1, 1), T(85, 0, 1)],
];

export interface BuildingComp {
  w: number;
  h: number;
  stamps: Stamp[];
}

/** petak ladang horizontal 3 lebar (kiri/tengah/kanan), dua baris */
const plot = (crops: Stamp[]): BuildingComp => ({
  w: 3,
  h: 2,
  stamps: [
    F(60, 0, 0), F(61, 1, 0), F(62, 2, 0),
    F(60, 0, 1), F(61, 1, 1), F(62, 2, 1),
    ...crops,
  ],
});

export const BUILDING_COMPS: Record<string, BuildingComp> = {
  // Balai desa: rumah besar beratap abu, membesar tiap level
  hall1: {
    w: 2,
    h: 2,
    stamps: [T(48, 0, 0), T(50, 1, 0), T(72, 0, 1), T(75, 1, 1), T(86, 1, 1)],
  },
  hall2: {
    w: 3,
    h: 2,
    stamps: [
      T(48, 0, 0), T(49, 1, 0), T(50, 2, 0),
      T(72, 0, 1), T(73, 1, 1), T(75, 2, 1), T(86, 1, 1),
    ],
  },
  hall3: {
    w: 3,
    h: 3,
    stamps: [
      T(48, 0, 0), T(49, 1, 0), T(50, 2, 0),
      T(60, 0, 1), T(61, 1, 1), T(62, 2, 1),
      T(72, 0, 2), T(73, 1, 2), T(75, 2, 2), T(86, 1, 2), T(83, 2, 2),
    ],
  },
  // Pasar: kios beratap merah, etalase & peti dagangan bertambah
  market1: {
    w: 2,
    h: 2,
    stamps: [T(52, 0, 0), T(54, 1, 0), T(72, 0, 1), T(75, 1, 1), T(84, 0, 1)],
  },
  market2: {
    w: 3,
    h: 2,
    stamps: [
      T(52, 0, 0), T(53, 1, 0), T(54, 2, 0),
      T(72, 0, 1), T(73, 1, 1), T(75, 2, 1), T(84, 1, 1), F(59, 2, 1),
    ],
  },
  market3: {
    w: 4,
    h: 2,
    stamps: [
      T(52, 0, 0), T(53, 1, 0), T(54, 2, 0),
      T(72, 0, 1), T(73, 1, 1), T(75, 2, 1), T(84, 1, 1),
      F(59, 2, 1), F(71, 3, 1), T(83, 3, 0),
    ],
  },
  // Ladang: petak dengan fase tumbuh (tunas, hijau, gandum emas + peti panen)
  farm1: plot([F(64, 0, 0), F(64, 2, 0), F(64, 1, 1)]),
  farm2: plot([
    F(65, 0, 0), F(66, 1, 0), F(65, 2, 0),
    F(66, 0, 1), F(65, 1, 1), F(66, 2, 1),
  ]),
  farm3: plot([
    F(67, 0, 0), F(67, 1, 0), F(67, 2, 0),
    F(67, 0, 1), F(67, 1, 1), F(71, 2, 1),
  ]),
  // Menara jaga: benteng batu 2 lebar
  tower1: {
    w: 2,
    h: 2,
    stamps: [T(96, 0, 0), T(98, 1, 0), T(120, 0, 1), T(122, 1, 1)],
  },
  tower2: {
    w: 2,
    h: 3,
    stamps: [
      T(96, 0, 0), T(98, 1, 0),
      T(125, 0, 1), T(110, 1, 1),
      T(120, 0, 2), T(122, 1, 2),
    ],
  },
  // Kastil: tembok batu 4 lebar, jendela, gerbang lengkung
  castle1: {
    w: 4,
    h: 3,
    stamps: [
      T(96, 0, 0), T(97, 1, 0), T(97, 2, 0), T(98, 3, 0),
      T(108, 0, 1), T(125, 1, 1), T(125, 2, 1), T(110, 3, 1),
      T(120, 0, 2), T(121, 1, 2), T(121, 2, 2), T(122, 3, 2),
      T(113, 1, 2), T(114, 2, 2),
    ],
  },
  // Sumur & kuil: sprite custom 16 px (1 tile), level = varian sprite
  well1: { w: 1, h: 1, stamps: [C('well1')] },
  well2: { w: 1, h: 1, stamps: [C('well2')] },
  well3: { w: 1, h: 1, stamps: [C('well3')] },
  temple1: { w: 1, h: 1, stamps: [C('temple1')] },
  temple2: { w: 1, h: 1, stamps: [C('temple2')] },
  temple3: { w: 1, h: 1, stamps: [C('temple3')] },
};

/** dekorasi custom: kunci sprite `${id}${level}` di custom.png */
export const DECOR_SPRITE = (id: string, level: number): Stamp[] => [
  C(`${id}${level}`),
];

/** Papan penanda kavling yang belum dibangun. */
export const SIGN_STAMP: Stamp = T(83, 0, 0);
