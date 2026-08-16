import type { GearSlot, Player } from '../types';

/**
 * Katalog perlengkapan & pet — versi ringkas dari sistem Habitica:
 * - gear dibeli berurutan per slot (tier berikutnya muncul setelah
 *   tier sebelumnya dimiliki), persis toko Rewards Habitica,
 * - STR menambah XP & gold dari tugas, CON mengurangi damage,
 * - telur + ramuan drop acak dari tugas selesai, ditetaskan jadi pet.
 */

export interface GearItem {
  id: string;
  slot: GearSlot;
  name: string;
  emoji: string;
  cost: number;
  str: number;
  con: number;
}

export const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: 'Senjata',
  armor: 'Zirah',
  head: 'Helm',
  shield: 'Perisai',
};

export const GEAR: GearItem[] = [
  // senjata → STR (bonus XP & gold)
  { id: 'weapon1', slot: 'weapon', name: 'Pedang Kayu', emoji: '🗡️', cost: 20, str: 2, con: 0 },
  { id: 'weapon2', slot: 'weapon', name: 'Pedang Besi', emoji: '⚔️', cost: 35, str: 4, con: 0 },
  { id: 'weapon3', slot: 'weapon', name: 'Pedang Perak', emoji: '🔱', cost: 60, str: 6, con: 0 },
  { id: 'weapon4', slot: 'weapon', name: 'Pedang Naga', emoji: '☄️', cost: 120, str: 9, con: 0 },
  // zirah → CON (mengurangi damage)
  { id: 'armor1', slot: 'armor', name: 'Baju Kulit', emoji: '🥋', cost: 30, str: 0, con: 3 },
  { id: 'armor2', slot: 'armor', name: 'Zirah Rantai', emoji: '⛓️', cost: 45, str: 0, con: 5 },
  { id: 'armor3', slot: 'armor', name: 'Zirah Baja', emoji: '🦺', cost: 80, str: 0, con: 7 },
  { id: 'armor4', slot: 'armor', name: 'Zirah Naga', emoji: '🐲', cost: 150, str: 0, con: 10 },
  // helm → CON
  { id: 'head1', slot: 'head', name: 'Topi Kain', emoji: '🧢', cost: 15, str: 0, con: 2 },
  { id: 'head2', slot: 'head', name: 'Helm Kulit', emoji: '👒', cost: 25, str: 0, con: 3 },
  { id: 'head3', slot: 'head', name: 'Helm Besi', emoji: '🪖', cost: 45, str: 0, con: 5 },
  { id: 'head4', slot: 'head', name: 'Mahkota Naga', emoji: '👑', cost: 100, str: 2, con: 8 },
  // perisai → CON
  { id: 'shield1', slot: 'shield', name: 'Perisai Kayu', emoji: '🪵', cost: 20, str: 0, con: 2 },
  { id: 'shield2', slot: 'shield', name: 'Perisai Besi', emoji: '🛡️', cost: 40, str: 0, con: 4 },
  { id: 'shield3', slot: 'shield', name: 'Perisai Naga', emoji: '🔰', cost: 90, str: 0, con: 7 },
];

export const GEAR_BY_ID: Record<string, GearItem> = Object.fromEntries(
  GEAR.map((g) => [g.id, g])
);

export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'head', 'shield'];

/** Item berikutnya yang bisa dibeli di slot ini (tier terendah yang belum dimiliki). */
export function nextGearForSlot(slot: GearSlot, owned: string[]): GearItem | undefined {
  return GEAR.find((g) => g.slot === slot && !owned.includes(g.id));
}

export function gearStats(gear: Partial<Record<GearSlot, string>>): {
  str: number;
  con: number;
} {
  let str = 0;
  let con = 0;
  for (const id of Object.values(gear)) {
    const item = id ? GEAR_BY_ID[id] : undefined;
    if (item) {
      str += item.str;
      con += item.con;
    }
  }
  return { str, con };
}

/** STR menambah XP & gold: +1% per poin. */
export function strMultiplier(str: number): number {
  return 1 + str / 100;
}

/** CON mengurangi damage: -1% per poin, maksimal -60%. */
export function conReduction(con: number): number {
  return Math.min(0.6, con / 100);
}

export function playerStats(player: Player) {
  return gearStats(player.gear);
}

// ---------- pets ----------

export interface Species {
  id: string;
  name: string;
  emoji: string;
}

export const SPECIES: Species[] = [
  { id: 'dragon', name: 'Naga', emoji: '🐉' },
  { id: 'cat', name: 'Kucing', emoji: '🐱' },
  { id: 'wolf', name: 'Serigala', emoji: '🐺' },
  { id: 'fox', name: 'Rubah', emoji: '🦊' },
  { id: 'bear', name: 'Beruang', emoji: '🐻' },
  { id: 'owl', name: 'Burung Hantu', emoji: '🦉' },
];

export interface Potion {
  id: string;
  name: string;
  color: string;
}

export const POTIONS: Potion[] = [
  { id: 'red', name: 'Merah', color: '#f74e52' },
  { id: 'blue', name: 'Biru', color: '#2995cd' },
  { id: 'gold', name: 'Emas', color: '#ffb445' },
  { id: 'purple', name: 'Ungu', color: '#925cf3' },
  { id: 'green', name: 'Hijau', color: '#24cc8f' },
  { id: 'shadow', name: 'Bayangan', color: '#34313a' },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const POTION_BY_ID = Object.fromEntries(POTIONS.map((p) => [p.id, p]));

export const DROP_CHANCE = 0.25;
export const MAX_DROPS_PER_DAY = 4;

export function petId(speciesId: string, potionId: string): string {
  return `${speciesId}:${potionId}`;
}

export function parsePetId(id: string): { species: Species; potion: Potion } | undefined {
  const [s, p] = id.split(':');
  const species = SPECIES_BY_ID[s];
  const potion = POTION_BY_ID[p];
  return species && potion ? { species, potion } : undefined;
}
