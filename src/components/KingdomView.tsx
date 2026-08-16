import { useGame } from '../store/useGame';
import {
  BUILDINGS,
  DECOR,
  JOB_BY_ID,
  THREAT_BY_ID,
  buildMap,
  buildingCost,
  dailyYield,
  kingdomEffects,
  titleFor,
} from '../game/kingdom';
import { dateKey, parseDateKey } from '../game/formulas';
import { BagView } from './BagView';

/** Tab Kerajaan: peta wilayah, pembangunan, kronik, lalu gudang & pet. */
export function KingdomView() {
  const player = useGame((s) => s.player);
  const kingdom = useGame((s) => s.kingdom);
  const buildBuilding = useGame((s) => s.buildBuilding);
  const buyDecor = useGame((s) => s.buyDecor);

  const tier = titleFor(player.level);
  const eff = kingdomEffects(kingdom.buildings);
  const tiles = buildMap(kingdom);
  const builtCount = Object.values(kingdom.buildings).filter((l) => l > 0).length;
  const yield_ = dailyYield(kingdom.citizens);

  const threat = kingdom.threat ? THREAT_BY_ID[kingdom.threat.defId] : undefined;
  const threatDaysLeft = kingdom.threat
    ? Math.max(
        0,
        Math.round(
          (parseDateKey(kingdom.threat.expiresOn).getTime() -
            parseDateKey(dateKey()).getTime()) /
            86400000
        )
      ) + 1
    : 0;

  const bonuses: string[] = [];
  if (eff.goldMult > 1) bonuses.push(`+${Math.round((eff.goldMult - 1) * 100)}% kas`);
  if (eff.xpMult > 1) bonuses.push(`+${Math.round((eff.xpMult - 1) * 100)}% kemakmuran`);
  if (eff.damageMult < 1)
    bonuses.push(`-${Math.round((1 - eff.damageMult) * 100)}% damage moral`);
  if (eff.dropBonus > 0) bonuses.push(`+${eff.dropBonus} jatah drop`);

  return (
    <div className="kingdom">
      {/* ---- ringkasan wilayah ---- */}
      <div className="realm-card">
        <div className="realm-title">
          👑 {tier.title} {player.name}
        </div>
        <div className="realm-sub">
          {tier.realm} · 🧑‍🌾 {kingdom.citizens.length} rakyat · 🏗️ {builtCount} bangunan
        </div>
        {bonuses.length > 0 && (
          <div className="realm-bonuses">✨ {bonuses.join(' · ')}</div>
        )}
      </div>

      {/* ---- ancaman aktif ---- */}
      {threat && kingdom.threat && (
        <div className="threat-card">
          <div className="threat-head">
            <span className="threat-emoji">{threat.emoji}</span>
            <div>
              <div className="threat-name">{threat.name}</div>
              <div className="threat-sub">
                Selesaikan {threat.goal} titah · sisa {threatDaysLeft} hari ·
                hadiah {threat.rewardGold} 🪙
              </div>
            </div>
          </div>
          <div className="threat-bar">
            <div
              className="threat-fill"
              style={{
                width: `${Math.min(100, (kingdom.threat.progress / threat.goal) * 100)}%`,
              }}
            />
            <span className="threat-label">
              {kingdom.threat.progress} / {threat.goal}
            </span>
          </div>
        </div>
      )}

      {/* ---- peta ---- */}
      <div className="realm-map">
        {tiles.map((t, i) => (
          <span key={i} className="realm-tile">
            {t}
          </span>
        ))}
      </div>
      <p className="muted map-hint">
        Wilayahmu tumbuh dari titah yang kamu tunaikan: tiap 4 tugas selesai, satu
        rakyat baru datang; tiap 3 rakyat mendirikan satu rumah.
      </p>

      {/* ---- rakyat ---- */}
      <h3 className="section-title">🧑‍🌾 Rakyat ({kingdom.citizens.length})</h3>
      <div className="citizen-card">
        <div className="citizen-grid">
          {kingdom.citizens.slice(0, 18).map((c) => {
            const job = JOB_BY_ID[c.job];
            return (
              <span className="citizen-chip" key={c.id} title={job?.name}>
                {job?.emoji} {c.name}
              </span>
            );
          })}
          {kingdom.citizens.length > 18 && (
            <span className="citizen-chip muted">
              +{kingdom.citizens.length - 18} lainnya
            </span>
          )}
        </div>
        {(yield_.gold > 0 || yield_.xp > 0 || yield_.moral > 0) && (
          <div className="citizen-yield">
            🧺 Hasil kerja per hari:{' '}
            {[
              yield_.gold > 0 ? `+${yield_.gold} kas` : '',
              yield_.xp > 0 ? `+${yield_.xp} kemakmuran` : '',
              yield_.moral > 0 ? `+${yield_.moral} moral` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </div>

      {/* ---- pembangunan ---- */}
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
                {level > 0 && <span className="bld-level"> Lv {level}/{def.maxLevel}</span>}
              </div>
              <div className="card-meta">
                <span>{def.desc}</span>
                {locked && <span className="overdue">butuh {def.minCitizens} rakyat</span>}
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

      {/* ---- dekorasi ---- */}
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
              <span className="decor-cost">{owned ? '✓ terpasang' : `🪙 ${def.cost}`}</span>
            </button>
          );
        })}
      </div>

      {/* ---- kronik ---- */}
      <h3 className="section-title">📜 Kronik Kerajaan</h3>
      {kingdom.log.length === 0 ? (
        <p className="muted">Belum ada peristiwa tercatat — kroniknya dimulai besok pagi.</p>
      ) : (
        <div className="chronicle">
          {kingdom.log.slice(0, 7).map((entry, i) => (
            <div className="chronicle-row" key={`${entry.date}-${i}`}>
              <span className="chronicle-date">{entry.date.slice(5)}</span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- gudang & hewan kerajaan ---- */}
      <h3 className="section-title">🎒 Gudang Kerajaan</h3>
      <BagView />
    </div>
  );
}
