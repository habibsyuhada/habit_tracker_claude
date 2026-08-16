import { useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Task, TaskType } from './types';
import { useGame } from './store/useGame';
import { syncReminder } from './notifications';
import { Header } from './components/Header';
import { TaskItem } from './components/TaskItem';
import { TaskModal } from './components/TaskModal';
import { SettingsModal } from './components/SettingsModal';
import { StatsModal } from './components/StatsModal';
import { Toasts } from './components/Toasts';
import { GearShop } from './components/GearShop';
import { BagView } from './components/BagView';

type Tab = TaskType | 'bag';

const TABS: { type: Tab; label: string; icon: string }[] = [
  { type: 'habit', label: 'Habits', icon: '🔁' },
  { type: 'daily', label: 'Dailies', icon: '📅' },
  { type: 'todo', label: 'To-Dos', icon: '✅' },
  { type: 'reward', label: 'Rewards', icon: '🎁' },
  { type: 'bag', label: 'Tas', icon: '🎒' },
];

const EMPTY_HINT: Record<Tab, string> = {
  bag: '',
  habit: 'Habit adalah kebiasaan yang bisa diskor + (baik) atau − (buruk) kapan saja.',
  daily: 'Daily harus diselesaikan sesuai jadwal — kalau terlewat, HP-mu berkurang!',
  todo: 'To-Do adalah tugas sekali selesai. Centang untuk dapat XP & gold.',
  reward: 'Tebus gold hasil kerja kerasmu dengan hadiah buatanmu sendiri.',
};

export default function App() {
  const hydrated = useGame((s) => s._hydrated);
  const tasks = useGame((s) => s.tasks);
  const runCron = useGame((s) => s.runCron);

  const [tab, setTab] = useState<Tab>('habit');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [showDoneTodos, setShowDoneTodos] = useState(false);

  // Cron dijalankan setelah data lokal termuat, lalu tiap kali app aktif lagi
  useEffect(() => {
    if (!hydrated) return;
    runCron();

    // pastikan jadwal pengingat tetap terpasang setelah reboot/update app
    const { reminder } = useGame.getState();
    if (Capacitor.isNativePlatform() && reminder.enabled) {
      syncReminder(reminder.enabled, reminder.time).catch(() => {});
    }

    const onVisible = () => document.visibilityState === 'visible' && runCron();
    document.addEventListener('visibilitychange', onVisible);

    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('resume', runCron).then((h) => (remove = h.remove));
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      remove?.();
    };
  }, [hydrated, runCron]);

  const visible = useMemo(() => {
    if (tab === 'bag') return [];
    const ofType = tasks.filter((t) => t.type === tab);
    if (tab === 'todo') {
      return ofType.filter((t) =>
        t.type === 'todo' ? showDoneTodos || !t.completed : true
      );
    }
    return ofType;
  }, [tasks, tab, showDoneTodos]);

  const doneTodoCount = useMemo(
    () => tasks.filter((t) => t.type === 'todo' && t.completed).length,
    [tasks]
  );

  if (!hydrated) {
    return (
      <div className="splash">
        <div className="splash-icon">⚔️</div>
        <div>HabitQuest</div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenStats={() => setStatsOpen(true)}
      />

      <main className="task-list">
        {tab === 'bag' ? (
          <BagView />
        ) : (
          <>
            {visible.length === 0 && (
              <div className="empty">
                <div className="empty-icon">
                  {TABS.find((t) => t.type === tab)?.icon}
                </div>
                <p>{EMPTY_HINT[tab]}</p>
                <p className="muted">Tekan ＋ untuk membuat yang pertama.</p>
              </div>
            )}
            {visible.map((task) => (
              <TaskItem key={task.id} task={task} onEdit={setEditing} />
            ))}
            {tab === 'todo' && doneTodoCount > 0 && (
              <button
                className="btn ghost show-done"
                onClick={() => setShowDoneTodos(!showDoneTodos)}
              >
                {showDoneTodos ? 'Sembunyikan' : 'Tampilkan'} yang selesai (
                {doneTodoCount})
              </button>
            )}
            {tab === 'reward' && <GearShop />}
          </>
        )}
      </main>

      {tab !== 'bag' && (
        <button className="fab" onClick={() => setCreating(true)} aria-label="Tambah">
          ＋
        </button>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.type}
            className={`tab ${tab === t.type ? 'active' : ''}`}
            onClick={() => setTab(t.type)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {(creating || editing) && (
        <TaskModal
          task={editing}
          defaultType={tab === 'bag' ? 'habit' : tab}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {statsOpen && <StatsModal onClose={() => setStatsOpen(false)} />}

      <Toasts />
    </div>
  );
}
