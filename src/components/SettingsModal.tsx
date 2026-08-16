import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useGame } from '../store/useGame';
import { syncReminder } from '../notifications';

const AVATARS = ['🧙', '⚔️', '🛡️', '🏹', '🐉', '🦊', '🐱', '🦉', '🌸', '🚀'];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const player = useGame((s) => s.player);
  const reminder = useGame((s) => s.reminder);
  const setProfile = useGame((s) => s.setProfile);
  const setReminder = useGame((s) => s.setReminder);
  const exportData = useGame((s) => s.exportData);
  const importData = useGame((s) => s.importData);
  const pushToast = useGame((s) => s.pushToast);
  const resetAll = useGame((s) => s.resetAll);

  const sound = useGame((s) => s.sound);
  const setSound = useGame((s) => s.setSound);
  const [name, setName] = useState(player.name);
  const [avatar, setAvatar] = useState(player.avatar);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNative = Capacitor.isNativePlatform();

  const applyReminder = async (enabled: boolean, time: string) => {
    setReminder({ enabled, time });
    if (!isNative) {
      if (enabled) {
        pushToast('info', 'Pengingat hanya tersedia di aplikasi Android/iOS');
      }
      return;
    }
    const ok = await syncReminder(enabled, time);
    if (enabled && !ok) {
      setReminder({ enabled: false, time });
      pushToast('danger', 'Izin notifikasi ditolak — aktifkan di pengaturan sistem');
    } else if (enabled) {
      pushToast('info', `⏰ Pengingat harian aktif jam ${time}`);
    }
  };

  const doExport = async () => {
    const json = exportData();
    const filename = `habitquest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      if (isNative) {
        const file = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Backup HabitQuest',
          files: [file.uri],
        });
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      pushToast('info', '📤 Backup diekspor');
    } catch {
      // user membatalkan dialog share — bukan error
    }
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    if (importData(text)) onClose();
  };

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

        <div className="field">
          <span>Pengingat harian {isNative ? '' : '(hanya di app Android/iOS)'}</span>
          <div className="reminder-row">
            <button
              className={`chip ${reminder.enabled ? 'active' : ''}`}
              onClick={() => applyReminder(!reminder.enabled, reminder.time)}
            >
              {reminder.enabled ? '🔔 Aktif' : '🔕 Nonaktif'}
            </button>
            <input
              type="time"
              value={reminder.time}
              onChange={(e) => applyReminder(reminder.enabled, e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <span>Efek suara</span>
          <div className="chip-row">
            <button
              className={`chip ${sound ? 'active' : ''}`}
              onClick={() => setSound(!sound)}
            >
              {sound ? '🔊 Aktif' : '🔇 Senyap'}
            </button>
          </div>
        </div>

        <div className="field">
          <span>Backup data</span>
          <div className="chip-row">
            <button className="btn ghost" onClick={doExport}>
              📤 Ekspor
            </button>
            <button className="btn ghost" onClick={() => fileInputRef.current?.click()}>
              📥 Impor
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = '';
              }}
            />
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
            <span>krisis kerajaan</span>
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
          Rutin ekspor backup supaya datamu aman.
        </p>
      </div>
    </div>
  );
}
