import { useGame } from '../store/useGame';
import { xpToNextLevel } from '../game/formulas';

interface Props {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: Props) {
  const player = useGame((s) => s.player);
  const xpNeeded = xpToNextLevel(player.level);
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const xpPct = Math.max(0, Math.min(100, (player.xp / xpNeeded) * 100));

  return (
    <header className="header">
      <div className="header-top">
        <button className="avatar" onClick={onOpenSettings} aria-label="Profil">
          {player.avatar}
        </button>
        <div className="header-info">
          <div className="header-name-row">
            <span className="player-name">{player.name}</span>
            <span className="player-level">Lv {player.level}</span>
          </div>
          <div className="bar-group">
            <div className="bar">
              <div className="bar-fill hp" style={{ width: `${hpPct}%` }} />
              <span className="bar-label">
                ❤️ {player.hp.toFixed(1)} / {player.maxHp}
              </span>
            </div>
            <div className="bar">
              <div className="bar-fill xp" style={{ width: `${xpPct}%` }} />
              <span className="bar-label">
                ⭐ {player.xp} / {xpNeeded}
              </span>
            </div>
          </div>
        </div>
        <div className="gold-chip" title="Gold">
          🪙 {player.gold.toFixed(1)}
        </div>
      </div>
    </header>
  );
}
