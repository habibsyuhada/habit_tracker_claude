import { useGame } from '../store/useGame';
import {
  BUILDINGS,
  DECOR,
  buildingCost,
  decorCost,
} from '../game/kingdom';
import { spriteKey } from '../game/sprites';
import { PixelSprite } from './PixelSprite';

/**
 * Belanja kerajaan di tab Rewards: pembangunan & dekorasi, keduanya
 * berlevel — kartu menampilkan preview pixel-art level berikutnya.
 */
export function KingdomShop() {
  const player = useGame((s) => s.player);
  const kingdom = useGame((s) => s.kingdom);
  const buildBuilding = useGame((s) => s.buildBuilding);
  const buyDecor = useGame((s) => s.buyDecor);

  return (
    <>
      <h3 className="section-title">🏗️ Pembangunan</h3>
      {BUILDINGS.map((def) => {
        const level = kingdom.buildings[def.id] ?? 0;
        const maxed = level >= def.maxLevel;
        const locked = kingdom.citizens.length < def.minCitizens;
        const cost = buildingCost(def, level);
        const previewLevel = Math.min(level + 1, def.maxLevel);
        return (
          <div className="card gear-card" key={def.id}>
            <div className="sprite-preview">
              <PixelSprite sprite={spriteKey(def.id, previewLevel)} size={40} />
            </div>
            <div className="card-body no-click">
              <div className="card-title">
                {def.name}
                <span className="bld-level"> Lv {level}/{def.maxLevel}</span>
              </div>
              <div className="card-meta">
                <span>{def.desc}</span>
                {locked && (
                  <span className="overdue">butuh {def.minCitizens} rakyat</span>
                )}
              </div>
            </div>
            {maxed ? (
              <span className="bld-maxed">MAX</span>
            ) : (
              <button
                className={`buy-btn ${!locked && player.gold >= cost ? '' : 'poor'}`}
                onClick={() => buildBuilding(def.id)}
              >
                🪙 {cost}
              </button>
            )}
          </div>
        );
      })}

      <h3 className="section-title">🌸 Dekorasi</h3>
      {DECOR.map((def) => {
        const level = kingdom.decor[def.id] ?? 0;
        const maxed = level >= def.maxLevel;
        const cost = decorCost(def, level);
        const previewLevel = Math.min(level + 1, def.maxLevel);
        return (
          <div className="card gear-card" key={def.id}>
            <div className="sprite-preview">
              <PixelSprite sprite={spriteKey(def.id, previewLevel)} size={40} />
            </div>
            <div className="card-body no-click">
              <div className="card-title">
                {def.name}
                <span className="bld-level"> Lv {level}/{def.maxLevel}</span>
              </div>
              <div className="card-meta">
                <span>Kosmetik — makin tinggi level, makin megah di peta</span>
              </div>
            </div>
            {maxed ? (
              <span className="bld-maxed">MAX</span>
            ) : (
              <button
                className={`buy-btn ${player.gold >= cost ? '' : 'poor'}`}
                onClick={() => buyDecor(def.id)}
              >
                🪙 {cost}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
