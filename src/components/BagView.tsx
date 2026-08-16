import { useState } from 'react';
import { useGame } from '../store/useGame';
import {
  GEAR,
  GEAR_SLOTS,
  POTIONS,
  SLOT_LABEL,
  SPECIES,
  conReduction,
  parsePetId,
  playerStats,
  strMultiplier,
} from '../game/items';

/** Tab Tas: perlengkapan terpasang, penetasan pet, dan kandang pet. */
export function BagView() {
  const player = useGame((s) => s.player);
  const equipGear = useGame((s) => s.equipGear);
  const unequipGear = useGame((s) => s.unequipGear);
  const hatchPet = useGame((s) => s.hatchPet);
  const setActivePet = useGame((s) => s.setActivePet);

  const [eggPick, setEggPick] = useState<string | null>(null);
  const [potionPick, setPotionPick] = useState<string | null>(null);

  const stats = playerStats(player);
  const ownedEggs = SPECIES.filter((s) => (player.eggs[s.id] ?? 0) > 0);
  const ownedPotions = POTIONS.filter((p) => (player.potions[p.id] ?? 0) > 0);

  const doHatch = () => {
    if (!eggPick || !potionPick) return;
    hatchPet(eggPick, potionPick);
    setEggPick(null);
    setPotionPick(null);
  };

  return (
    <div className="bag">
      {/* ---- perlengkapan ---- */}
      <h3 className="section-title">⚔️ Perlengkapan</h3>
      <div className="stat-summary">
        <span className="stat-str">
          ⚔️ STR {stats.str} <em>(+{Math.round((strMultiplier(stats.str) - 1) * 100)}% XP & gold)</em>
        </span>
        <span className="stat-con">
          🛡️ CON {stats.con} <em>(-{Math.round(conReduction(stats.con) * 100)}% damage)</em>
        </span>
      </div>
      {GEAR_SLOTS.map((slot) => {
        const ownedInSlot = GEAR.filter(
          (g) => g.slot === slot && player.ownedGear.includes(g.id)
        );
        const equippedId = player.gear[slot];
        return (
          <div className="slot-row" key={slot}>
            <span className="slot-label">{SLOT_LABEL[slot]}</span>
            <div className="chip-row">
              {ownedInSlot.length === 0 && (
                <span className="muted slot-empty">belum ada — cek toko di tab Rewards</span>
              )}
              {ownedInSlot.map((g) => (
                <button
                  key={g.id}
                  className={`chip ${equippedId === g.id ? 'active' : ''}`}
                  onClick={() =>
                    equippedId === g.id ? unequipGear(slot) : equipGear(g.id)
                  }
                  title={equippedId === g.id ? 'Ketuk untuk melepas' : 'Ketuk untuk memakai'}
                >
                  {g.emoji} {g.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* ---- penetasan ---- */}
      <h3 className="section-title">🐣 Penetasan</h3>
      {ownedEggs.length === 0 && ownedPotions.length === 0 ? (
        <p className="muted">
          Selesaikan tugas untuk berpeluang menemukan telur 🥚 dan ramuan 🧪, lalu
          tetaskan pet di sini!
        </p>
      ) : (
        <>
          <div className="hatch-grid">
            <div>
              <span className="hatch-label">Telur</span>
              <div className="chip-row">
                {ownedEggs.map((s) => (
                  <button
                    key={s.id}
                    className={`chip ${eggPick === s.id ? 'active' : ''}`}
                    onClick={() => setEggPick(eggPick === s.id ? null : s.id)}
                  >
                    {s.emoji} {s.name} ×{player.eggs[s.id]}
                  </button>
                ))}
                {ownedEggs.length === 0 && <span className="muted">belum ada telur</span>}
              </div>
            </div>
            <div>
              <span className="hatch-label">Ramuan</span>
              <div className="chip-row">
                {ownedPotions.map((p) => (
                  <button
                    key={p.id}
                    className={`chip potion-chip ${potionPick === p.id ? 'active' : ''}`}
                    style={{ '--potion': p.color } as React.CSSProperties}
                    onClick={() => setPotionPick(potionPick === p.id ? null : p.id)}
                  >
                    🧪 {p.name} ×{player.potions[p.id]}
                  </button>
                ))}
                {ownedPotions.length === 0 && (
                  <span className="muted">belum ada ramuan</span>
                )}
              </div>
            </div>
          </div>
          <button
            className="btn primary hatch-btn"
            disabled={!eggPick || !potionPick}
            onClick={doHatch}
          >
            🐣 Tetaskan!
          </button>
        </>
      )}

      {/* ---- kandang pet ---- */}
      <h3 className="section-title">🏡 Kandang Pet</h3>
      {player.pets.length === 0 ? (
        <p className="muted">Belum ada pet yang menetas.</p>
      ) : (
        <div className="pet-grid">
          {player.pets.map((id) => {
            const info = parsePetId(id);
            if (!info) return null;
            const active = player.activePet === id;
            return (
              <button
                key={id}
                className={`pet-tile ${active ? 'active' : ''}`}
                style={{ borderColor: info.potion.color }}
                onClick={() => setActivePet(active ? undefined : id)}
                title={`${info.species.name} ${info.potion.name}`}
              >
                <span className="pet-emoji">{info.species.emoji}</span>
                <span className="pet-name">{info.potion.name}</span>
                {active && <span className="pet-star">★</span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="muted pet-hint">
        Pet aktif akan menemanimu di samping avatar. Ketuk pet untuk memilih.
      </p>
    </div>
  );
}
