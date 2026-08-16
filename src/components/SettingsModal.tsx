import { useState } from 'react';
import { useGame } from '../store/useGame';

const AVATARS = ['🧙', '⚔️', '🛡️', '🏹', '🐉', '🦊', '🐱', '🦉', '🌸', '🚀'];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const player = useGame((s) => s.player);
  const setProfile = useGame((s) => s.setProfile);
  const resetAll = useGame((s) => s.resetAll);

  const [name, setName] = useState(player.name);
  const [avatar, setAvatar] = useState(player.avatar);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Profil</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <label className="field">
          <span>Nama</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
        </label>

        <div className="field">
          <span>Avatar</span>
          <div className="chip-row">
            {AVATARS.map((a) => (
              <button
                key={a}
                className={`chip avatar-chip ${avatar === a ? 'active' : ''}`}
                onClick={() => setAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="stats-grid">
          <div>
            <b>{player.totalTasksDone}</b>
            <span>tugas selesai</span>
          </div>
          <div>
            <b>{player.perfectDays}</b>
            <span>perfect day</span>
          </div>
          <div>
            <b>{player.deaths}</b>
            <span>kali tumbang</span>
          </div>
        </div>

        <div className="modal-actions">
          {confirmReset ? (
            <button
              className="btn danger"
              onClick={() => {
                resetAll();
                onClose();
              }}
            >
              Yakin? Semua data hilang!
            </button>
          ) : (
            <button className="btn ghost" onClick={() => setConfirmReset(true)}>
              Reset data
            </button>
          )}
          <button
            className="btn primary"
            onClick={() => {
              setProfile(name, avatar);
              onClose();
            }}
          >
            Simpan
          </button>
        </div>

        <p className="offline-note">
          📴 Semua data tersimpan di perangkat ini — HabitQuest berjalan 100% offline.
        </p>
      </div>
    </div>
  );
}
