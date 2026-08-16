import { useGame } from '../store/useGame';
import { BUILDINGS, DECOR, buildingCost } from '../game/kingdom';

/** Belanja kerajaan di tab Rewards: pembangunan & dekorasi. */
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
        return (
          <div className="card gear-card" key={def.id}>
            <div className="gear-emoji">{def.emoji}</div>
            <div className="card-body no-click">
              <div className="card-title">
                {def.name}
                {level > 0 && (
                  <span className="bld-level"> Lv {level}/{def.maxLevel}</span>
                )}
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
      <div className="decor-grid">
        {DECOR.map((def) => {
          const owned = kingdom.decor.includes(def.id);
          return (
            <button
              key={def.id}
              className={`decor-tile ${owned ? 'owned' : ''}`}
              disabled={owned}
              onClick={() => buyDecor(def.id)}
            >
              <span className="decor-emoji">{def.emoji}</span>
              <span className="decor-name">{def.name}</span>
              <span className="decor-cost">
                {owned ? '✓ terpasang' : `🪙 ${def.cost}`}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
