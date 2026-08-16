import { useGame } from '../store/useGame';
import {
  JOB_BY_ID,
  THREAT_BY_ID,
  buildMap,
  dailyYield,
  kingdomEffects,
  titleFor,
} from '../game/kingdom';
import { dateKey, parseDateKey } from '../game/formulas';
import { PixelSprite } from './PixelSprite';

/** Tab Kerajaan: wilayah, ancaman, peta, rakyat, dan kronik. */
export function KingdomView() {
  const player = useGame((s) => s.player);
  const kingdom = useGame((s) => s.kingdom);

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
  if (eff.threatDelayBonus > 0)
    bonuses.push(`+${eff.threatDelayBonus} hari tenggat ancaman`);

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

      {/* ---- peta pixel-art ---- */}
      <div className="realm-map">
        {tiles.map((t, i) => (
          <span key={i} className="realm-tile">
            <PixelSprite sprite={t} size="100%" />
          </span>
        ))}
      </div>
      <p className="muted map-hint">
        Wilayahmu tumbuh dari titah yang kamu tunaikan: tiap 4 tugas selesai, satu
        rakyat baru datang; tiap 3 rakyat mendirikan satu rumah. Bangunan &
        dekorasi bisa dibeli di tab Rewards.
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
    </div>
  );
}
