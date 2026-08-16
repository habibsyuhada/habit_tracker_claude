import { useGame } from '../store/useGame';
import { GEAR_SLOTS, SLOT_LABEL, nextGearForSlot } from '../game/items';

/** Toko perlengkapan di tab Rewards — tier berikutnya per slot, seperti Habitica. */
export function GearShop() {
  const player = useGame((s) => s.player);
  const buyGear = useGame((s) => s.buyGear);

  const forSale = GEAR_SLOTS.map((slot) => nextGearForSlot(slot, player.ownedGear)).filter(
    (g) => g !== undefined
  );

  if (forSale.length === 0) {
    return (
      <div className="shop-section">
        <h3 className="section-title">🏪 Toko Pusaka Kerajaan</h3>
        <p className="muted shop-empty">
          Semua pusaka sudah kamu miliki. Penguasa sejati! 🏆
        </p>
      </div>
    );
  }

  return (
    <div className="shop-section">
      <h3 className="section-title">🏪 Toko Pusaka Kerajaan</h3>
      {forSale.map((item) => (
        <div className="card gear-card" key={item.id}>
          <div className="gear-emoji">{item.emoji}</div>
          <div className="card-body no-click">
            <div className="card-title">{item.name}</div>
            <div className="card-meta">
              <span>{SLOT_LABEL[item.slot]}</span>
              {item.str > 0 && <span className="stat-str">👑 Wibawa +{item.str}</span>}
              {item.con > 0 && <span className="stat-con">🛡️ Benteng +{item.con}</span>}
            </div>
          </div>
          <button
            className={`buy-btn ${player.gold >= item.cost ? '' : 'poor'}`}
            onClick={() => buyGear(item.id)}
          >
            🪙 {item.cost}
          </button>
        </div>
      ))}
    </div>
  );
}
